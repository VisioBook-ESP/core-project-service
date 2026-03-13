import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { NatsPublisher } from '../messaging/nats.publisher.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { WORKFLOW_QUEUE_NAME, WorkflowJobName } from './workflow.types.js';
import type { WorkflowJobData } from './workflow.types.js';

const POLL_INTERVAL_MS = 10_000;

@Processor(WORKFLOW_QUEUE_NAME)
export class WorkflowProcessor extends WorkerHost implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowProcessor.name);
  private pollTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly natsPublisher: NatsPublisher,
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
