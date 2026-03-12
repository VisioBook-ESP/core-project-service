import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  connect,
  StringCodec,
  AckPolicy,
  nanos,
  type NatsConnection,
  type JetStreamClient,
  type JetStreamManager,
  type ConsumerMessages,
} from 'nats';
import { APP_CONFIG } from '../common/config/app.config.js';
import type { AppConfig } from '../common/config/app.config.js';
import { STREAM_NAME, CONSUMER_NAME, CONSUMER_FILTER, AI_SUBJECTS } from './subjects.js';
import type { WorkflowService } from '../workflow/workflow.service.js';

// --- Inbound event payload interfaces ---

export interface AnalysisCompletedEvent {
  projectId: string;
  versionId: string;
  executionId: string;
  userId: string;
  scenes: unknown[];
  characters: unknown[];
  correlationId: string;
}

export interface AnalysisFailedEvent {
  projectId: string;
  versionId: string;
  executionId: string;
  userId: string;
  error: string;
  correlationId: string;
}

export interface MediaImageCompletedEvent {
  projectId: string;
  versionId: string;
  executionId: string;
  sceneId: string;
  imageUrl: string;
  correlationId: string;
}

export interface MediaAudioCompletedEvent {
  projectId: string;
  versionId: string;
  executionId: string;
  audioUrl: string;
  correlationId: string;
}

export interface AssemblyCompletedEvent {
  projectId: string;
  versionId: string;
  executionId: string;
  videoUrl: string;
  correlationId: string;
}

export interface AssemblyFailedEvent {
  projectId: string;
  versionId: string;
  executionId: string;
  error: string;
  correlationId: string;
}

export interface ProgressEvent {
  projectId: string;
  versionId: string;
  executionId: string;
  step: string;
  progress: number;
  correlationId: string;
}

@Injectable()
export class NatsSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsSubscriber.name);
  private nc!: NatsConnection;
  private js!: JetStreamClient;
  private consumer: ConsumerMessages | undefined;
  private sc = StringCodec();
  private running = true;
  private workflowService!: WorkflowService;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit(): Promise<void> {
    // Lazily resolve WorkflowService to avoid circular dependency
    const { WorkflowService: WfService } = await import('../workflow/workflow.service.js');
    this.workflowService = this.moduleRef.get(WfService, { strict: false });

    // Connect in background so the app can start even if NATS is temporarily unavailable
    void this.connectWithRetry();
  }

  private async connectWithRetry(): Promise<void> {
    const maxRetries = 10;
    const baseDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.nc = await connect({
          servers: this.config.NATS_URL,
          user: this.config.NATS_USER,
          pass: this.config.NATS_PASSWORD,
        });
        this.logger.log('Subscriber connected to NATS');

        const jsm: JetStreamManager = await this.nc.jetstreamManager();
        await this.ensureConsumer(jsm);

        this.js = this.nc.jetstream();

        // Fire-and-forget: start consuming without blocking init
        void this.startConsuming();
        return;
      } catch (error) {
        this.logger.warn(
          { attempt, maxRetries, error: (error as Error).message },
          'Subscriber failed to connect to NATS, retrying...',
        );
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, baseDelay * attempt));
        }
      }
    }
    this.logger.error('Subscriber failed to connect to NATS after all retries — consuming unavailable');
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    if (this.consumer) {
      await this.consumer.close();
    }
    if (this.nc) {
      await this.nc.drain();
      this.logger.log('Subscriber NATS connection drained');
    }
  }

  private async ensureConsumer(jsm: JetStreamManager): Promise<void> {
    try {
      await jsm.consumers.info(STREAM_NAME, CONSUMER_NAME);
      this.logger.log(`Consumer "${CONSUMER_NAME}" already exists`);
    } catch {
      await jsm.consumers.add(STREAM_NAME, {
        durable_name: CONSUMER_NAME,
        ack_policy: AckPolicy.Explicit,
        ack_wait: nanos(30_000),
        max_deliver: 5,
        filter_subject: CONSUMER_FILTER,
      });
      this.logger.log(`Consumer "${CONSUMER_NAME}" created`);
    }
  }

  private async startConsuming(): Promise<void> {
    try {
      const consumer = await this.js.consumers
        .get(STREAM_NAME, CONSUMER_NAME)
        .then((c) => c.consume());
      this.consumer = consumer;
      this.logger.log('Started consuming AI events');

      for await (const msg of consumer) {
        if (!this.running) break;
        try {
          const data = JSON.parse(this.sc.decode(msg.data)) as Record<string, unknown>;
          await this.handleMessage(msg.subject, data);
          msg.ack();
        } catch (error) {
          this.logger.error({ subject: msg.subject, error }, 'Failed to process message');
          msg.nak();
        }
      }
    } catch (error) {
      if (this.running) {
        this.logger.error({ error }, 'Consumer loop terminated unexpectedly');
      }
    }
  }

  private async handleMessage(subject: string, data: Record<string, unknown>): Promise<void> {
    const executionId = data.executionId as string;

    switch (subject) {
      case AI_SUBJECTS.ANALYSIS_COMPLETED: {
        this.logger.log({ executionId }, 'Handling analysis completed');
        await this.workflowService.handleStepCompleted(executionId, 'analysis', data);
        break;
      }
      case AI_SUBJECTS.ANALYSIS_FAILED: {
        this.logger.log({ executionId }, 'Handling analysis failed');
        await this.workflowService.handleStepFailed(executionId, 'analysis', data.error as string);
        break;
      }
      case AI_SUBJECTS.MEDIA_IMAGE_COMPLETED: {
        this.logger.log({ executionId }, 'Handling media image completed');
        await this.workflowService.handleStepCompleted(executionId, 'image_generation', data);
        break;
      }
      case AI_SUBJECTS.MEDIA_AUDIO_COMPLETED: {
        this.logger.log({ executionId }, 'Handling media audio completed');
        await this.workflowService.handleStepCompleted(executionId, 'audio_generation', data);
        break;
      }
      case AI_SUBJECTS.ASSEMBLY_COMPLETED: {
        this.logger.log({ executionId }, 'Handling assembly completed');
        await this.workflowService.handleStepCompleted(executionId, 'assembly', data);
        break;
      }
      case AI_SUBJECTS.ASSEMBLY_FAILED: {
        this.logger.log({ executionId }, 'Handling assembly failed');
        await this.workflowService.handleStepFailed(executionId, 'assembly', data.error as string);
        break;
      }
      case AI_SUBJECTS.PROGRESS: {
        this.logger.log({ executionId }, 'Handling progress update');
        await this.workflowService.handleProgressUpdate(
          executionId,
          data.step as string,
          data.progress as number,
        );
        break;
      }
      default:
        this.logger.warn({ subject }, 'Unknown AI subject');
    }
  }
}
