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
import { MetricsService } from '../metrics/metrics.service.js';
import { STREAM_NAME, STREAM_SUBJECTS, SUBJECTS } from './subjects.js';
import type { ProjectConfig } from '../common/schemas/project-config.schema.js';

// --- Outbound event payload interfaces ---

export interface WorkflowStartedPayload {
  projectId: string;
  versionId: string;
  executionId: string;
  userId: string;
  config: ProjectConfig;
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

export interface GenerateReferencesPayload {
  projectId: string;
  executionId: string;
  bookStyle: { visualStyle: string; negativePrompt: string };
  characters: Array<{ characterId: string; physicalDescription: string }>;
  locations: Array<{ locationId: string; description: string }>;
  correlationId: string;
}

export interface ImageGenerationStepPayload {
  projectId: string;
  executionId: string;
  bookStyle: { visualStyle: string; negativePrompt: string };
  scenes: Array<{
    sceneId: string;
    prompt: { image: string };
    negativePrompt?: string;
    characterRef?: { referenceImageUrl: string };
    locationRef?: { referenceImageUrl: string };
  }>;
  correlationId: string;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;
const CONNECT_MAX_RETRIES = 10;
const CONNECT_BASE_DELAY_MS = 2000;

@Injectable()
export class NatsPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsPublisher.name);
  private nc: NatsConnection | undefined;
  private js: JetStreamClient | undefined;
  private sc = StringCodec();
  private connected = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly metricsService: MetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Connect in background so the app can start even if NATS is temporarily unavailable
    void this.connectWithRetry();
  }

  private async connectWithRetry(): Promise<void> {
    for (let attempt = 1; attempt <= CONNECT_MAX_RETRIES; attempt++) {
      try {
        this.nc = await connect({
          servers: this.config.NATS_URL,
          user: this.config.NATS_USER,
          pass: this.config.NATS_PASSWORD,
        });
        this.logger.log('Connected to NATS');

        const jsm: JetStreamManager = await this.nc.jetstreamManager();
        await this.ensureStream(jsm);

        this.js = this.nc.jetstream();
        this.connected = true;
        this.logger.log('JetStream client initialized');
        return;
      } catch (error) {
        this.logger.warn(
          { attempt, maxRetries: CONNECT_MAX_RETRIES, error: (error as Error).message },
          'Failed to connect to NATS, retrying...',
        );
        if (attempt < CONNECT_MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, CONNECT_BASE_DELAY_MS * attempt));
        }
      }
    }
    this.logger.error(
      'Failed to connect to NATS after all retries — publishing will be unavailable',
    );
  }

  isConnected(): boolean {
    return this.connected;
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
    if (!this.connected || !this.js) {
      this.logger.warn({ subject }, 'NATS not connected — message dropped');
      return;
    }
    const data = this.sc.encode(JSON.stringify(payload));
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.js.publish(subject, data);
        this.metricsService.natsMessagesPublishedTotal.inc({ subject });
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

  async publishGenerateReferences(payload: GenerateReferencesPayload): Promise<void> {
    await this.publishWithRetry(SUBJECTS.GENERATE_REFERENCES, payload);
  }

  async publishImageGeneration(payload: ImageGenerationStepPayload): Promise<void> {
    await this.publishWithRetry(SUBJECTS.IMAGE_GENERATION_STEP, payload);
  }
}
