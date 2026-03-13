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
  type JsMsg,
} from 'nats';
import { z } from 'zod';
import { APP_CONFIG } from '../common/config/app.config.js';
import type { AppConfig } from '../common/config/app.config.js';
import { PrismaService } from '../common/database/prisma.service.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { STREAM_NAME, CONSUMER_NAME, CONSUMER_FILTER, AI_SUBJECTS } from './subjects.js';
import type { WorkflowService } from '../workflow/workflow.service.js';

// --- Zod schemas for inbound event payloads ---

const AnalysisCompletedSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  executionId: z.string().uuid(),
  userId: z.string(),
  scenes: z.array(z.unknown()),
  characters: z.array(z.unknown()),
  correlationId: z.string(),
});

const AnalysisFailedSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  executionId: z.string().uuid(),
  userId: z.string(),
  error: z.string(),
  correlationId: z.string(),
});

const MediaImageCompletedSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  executionId: z.string().uuid(),
  sceneId: z.string().uuid(),
  imageUrl: z.string(),
  correlationId: z.string(),
});

const MediaAudioCompletedSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  executionId: z.string().uuid(),
  audioUrl: z.string(),
  correlationId: z.string(),
});

const AssemblyCompletedSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  executionId: z.string().uuid(),
  videoUrl: z.string(),
  correlationId: z.string(),
});

const AssemblyFailedSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  executionId: z.string().uuid(),
  error: z.string(),
  correlationId: z.string(),
});

const ProgressSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  executionId: z.string().uuid(),
  step: z.string(),
  progress: z.number().min(0).max(100),
  correlationId: z.string(),
});

// --- Inbound event payload types (inferred from Zod) ---

export type AnalysisCompletedEvent = z.infer<typeof AnalysisCompletedSchema>;
export type AnalysisFailedEvent = z.infer<typeof AnalysisFailedSchema>;
export type MediaImageCompletedEvent = z.infer<typeof MediaImageCompletedSchema>;
export type MediaAudioCompletedEvent = z.infer<typeof MediaAudioCompletedSchema>;
export type AssemblyCompletedEvent = z.infer<typeof AssemblyCompletedSchema>;
export type AssemblyFailedEvent = z.infer<typeof AssemblyFailedSchema>;
export type ProgressEvent = z.infer<typeof ProgressSchema>;

