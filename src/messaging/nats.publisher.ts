import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  connect,
  StringCodec,
  RetentionPolicy,
  StorageType,
  DiscardPolicy,
  nanos,
  type NatsConnection,
  type JetStreamClient,
  type JetStreamManager,
} from 'nats';
import { APP_CONFIG } from '../common/config/app.config.js';
import type { AppConfig } from '../common/config/app.config.js';
import { STREAM_NAME, STREAM_SUBJECTS, SUBJECTS } from './subjects.js';

// --- Outbound event payload interfaces ---

export interface WorkflowStartedPayload {
  projectId: string;
  versionId: string;
  executionId: string;
  userId: string;
  config: Record<string, unknown>;
  contentText: string;
  sceneCount: number;
  timestamp: string;
  correlationId: string;
}

export interface WorkflowStepCompletedPayload {
  projectId: string;
  versionId: string;
  executionId: string;
  userId: string;
  step: string;
  timestamp: string;
  correlationId: string;
}

export interface WorkflowCompletedPayload {
  projectId: string;
  versionId: string;
  executionId: string;
  userId: string;
  videoUrl: string;
  timestamp: string;
  correlationId: string;
}

export interface WorkflowFailedPayload {
  projectId: string;
  versionId: string;
  executionId: string;
  userId: string;
  step: string;
  error: string;
  timestamp: string;
  correlationId: string;
}

export interface WorkflowCancelledPayload {
  projectId: string;
  versionId: string;
  executionId: string;
  userId: string;
  timestamp: string;
  correlationId: string;
}

export interface ProjectDeletedPayload {
  projectId: string;
  userId: string;
  timestamp: string;
  correlationId: string;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

@Injectable()
export class NatsPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsPublisher.name);
  private nc!: NatsConnection;
  private js!: JetStreamClient;
  private sc = StringCodec();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async onModuleInit(): Promise<void> {
    this.nc = await connect({
      servers: this.config.NATS_URL,
      user: this.config.NATS_USER,
      pass: this.config.NATS_PASSWORD,
    });
    this.logger.log('Connected to NATS');

    const jsm: JetStreamManager = await this.nc.jetstreamManager();
    await this.ensureStream(jsm);

    this.js = this.nc.jetstream();
    this.logger.log('JetStream client initialized');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.nc) {
      await this.nc.drain();
      this.logger.log('NATS connection drained');
    }
  }

  private async ensureStream(jsm: JetStreamManager): Promise<void> {
    try {
      await jsm.streams.info(STREAM_NAME);
      this.logger.log(`Stream "${STREAM_NAME}" already exists`);
    } catch {
      await jsm.streams.add({
        name: STREAM_NAME,
        subjects: STREAM_SUBJECTS,
        retention: RetentionPolicy.Limits,
        storage: StorageType.File,
        max_bytes: 1024 * 1024 * 1024, // 1 GB
        max_age: nanos(7 * 24 * 60 * 60 * 1000), // 7 days
        discard: DiscardPolicy.Old,
      });
      this.logger.log(`Stream "${STREAM_NAME}" created`);
    }
  }

  private async publishWithRetry(subject: string, payload: unknown): Promise<void> {
    const data = this.sc.encode(JSON.stringify(payload));
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.js.publish(subject, data);
        this.logger.debug({ subject }, 'Published message');
        return;
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          this.logger.error({ subject, error, attempt }, 'Failed to publish after max retries');
          throw error;
        }
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn({ subject, attempt, delay }, 'Publish failed, retrying');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async publishWorkflowStarted(payload: WorkflowStartedPayload): Promise<void> {
    await this.publishWithRetry(SUBJECTS.WORKFLOW_STARTED, payload);
  }

  async publishWorkflowStepCompleted(payload: WorkflowStepCompletedPayload): Promise<void> {
    await this.publishWithRetry(SUBJECTS.WORKFLOW_STEP_COMPLETED, payload);
  }

  async publishWorkflowCompleted(payload: WorkflowCompletedPayload): Promise<void> {
    await this.publishWithRetry(SUBJECTS.WORKFLOW_COMPLETED, payload);
  }

  async publishWorkflowFailed(payload: WorkflowFailedPayload): Promise<void> {
    await this.publishWithRetry(SUBJECTS.WORKFLOW_FAILED, payload);
  }

  async publishWorkflowCancelled(payload: WorkflowCancelledPayload): Promise<void> {
    await this.publishWithRetry(SUBJECTS.WORKFLOW_CANCELLED, payload);
  }

  async publishProjectDeleted(payload: ProjectDeletedPayload): Promise<void> {
    await this.publishWithRetry(SUBJECTS.PROJECT_DELETED, payload);
  }
}
