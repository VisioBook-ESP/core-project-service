import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { NatsPublisher } from '../messaging/nats.publisher.js';
import { PrismaService } from '../common/database/prisma.service.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { ProjectConfigSchema } from '../common/schemas/project-config.schema.js';
import { WORKFLOW_QUEUE_NAME, WorkflowJobName } from './workflow.types.js';
import type { WorkflowJobData } from './workflow.types.js';

const POLL_INTERVAL_MS = 10_000;

@Processor(WORKFLOW_QUEUE_NAME)
export class WorkflowProcessor extends WorkerHost implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowProcessor.name);
  private pollTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly natsPublisher: NatsPublisher,
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    @InjectQueue(WORKFLOW_QUEUE_NAME) private readonly queue: Queue<WorkflowJobData>,
  ) {
    super();
  }

  onModuleInit(): void {
    this.pollTimer = setInterval(() => void this.pollQueueCounts(), POLL_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    if (this.worker) {
      await this.worker.close();
      this.logger.log('BullMQ worker closed');
    }
  }

  private async pollQueueCounts(): Promise<void> {
    try {
      const [active, waiting] = await Promise.all([
        this.queue.getActiveCount(),
        this.queue.getWaitingCount(),
      ]);
      this.metricsService.bullmqJobsActive.set({ queue: WORKFLOW_QUEUE_NAME }, active);
      this.metricsService.bullmqJobsWaiting.set({ queue: WORKFLOW_QUEUE_NAME }, waiting);
    } catch {
      // Silently skip if Redis is unavailable
    }
  }

  private buildBookStyle(projectConfig: Record<string, unknown>): {
    visualStyle: string;
    negativePrompt: string;
  } {
    const parsed = ProjectConfigSchema.safeParse(projectConfig);
    const style = parsed.success ? parsed.data.style : 'realistic';
    return { visualStyle: style, negativePrompt: '' };
  }

  async process(job: Job<WorkflowJobData>): Promise<void> {
    const { projectId, versionId, executionId, step, correlationId, userId } = job.data;

    this.logger.log(
      { jobName: job.name, jobId: job.id, projectId, versionId, executionId, step },
      'Processing workflow job',
    );

    switch (job.name) {
      case WorkflowJobName.ANALYSIS: {
        // Analysis is triggered by the NATS workflow.started message — the processor
        // is a no-op. The analysis callback arrives via NATS subscriber (analysis.completed).
        this.logger.debug({ executionId }, 'Analysis job — waiting for NATS callback');
        break;
      }

      case WorkflowJobName.REFERENCE_GENERATION: {
        const execution = await this.prisma.workflowExecution.findFirst({
          where: { id: executionId },
          include: { project: { select: { config: true } } },
        });

        if (!execution) {
          this.logger.warn({ executionId }, 'Execution not found for reference generation');
          break;
        }

        const payload = execution.analysisPayload as Record<string, unknown> | null;
        if (!payload) {
          this.logger.warn({ executionId }, 'No analysisPayload — skipping reference generation');
          break;
        }

        const bookStyle = this.buildBookStyle(
          (execution.project.config as Record<string, unknown>) ?? {},
        );

        // Build characters payload from cached analysis data
        const analysisCharacters = (payload.characters ?? []) as Array<Record<string, unknown>>;
        const dbCharacters = await this.prisma.character.findMany({
          where: { projectId },
          select: { id: true, name: true },
        });
        const charNameToId = new Map(dbCharacters.map((c) => [c.name, c.id]));

        const characters = analysisCharacters
          .filter((c) => c.physicalDescription || c.portraitPrompt)
          .map((c) => ({
            characterId: charNameToId.get(c.name as string) ?? '',
            physicalDescription: (c.physicalDescription as string) ?? '',
          }))
          .filter((c) => c.characterId);

        // Build locations payload from cached analysis data
        const analysisLocations = (payload.locations ?? []) as Array<Record<string, unknown>>;
        const dbLocations = await this.prisma.location.findMany({
          where: { projectId },
          select: { id: true, name: true },
        });
        const locNameToId = new Map(dbLocations.map((l) => [l.name, l.id]));

        const locations = analysisLocations
          .filter((l) => l.descriptionPrompt)
          .map((l) => ({
            locationId: locNameToId.get(l.name as string) ?? '',
            description: (l.descriptionPrompt as string) ?? '',
          }))
          .filter((l) => l.locationId);

        if (characters.length === 0 && locations.length === 0) {
          this.logger.log({ executionId }, 'No references to generate — completing step');
          // No-op: complete the step immediately so pipeline advances
          break;
        }

        await this.natsPublisher.publishGenerateReferences({
          projectId,
          executionId,
          bookStyle,
          characters,
          locations,
          correlationId,
        });

        this.logger.log(
          { executionId, characterCount: characters.length, locationCount: locations.length },
          'Published generate_references',
        );
        break;
      }

      case WorkflowJobName.IMAGE_GENERATION: {
        const execution = await this.prisma.workflowExecution.findFirst({
          where: { id: executionId },
          include: { project: { select: { config: true } } },
        });

        if (!execution) {
          this.logger.warn({ executionId }, 'Execution not found for image generation');
          break;
        }

        const bookStyle = this.buildBookStyle(
          (execution.project.config as Record<string, unknown>) ?? {},
        );

        // Get scenes with their locations
        const scenes = await this.prisma.scene.findMany({
          where: { projectId },
          orderBy: { order: 'asc' },
          include: { location: true },
        });

        // Get characters with reference images for scene-character linking
        const characters = await this.prisma.character.findMany({
          where: { projectId },
          select: { id: true, name: true, referenceImageUrl: true },
        });
        const charRefByName = new Map(
          characters.filter((c) => c.referenceImageUrl).map((c) => [c.name, c.referenceImageUrl!]),
        );

        // Use cached analysis payload for scene→character mapping
        const payload = execution.analysisPayload as Record<string, unknown> | null;
        const analysisScenes = (payload?.scenes ?? []) as Array<Record<string, unknown>>;
        const sceneCharMap = new Map<number, string[]>();
        for (const s of analysisScenes) {
          const order = (s.order as number) ?? 0;
          const present = (s.charactersPresent as string[]) ?? [];
          sceneCharMap.set(order, present);
        }

        const scenePayloads = scenes.map((scene) => {
          const charNames = sceneCharMap.get(scene.order) ?? [];
          // Pick the first character with a reference image for this scene
          const charRefUrl = charNames.map((name) => charRefByName.get(name)).find((url) => url);

          const entry: {
            sceneId: string;
            prompt: { image: string };
            negativePrompt?: string;
            characterRef?: { referenceImageUrl: string };
            locationRef?: { referenceImageUrl: string };
          } = {
            sceneId: scene.id,
            prompt: { image: scene.imagePrompt },
          };

          if (scene.negativePrompt) {
            entry.negativePrompt = scene.negativePrompt;
          }
          if (charRefUrl) {
            entry.characterRef = { referenceImageUrl: charRefUrl };
          }
          if (scene.location?.referenceImageUrl) {
            entry.locationRef = { referenceImageUrl: scene.location.referenceImageUrl };
          }

          return entry;
        });

        await this.natsPublisher.publishImageGeneration({
          projectId,
          executionId,
          bookStyle,
          scenes: scenePayloads,
          correlationId,
        });

        this.logger.log(
          { executionId, sceneCount: scenePayloads.length },
          'Published image_generation',
        );
        break;
      }

      case WorkflowJobName.AUDIO_GENERATION: {
        // Fetch scenes with dialogues + audio data, and characters with voice descriptions
        const audioScenes = await this.prisma.scene.findMany({
          where: { projectId },
          orderBy: { order: 'asc' },
          include: { dialogues: { orderBy: { order: 'asc' } } },
        });

        const audioCharacters = await this.prisma.character.findMany({
          where: { projectId },
          select: { id: true, name: true, voiceDescription: true },
        });

        const audioScenePayloads = audioScenes.map((scene) => ({
          sceneId: scene.id,
          order: scene.order,
          sceneType: scene.sceneType,
          audioPrompt: scene.audioPrompt,
          narrationText: scene.narrationText,
          dialogues: scene.dialogues.map((d) => ({
            speaker: d.speaker,
            line: d.line,
            delivery: d.delivery,
          })),
        }));

        const audioCharPayloads = audioCharacters.map((c) => ({
          characterId: c.id,
          name: c.name,
          voiceDescription: c.voiceDescription,
        }));

        await this.natsPublisher.publishAudioGeneration({
          projectId,
          executionId,
          scenes: audioScenePayloads,
          characters: audioCharPayloads,
          correlationId,
        });

        this.logger.log(
          { executionId, sceneCount: audioScenePayloads.length, characterCount: audioCharPayloads.length },
          'Published audio_generation',
        );
        break;
      }

      case WorkflowJobName.ASSEMBLY:
        // TODO: implement actual dispatching for assembly
        await this.natsPublisher.publishWorkflowStepCompleted({
          projectId,
          versionId,
          executionId,
          userId,
          step,
          timestamp: new Date().toISOString(),
          correlationId,
        });
        break;

      default:
        this.logger.warn({ jobName: job.name }, 'Unknown job name');
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<WorkflowJobData>, error: Error): void {
    this.metricsService.bullmqJobsFailedTotal.inc({ queue: WORKFLOW_QUEUE_NAME });
    this.logger.error(
      { jobName: job.name, jobId: job.id, error: error.message },
      'Workflow job failed',
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<WorkflowJobData>): void {
    this.logger.log({ jobName: job.name, jobId: job.id }, 'Workflow job completed');
  }
}