@Injectable()
export class NatsSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsSubscriber.name);
  private nc!: NatsConnection;
  private js!: JetStreamClient;
  private consumer: ConsumerMessages | undefined;
  private sc = StringCodec();
  private running = true;
  private workflowService!: WorkflowService;
  private metricsService: MetricsService | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly moduleRef: ModuleRef,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Lazily resolve WorkflowService to avoid circular dependency
    const { WorkflowService: WfService } = await import('../workflow/workflow.service.js');
    this.workflowService = this.moduleRef.get(WfService, { strict: false });

    // Resolve MetricsService (optional — graceful if not available)
    try {
      this.metricsService = this.moduleRef.get(MetricsService, { strict: false });
    } catch {
      // MetricsModule not loaded — metrics disabled
    }

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
    this.logger.error(
      'Subscriber failed to connect to NATS after all retries — consuming unavailable',
    );
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
          this.metricsService?.natsMessagesReceivedTotal.inc({ subject: msg.subject });
          await this.handleMessage(msg.subject, data, msg);
          msg.ack();
        } catch (error) {
          const redeliveryCount = msg.info?.redeliveryCount;
          this.logger.error(
            { subject: msg.subject, error, redeliveryCount },
            redeliveryCount !== undefined && redeliveryCount >= 4
              ? 'Poison message — max redeliveries reached'
              : 'Failed to process message',
          );
          msg.nak();
        }
      }
    } catch (error) {
      if (this.running) {
        this.logger.error({ error }, 'Consumer loop terminated unexpectedly');
      }
    }
  }

  private async handleMessage(
    subject: string,
    data: Record<string, unknown>,
    msg: JsMsg,
  ): Promise<void> {
    switch (subject) {
      case AI_SUBJECTS.ANALYSIS_COMPLETED: {
        const parsed = this.validatePayload(AnalysisCompletedSchema, data, subject, msg);
        if (!parsed) return;
        this.logger.log(
          { subject, executionId: parsed.executionId, correlationId: parsed.correlationId },
          'Handling analysis completed',
        );
        // Store scenes + characters + summary atomically via Prisma transaction
        await this.prisma.$transaction(async (tx) => {
          if (parsed.scenes.length > 0) {
            for (let i = 0; i < parsed.scenes.length; i++) {
              const scene = parsed.scenes[i] as Record<string, unknown>;
              await tx.scene.upsert({
                where: {
                  projectId_order: {
                    projectId: parsed.projectId,
                    order: (scene.order as number) ?? i,
                  },
                },
                update: {
                  text: (scene.text as string) ?? '',
                  description: (scene.description as string) ?? '',
                  imagePrompt: (scene.imagePrompt as string) ?? '',
                  duration: (scene.duration as number) ?? 0,
                  sentiment: (scene.sentiment as string) ?? null,
                },
                create: {
                  projectId: parsed.projectId,
                  order: (scene.order as number) ?? i,
                  text: (scene.text as string) ?? '',
                  description: (scene.description as string) ?? '',
                  imagePrompt: (scene.imagePrompt as string) ?? '',
                  duration: (scene.duration as number) ?? 0,
                  sentiment: (scene.sentiment as string) ?? null,
                },
              });
            }
          }
          if (parsed.characters.length > 0) {
            // Delete existing characters for the project before inserting new ones
            await tx.character.deleteMany({ where: { projectId: parsed.projectId } });
            for (const char of parsed.characters) {
              const c = char as Record<string, unknown>;
              await tx.character.create({
                data: {
                  projectId: parsed.projectId,
                  name: (c.name as string) ?? '',
                  description: (c.description as string) ?? '',
                  aliases: (c.aliases as string[]) ?? [],
                  traits: (c.traits as string[]) ?? [],
                },
              });
            }
          }
        });
        await this.workflowService.handleStepCompleted(parsed.executionId, 'analysis', data);
        break;
      }
      case AI_SUBJECTS.ANALYSIS_FAILED: {
        const parsed = this.validatePayload(AnalysisFailedSchema, data, subject, msg);
        if (!parsed) return;
        this.logger.log(
          { subject, executionId: parsed.executionId, correlationId: parsed.correlationId },
          'Handling analysis failed',
        );
        await this.workflowService.handleStepFailed(parsed.executionId, 'analysis', parsed.error);
        break;
      }
      case AI_SUBJECTS.MEDIA_IMAGE_COMPLETED: {
        const parsed = this.validatePayload(MediaImageCompletedSchema, data, subject, msg);
        if (!parsed) return;
        this.logger.log(
          { subject, executionId: parsed.executionId, correlationId: parsed.correlationId },
          'Handling media image completed',
        );
        // Idempotency: check if scene already has generatedImageUrl set
        const scene = await this.prisma.scene.findUnique({ where: { id: parsed.sceneId } });
        if (scene?.generatedImageUrl) {
          this.logger.log(
            { sceneId: parsed.sceneId, executionId: parsed.executionId },
            'Scene already has generatedImageUrl — skipping duplicate',
          );
          return;
        }
        await this.prisma.scene.update({
          where: { id: parsed.sceneId },
          data: { generatedImageUrl: parsed.imageUrl },
        });
        await this.workflowService.handleStepCompleted(
          parsed.executionId,
          'image_generation',
          data,
        );
        break;
      }
      case AI_SUBJECTS.MEDIA_AUDIO_COMPLETED: {
        const parsed = this.validatePayload(MediaAudioCompletedSchema, data, subject, msg);
        if (!parsed) return;
        this.logger.log(
          { subject, executionId: parsed.executionId, correlationId: parsed.correlationId },
          'Handling media audio completed',
        );
        await this.workflowService.handleStepCompleted(
          parsed.executionId,
          'audio_generation',
          data,
        );
        break;
      }
      case AI_SUBJECTS.ASSEMBLY_COMPLETED: {
        const parsed = this.validatePayload(AssemblyCompletedSchema, data, subject, msg);
        if (!parsed) return;
        this.logger.log(
          { subject, executionId: parsed.executionId, correlationId: parsed.correlationId },
          'Handling assembly completed',
        );
        await this.workflowService.handleStepCompleted(parsed.executionId, 'assembly', data);
        break;
      }
      case AI_SUBJECTS.ASSEMBLY_FAILED: {
        const parsed = this.validatePayload(AssemblyFailedSchema, data, subject, msg);
        if (!parsed) return;
        this.logger.log(
          { subject, executionId: parsed.executionId, correlationId: parsed.correlationId },
          'Handling assembly failed',
        );
        await this.workflowService.handleStepFailed(parsed.executionId, 'assembly', parsed.error);
        break;
      }
      case AI_SUBJECTS.PROGRESS: {
        const parsed = this.validatePayload(ProgressSchema, data, subject, msg);
        if (!parsed) return;
        this.logger.log(
          { subject, executionId: parsed.executionId, correlationId: parsed.correlationId },
          'Handling progress update',
        );
        await this.workflowService.handleProgressUpdate(
          parsed.executionId,
          parsed.step,
          parsed.progress,
        );
        break;
      }
      default:
        this.logger.warn({ subject }, 'Unknown AI subject');
    }
  }

  /**
   * Validate a message payload against a Zod schema.
   * Returns the parsed data on success, or null on failure (after nak + log).
   */
  private validatePayload<T>(
    schema: z.ZodType<T>,
    data: Record<string, unknown>,
    subject: string,
    msg: JsMsg,
  ): T | null {
    const result = schema.safeParse(data);
    if (!result.success) {
      this.logger.error(
        { subject, errors: result.error.issues, rawPayload: data },
        'Inbound message failed Zod validation',
      );
      msg.nak();
      // Throw to skip the ack() in the caller's try block
      throw new Error(`Payload validation failed for ${subject}`);
    }
    return result.data;
  }
}
