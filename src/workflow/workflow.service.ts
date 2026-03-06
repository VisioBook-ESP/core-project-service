import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createActor } from 'xstate';
import { PrismaService } from '../common/database/prisma.service.js';
import { NatsPublisher } from '../messaging/nats.publisher.js';
import { ProjectService } from '../project/project.service.js';
import { UserServiceClient } from '../clients/user-service.client.js';
import { workflowMachine } from './workflow.machine.js';
import { calculateProgress } from './workflow.progress.js';
import { WORKFLOW_QUEUE_NAME, WorkflowJobName } from './workflow.types.js';
import type { WorkflowJobData } from './workflow.types.js';
import type { StepProgress } from './workflow.progress.js';
import type { WorkflowExecution, WorkflowStep, Prisma } from '../generated/prisma/client.js';

const PIPELINE_ORDER: string[] = [
  'analysis',
  'scene_extraction',
  'character_extraction',
  'image_generation',
  'audio_generation',
  'assembly',
];

const STEP_TO_JOB: Record<string, WorkflowJobName> = {
  analysis: WorkflowJobName.ANALYSIS,
  image_generation: WorkflowJobName.IMAGE_GENERATION,
  audio_generation: WorkflowJobName.AUDIO_GENERATION,
  assembly: WorkflowJobName.ASSEMBLY,
};

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly natsPublisher: NatsPublisher,
    private readonly projectService: ProjectService,
    private readonly userServiceClient: UserServiceClient,
    @InjectQueue(WORKFLOW_QUEUE_NAME) private readonly workflowQueue: Queue<WorkflowJobData>,
  ) {}

  async startWorkflow(
    projectId: string,
    versionId: string,
    userId: string,
    correlationId: string,
  ): Promise<WorkflowExecution & { steps: WorkflowStep[] }> {
    await this.projectService.ensureOwnership(projectId, userId);

    const version = await this.prisma.projectVersion.findFirst({
      where: { id: versionId, projectId },
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    if (version.status !== 'draft' && version.status !== 'failed') {
      throw new ConflictException(
        `Cannot start workflow: version is in "${version.status}" status`,
      );
    }

    let hasQuota = false;
    try {
      const quotaResult = await this.userServiceClient.checkQuota(userId, correlationId);
      hasQuota = quotaResult.hasQuota;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Failed to check quota');
    }

    if (!hasQuota) {
      throw new BadRequestException('Insufficient quota to start workflow');
    }

    const content = await this.prisma.projectContent.findUnique({
      where: { projectId },
    });

    if (!content) {
      throw new BadRequestException('Project has no content');
    }

    // Validate transition using XState
    const actor = createActor(workflowMachine, {
      snapshot: {
        ...workflowMachine.resolveState({
          value: 'draft',
          context: {
            projectId,
            versionId,
            executionId: '',
            hasContent: true,
            hasQuota: true,
            hasScenes: false,
            retryCount: 0,
            maxRetries: 3,
          },
        }),
      },
    });
    actor.start();
    actor.send({ type: 'START_WORKFLOW' });
    const snapshot = actor.getSnapshot();
    actor.stop();

    if (!snapshot.matches('analyzing')) {
      throw new ConflictException('Workflow transition to analyzing state is not valid');
    }

    const execution = await this.prisma.$transaction(async (tx) => {
      const exec = await tx.workflowExecution.create({
        data: {
          projectId,
          versionId,
          status: 'running',
          currentStep: 'analysis',
          progress: 0,
          startedAt: new Date(),
          steps: {
            create: PIPELINE_ORDER.map((step) => ({
              step: step as never,
              status: 'pending' as const,
              progress: 0,
            })),
          },
        },
        include: { steps: true },
      });

      await tx.projectVersion.update({
        where: { id: versionId },
        data: { status: 'analyzing' },
      });

      return exec;
    });

    await this.workflowQueue.add(WorkflowJobName.ANALYSIS, {
      projectId,
      versionId,
      executionId: execution.id,
      step: 'analysis',
      correlationId,
      userId,
    });

    await this.natsPublisher.publishWorkflowStarted({
      projectId,
      versionId,
      executionId: execution.id,
      userId,
      config: (version.config as Record<string, unknown>) ?? {},
      contentText: content.text,
      sceneCount: 0,
      timestamp: new Date().toISOString(),
      correlationId,
    });

    this.logger.log(
      { projectId, versionId, executionId: execution.id, userId },
      'Workflow started',
    );

    return execution;
  }

  async getStatus(
    projectId: string,
    versionId: string,
    executionId: string,
    userId: string,
  ): Promise<WorkflowExecution & { steps: WorkflowStep[] }> {
    await this.projectService.ensureOwnership(projectId, userId);

    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId, versionId, projectId },
      include: { steps: true },
    });

    if (!execution) {
      throw new NotFoundException('Workflow execution not found');
    }

    return execution;
  }

  async cancelWorkflow(
    projectId: string,
    versionId: string,
    executionId: string,
    userId: string,
    correlationId?: string,
  ): Promise<void> {
    await this.projectService.ensureOwnership(projectId, userId);

    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId, versionId, projectId },
      include: { steps: true },
    });

    if (!execution) {
      throw new NotFoundException('Workflow execution not found');
    }

    if (execution.status !== 'running') {
      throw new ConflictException(
        `Cannot cancel workflow: execution is in "${execution.status}" status`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workflowExecution.update({
        where: { id: executionId },
        data: { status: 'cancelled', completedAt: new Date() },
      });

      await tx.workflowStep.updateMany({
        where: {
          executionId,
          status: { in: ['pending', 'running'] },
        },
        data: { status: 'skipped' },
      });

      await tx.projectVersion.update({
        where: { id: versionId },
        data: { status: 'cancelled' },
      });
    });

    await this.natsPublisher.publishWorkflowCancelled({
      projectId,
      versionId,
      executionId,
      userId,
      timestamp: new Date().toISOString(),
      correlationId: correlationId ?? executionId,
    });

    this.logger.log({ projectId, versionId, executionId, userId }, 'Workflow cancelled');
  }

  async handleStepCompleted(
    executionId: string,
    step: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId },
      include: { steps: true },
    });

    if (!execution) {
      this.logger.warn({ executionId, step }, 'Execution not found for step completion');
      return;
    }

    if (execution.status !== 'running') {
      this.logger.warn(
        { executionId, step, status: execution.status },
        'Execution not running, ignoring step completion',
      );
      return;
    }

    const workflowStep = execution.steps.find((s) => s.step === step);
    if (workflowStep) {
      await this.prisma.workflowStep.update({
        where: { id: workflowStep.id },
        data: {
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          details: details ? (details as Prisma.InputJsonValue) : undefined,
        },
      });
    }

    // Calculate next step
    const currentIndex = PIPELINE_ORDER.indexOf(step);
    let nextStep: string | undefined;

    for (let i = currentIndex + 1; i < PIPELINE_ORDER.length; i++) {
      const candidate = PIPELINE_ORDER[i];
      if (candidate && STEP_TO_JOB[candidate]) {
        nextStep = candidate;
        break;
      }
    }

    if (nextStep) {
      // Mark next step as running
      const nextWorkflowStep = execution.steps.find((s) => s.step === nextStep);
      if (nextWorkflowStep) {
        await this.prisma.workflowStep.update({
          where: { id: nextWorkflowStep.id },
          data: { status: 'running', startedAt: new Date() },
        });
      }

      // Also mark intermediate steps (scene_extraction, character_extraction) as completed
      for (let i = currentIndex + 1; i < PIPELINE_ORDER.indexOf(nextStep); i++) {
        const intermediateStep = PIPELINE_ORDER[i];
        const intermediate = execution.steps.find((s) => s.step === intermediateStep);
        if (intermediate && intermediate.status === 'pending') {
          await this.prisma.workflowStep.update({
            where: { id: intermediate.id },
            data: { status: 'completed', progress: 100, completedAt: new Date() },
          });
        }
      }

      await this.workflowQueue.add(STEP_TO_JOB[nextStep]!, {
        projectId: execution.projectId,
        versionId: execution.versionId,
        executionId,
        step: nextStep,
        correlationId: executionId,
        userId: '',
      });

      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: { currentStep: nextStep },
      });
    } else {
      // All steps done
      await this.prisma.$transaction(async (tx) => {
        await tx.workflowExecution.update({
          where: { id: executionId },
          data: {
            status: 'completed',
            progress: 100,
            currentStep: null,
            completedAt: new Date(),
          },
        });

        await tx.projectVersion.update({
          where: { id: execution.versionId },
          data: { status: 'completed' },
        });
      });

      await this.natsPublisher.publishWorkflowCompleted({
        projectId: execution.projectId,
        versionId: execution.versionId,
        executionId,
        userId: '',
        videoUrl: '',
        timestamp: new Date().toISOString(),
        correlationId: executionId,
      });

      this.logger.log({ executionId }, 'Workflow completed');
    }

    // Recalculate progress
    const updatedExecution = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId },
      include: { steps: true },
    });

    if (updatedExecution && updatedExecution.status === 'running') {
      const stepProgress: StepProgress[] = updatedExecution.steps.map((s) => ({
        step: s.step,
        status: s.status as StepProgress['status'],
        progress: s.progress,
      }));

      const progress = calculateProgress(stepProgress);

      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: { progress },
      });
    }

    await this.natsPublisher.publishWorkflowStepCompleted({
      projectId: execution.projectId,
      versionId: execution.versionId,
      executionId,
      userId: '',
      step,
      timestamp: new Date().toISOString(),
      correlationId: executionId,
    });

    this.logger.log({ executionId, step }, 'Step completed');
  }

  async handleStepFailed(executionId: string, step: string, error: string): Promise<void> {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId },
      include: { steps: true },
    });

    if (!execution) {
      this.logger.warn({ executionId, step }, 'Execution not found for step failure');
      return;
    }

    const workflowStep = execution.steps.find((s) => s.step === step);
    if (workflowStep) {
      await this.prisma.workflowStep.update({
        where: { id: workflowStep.id },
        data: { status: 'failed', completedAt: new Date() },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: { step, message: error },
        },
      });

      await tx.projectVersion.update({
        where: { id: execution.versionId },
        data: { status: 'failed' },
      });
    });

    await this.natsPublisher.publishWorkflowFailed({
      projectId: execution.projectId,
      versionId: execution.versionId,
      executionId,
      userId: '',
      step,
      error,
      timestamp: new Date().toISOString(),
      correlationId: executionId,
    });

    this.logger.log({ executionId, step, error }, 'Step failed');
  }

  async handleProgressUpdate(executionId: string, step: string, progress: number): Promise<void> {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId },
      include: { steps: true },
    });

    if (!execution || execution.status !== 'running') {
      return;
    }

    const workflowStep = execution.steps.find((s) => s.step === step);
    if (workflowStep) {
      await this.prisma.workflowStep.update({
        where: { id: workflowStep.id },
        data: { progress: Math.min(100, Math.max(0, Math.round(progress))) },
      });
    }

    const stepProgress: StepProgress[] = execution.steps.map((s) => ({
      step: s.step,
      status: s.step === step ? 'running' : (s.status as StepProgress['status']),
      progress: s.step === step ? progress : s.progress,
    }));

    const overallProgress = calculateProgress(stepProgress);

    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { progress: overallProgress },
    });
  }
}
