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
import { CacheService } from '../common/cache/cache.service.js';
import type { Prisma } from '../generated/prisma/client.js';
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
  locations: z.array(z.unknown()).optional().default([]),
  correlationId: z.string(),
});

const ReferenceCompletedSchema = z.object({
  projectId: z.string().uuid(),
  executionId: z.string().uuid(),
  characterId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  imageUrl: z.string(),
  correlationId: z.string(),
});

const ReferenceFailedSchema = z.object({
  projectId: z.string().uuid(),
  executionId: z.string().uuid(),
  error: z.string(),
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
export type ReferenceCompletedEvent = z.infer<typeof ReferenceCompletedSchema>;
export type ReferenceFailedEvent = z.infer<typeof ReferenceFailedSchema>;
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
  private cacheService: CacheService | undefined;

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

    // Resolve CacheService (optional — graceful if not available)
    try {
      this.cacheService = this.moduleRef.get(CacheService, { strict: false });
    } catch {
      // CacheModule not loaded
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

        // Build a locationId lookup: locationId string → DB uuid
        const locationIdMap = new Map<string, string>();

        // Store scenes + characters + locations + dialogues + analysisPayload atomically
        const locations = parsed.locations ?? [];
        await this.prisma.$transaction(async (tx) => {
          // --- Locations ---
          if (locations.length > 0) {
            await tx.location.deleteMany({ where: { projectId: parsed.projectId } });
            for (const loc of locations) {
              const l = loc as Record<string, unknown>;
              const created = await tx.location.create({
                data: {
                  projectId: parsed.projectId,
                  name: (l.name as string) ?? '',
                },
              });
              const locId = (l.locationId as string) ?? '';
              if (locId) {
                locationIdMap.set(locId, created.id);
              }
            }
          }

          // --- Dialogues: delete all for idempotency before re-creating ---
          await tx.dialogue.deleteMany({ where: { projectId: parsed.projectId } });

          // --- Scenes ---
          if (parsed.scenes.length > 0) {
            for (let i = 0; i < parsed.scenes.length; i++) {
              const scene = parsed.scenes[i] as Record<string, unknown>;
              const sceneLocationId = scene.locationId
                ? (locationIdMap.get(scene.locationId as string) ?? null)
                : null;
              const sceneOrder = (scene.order as number) ?? i;
              const upsertedScene = await tx.scene.upsert({
                where: {
                  projectId_order: {
                    projectId: parsed.projectId,
                    order: sceneOrder,
                  },
                },
                update: {
                  text: (scene.text as string) ?? '',
                  description: (scene.description as string) ?? '',
                  imagePrompt: (scene.imagePrompt as string) ?? '',
                  negativePrompt: (scene.negativePrompt as string) ?? null,
                  duration: (scene.duration as number) ?? 0,
                  sentiment: (scene.sentiment as string) ?? null,
                  locationId: sceneLocationId,
                  sceneType: (scene.sceneType as string) ?? null,
                  audioPrompt: (scene.audioPrompt as string) ?? null,
                  narrationText: (scene.narrationText as string) ?? null,
                },
                create: {
                  projectId: parsed.projectId,
                  order: sceneOrder,
                  text: (scene.text as string) ?? '',
                  description: (scene.description as string) ?? '',
                  imagePrompt: (scene.imagePrompt as string) ?? '',
                  negativePrompt: (scene.negativePrompt as string) ?? null,
                  duration: (scene.duration as number) ?? 0,
                  sentiment: (scene.sentiment as string) ?? null,
                  locationId: sceneLocationId,
                  sceneType: (scene.sceneType as string) ?? null,
                  audioPrompt: (scene.audioPrompt as string) ?? null,
                  narrationText: (scene.narrationText as string) ?? null,
                },
              });

              // --- Dialogues for this scene ---
              const dialogues = (scene.dialogues as Array<Record<string, unknown>>) ?? [];
              for (let d = 0; d < dialogues.length; d++) {
                const dlg = dialogues[d];
                await tx.dialogue.create({
                  data: {
                    sceneId: upsertedScene.id,
                    projectId: parsed.projectId,
                    order: d,
                    speaker: (dlg.speaker as string) ?? '',
                    line: (dlg.line as string) ?? '',
                    delivery: (dlg.delivery as string) ?? 'neutral',
                    context: (dlg.context as string) ?? null,
                  },
                });
              }
            }
          }

          // --- Characters ---
          if (parsed.characters.length > 0) {
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
                  voiceDescription: (c.voiceDescription as string) ?? null,
                },
              });
            }
          }

          // --- Cache analysis payload on execution for downstream dispatch ---
          await tx.workflowExecution.update({
            where: { id: parsed.executionId },
            data: { analysisPayload: data as Prisma.InputJsonValue },
          });
        });

        await this.cacheService?.del('summary:' + parsed.projectId);
        await this.cacheService?.del('content:' + parsed.projectId);
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
      case AI_SUBJECTS.REFERENCE_COMPLETED: {
        const parsed = this.validatePayload(ReferenceCompletedSchema, data, subject, msg);
        if (!parsed) return;
        this.logger.log(
          { subject, executionId: parsed.executionId, correlationId: parsed.correlationId },
          'Handling reference completed',
        );

        if (parsed.characterId) {
          await this.prisma.character.update({
            where: { id: parsed.characterId },
            data: { referenceImageUrl: parsed.imageUrl },
          });
        }
        if (parsed.locationId) {
          await this.prisma.location.update({
            where: { id: parsed.locationId },
            data: { referenceImageUrl: parsed.imageUrl },
          });
        }

        // Check if all references for this project are done
        const execution = await this.prisma.workflowExecution.findFirst({
          where: { id: parsed.executionId },
        });
        if (execution) {
          const missingCharRefs = await this.prisma.character.count({
            where: { projectId: execution.projectId, referenceImageUrl: null },
          });
          const missingLocRefs = await this.prisma.location.count({
            where: { projectId: execution.projectId, referenceImageUrl: null },
          });

          if (missingCharRefs === 0 && missingLocRefs === 0) {
            await this.workflowService.handleStepCompleted(
              parsed.executionId,
              'reference_generation',
              data,
            );
          } else {
            this.logger.debug(
              { executionId: parsed.executionId, missingCharRefs, missingLocRefs },
              'Waiting for remaining references',
            );
          }
        }
        break;
      }
      case AI_SUBJECTS.REFERENCE_FAILED: {
        const parsed = this.validatePayload(ReferenceFailedSchema, data, subject, msg);
        if (!parsed) return;
        this.logger.log(
          { subject, executionId: parsed.executionId, correlationId: parsed.correlationId },
          'Handling reference failed',
        );
        await this.workflowService.handleStepFailed(
          parsed.executionId,
          'reference_generation',
          parsed.error,
        );
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
