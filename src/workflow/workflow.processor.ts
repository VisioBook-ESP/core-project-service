import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NatsPublisher } from '../messaging/nats.publisher.js';
import { WORKFLOW_QUEUE_NAME, WorkflowJobName } from './workflow.types.js';
import type { WorkflowJobData } from './workflow.types.js';

@Processor(WORKFLOW_QUEUE_NAME)
export class WorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowProcessor.name);

  constructor(private readonly natsPublisher: NatsPublisher) {
    super();
  }

  async process(job: Job<WorkflowJobData>): Promise<void> {
    const { projectId, versionId, executionId, step, correlationId, userId } = job.data;

    this.logger.log(
      { jobName: job.name, jobId: job.id, projectId, versionId, executionId, step },
      'Processing workflow job',
    );

    switch (job.name) {
      case WorkflowJobName.ANALYSIS:
      case WorkflowJobName.IMAGE_GENERATION:
      case WorkflowJobName.AUDIO_GENERATION:
      case WorkflowJobName.ASSEMBLY:
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
    this.logger.error(
      { jobName: job.name, jobId: job.id, error: error.message },
      'Workflow job failed',
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<WorkflowJobData>): void {
    this.logger.log(
      { jobName: job.name, jobId: job.id },
      'Workflow job completed',
    );
  }
}
