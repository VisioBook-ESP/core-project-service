import { NatsSubscriber } from '../../../src/messaging/nats.subscriber.js';
import { AI_SUBJECTS } from '../../../src/messaging/subjects.js';

const UUID1 = '00000000-0000-0000-0000-000000000001';
const UUID2 = '00000000-0000-0000-0000-000000000002';
const UUID3 = '00000000-0000-0000-0000-000000000003';
const UUID4 = '00000000-0000-0000-0000-000000000004';
const CORR = 'corr-001';

function createSubscriber() {
  const mockConfig = { NATS_URL: 'nats://localhost:4222', NATS_USER: '', NATS_PASSWORD: '' };
  const mockModuleRef = {} as never;
  const mockPrisma = {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
      await fn(mockPrisma);
    }),
    scene: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    character: {
      deleteMany: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    location: {
      deleteMany: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: 'loc-uuid-1' }),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    workflowExecution: {
      update: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue({ projectId: UUID1 }),
    },
  };
  const subscriber = new NatsSubscriber(mockConfig as never, mockModuleRef, mockPrisma as never);

  const mockWorkflowService = {
    handleStepCompleted: vi.fn().mockResolvedValue(undefined),
    handleStepFailed: vi.fn().mockResolvedValue(undefined),
    handleProgressUpdate: vi.fn().mockResolvedValue(undefined),
  };
  const s = subscriber as Record<string, unknown>;
  s.workflowService = mockWorkflowService;

  return { subscriber, mockWorkflowService, mockPrisma };
}

// Mock JsMsg for validation
function createMockMsg() {
  return {
    ack: vi.fn(),
    nak: vi.fn(),
    info: { redeliveryCount: 0 },
  };
}

// Helper to call private handleMessage (now takes 3 args: subject, data, msg)
function callHandleMessage(
  subscriber: NatsSubscriber,
  subject: string,
  data: Record<string, unknown>,
  msg?: unknown,
): Promise<void> {
  return (
    subscriber as unknown as Record<string, (...args: unknown[]) => Promise<void>>
  ).handleMessage(subject, data, msg ?? createMockMsg());
}

describe('NatsSubscriber', () => {
  describe('handleMessage', () => {
    it('should route ANALYSIS_COMPLETED to handleStepCompleted with analysis step', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = {
        projectId: UUID1,
        versionId: UUID2,
        executionId: UUID3,
        userId: 'user-1',
        scenes: [],
        characters: [],
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.ANALYSIS_COMPLETED, data);

      expect(mockWorkflowService.handleStepCompleted).toHaveBeenCalledWith(UUID3, 'analysis', data);
    });

    it('should store scenes and characters in analysis completed', async () => {
      const { subscriber, mockPrisma } = createSubscriber();
      const data = {
        projectId: UUID1,
        versionId: UUID2,
        executionId: UUID3,
        userId: 'user-1',
        scenes: [
          { order: 0, text: 'Scene 1', description: 'Desc', imagePrompt: 'prompt', duration: 5 },
        ],
        characters: [{ name: 'Hero', description: 'Main character' }],
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.ANALYSIS_COMPLETED, data);

      expect(mockPrisma.scene.upsert).toHaveBeenCalled();
      expect(mockPrisma.character.deleteMany).toHaveBeenCalledWith({ where: { projectId: UUID1 } });
      expect(mockPrisma.character.create).toHaveBeenCalled();
    });

    it('should route ANALYSIS_FAILED to handleStepFailed with analysis step', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = {
        projectId: UUID1,
        versionId: UUID2,
        executionId: UUID3,
        userId: 'user-1',
        error: 'analysis broke',
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.ANALYSIS_FAILED, data);

      expect(mockWorkflowService.handleStepFailed).toHaveBeenCalledWith(
        UUID3,
        'analysis',
        'analysis broke',
      );
    });

    it('should route MEDIA_IMAGE_COMPLETED to handleStepCompleted with image_generation step', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = {
        projectId: UUID1,
        versionId: UUID2,
        executionId: UUID3,
        sceneId: UUID4,
        imageUrl: 'https://img.url',
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.MEDIA_IMAGE_COMPLETED, data);

      expect(mockWorkflowService.handleStepCompleted).toHaveBeenCalledWith(
        UUID3,
        'image_generation',
        data,
      );
    });

    it('should skip duplicate image if scene already has generatedImageUrl', async () => {
      const { subscriber, mockWorkflowService, mockPrisma } = createSubscriber();
      mockPrisma.scene.findUnique.mockResolvedValue({ generatedImageUrl: 'https://existing.url' });
      const data = {
        projectId: UUID1,
        versionId: UUID2,
        executionId: UUID3,
        sceneId: UUID4,
        imageUrl: 'https://img.url',
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.MEDIA_IMAGE_COMPLETED, data);

      expect(mockPrisma.scene.update).not.toHaveBeenCalled();
      expect(mockWorkflowService.handleStepCompleted).not.toHaveBeenCalled();
    });

    it('should route MEDIA_AUDIO_COMPLETED to handleStepCompleted with audio_generation step', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = {
        projectId: UUID1,
        versionId: UUID2,
        executionId: UUID3,
        audioUrl: 'https://audio.url',
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.MEDIA_AUDIO_COMPLETED, data);

      expect(mockWorkflowService.handleStepCompleted).toHaveBeenCalledWith(
        UUID3,
        'audio_generation',
        data,
      );
    });

    it('should route ASSEMBLY_COMPLETED to handleStepCompleted with assembly step', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = {
        projectId: UUID1,
        versionId: UUID2,
        executionId: UUID3,
        videoUrl: 'https://video.url',
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.ASSEMBLY_COMPLETED, data);

      expect(mockWorkflowService.handleStepCompleted).toHaveBeenCalledWith(UUID3, 'assembly', data);
    });

    it('should route ASSEMBLY_FAILED to handleStepFailed with assembly step', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = {
        projectId: UUID1,
        versionId: UUID2,
        executionId: UUID3,
        error: 'assembly broke',
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.ASSEMBLY_FAILED, data);

      expect(mockWorkflowService.handleStepFailed).toHaveBeenCalledWith(
        UUID3,
        'assembly',
        'assembly broke',
      );
    });

    it('should route PROGRESS to handleProgressUpdate', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = {
        projectId: UUID1,
        versionId: UUID2,
        executionId: UUID3,
        step: 'image_generation',
        progress: 42,
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.PROGRESS, data);

      expect(mockWorkflowService.handleProgressUpdate).toHaveBeenCalledWith(
        UUID3,
        'image_generation',
        42,
      );
    });

    it('should not throw on unknown subject', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = { executionId: UUID1 };

      await expect(
        callHandleMessage(subscriber, 'visiobook.ai.unknown.event', data),
      ).resolves.toBeUndefined();

      expect(mockWorkflowService.handleStepCompleted).not.toHaveBeenCalled();
      expect(mockWorkflowService.handleStepFailed).not.toHaveBeenCalled();
      expect(mockWorkflowService.handleProgressUpdate).not.toHaveBeenCalled();
    });

    it('should throw on invalid payload (Zod validation failure)', async () => {
      const { subscriber } = createSubscriber();
      // Missing required fields for analysis completed
      const data = { executionId: 'not-a-uuid' };

      await expect(
        callHandleMessage(subscriber, AI_SUBJECTS.ANALYSIS_COMPLETED, data),
      ).rejects.toThrow('Payload validation failed');
    });

    it('should store locations and cache analysisPayload on analysis completed', async () => {
      const { subscriber, mockPrisma } = createSubscriber();
      const data = {
        projectId: UUID1,
        versionId: UUID2,
        executionId: UUID3,
        userId: 'user-1',
        scenes: [
          {
            order: 0,
            text: 'S1',
            description: 'D1',
            imagePrompt: 'prompt',
            negativePrompt: 'neg',
            duration: 5,
            locationId: 'forest',
          },
        ],
        characters: [],
        locations: [{ locationId: 'forest', name: 'Dark Forest' }],
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.ANALYSIS_COMPLETED, data);

      expect(mockPrisma.location.deleteMany).toHaveBeenCalledWith({ where: { projectId: UUID1 } });
      expect(mockPrisma.location.create).toHaveBeenCalledWith({
        data: { projectId: UUID1, name: 'Dark Forest' },
      });
      expect(mockPrisma.workflowExecution.update).toHaveBeenCalledWith({
        where: { id: UUID3 },
        data: { analysisPayload: data },
      });
    });

    it('should route REFERENCE_COMPLETED and update character referenceImageUrl', async () => {
      const { subscriber, mockPrisma } = createSubscriber();
      const data = {
        projectId: UUID1,
        executionId: UUID3,
        characterId: UUID4,
        imageUrl: 'https://portrait.url',
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.REFERENCE_COMPLETED, data);

      expect(mockPrisma.character.update).toHaveBeenCalledWith({
        where: { id: UUID4 },
        data: { referenceImageUrl: 'https://portrait.url' },
      });
    });

    it('should route REFERENCE_COMPLETED and update location referenceImageUrl', async () => {
      const { subscriber, mockPrisma } = createSubscriber();
      const data = {
        projectId: UUID1,
        executionId: UUID3,
        locationId: UUID4,
        imageUrl: 'https://location.url',
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.REFERENCE_COMPLETED, data);

      expect(mockPrisma.location.update).toHaveBeenCalledWith({
        where: { id: UUID4 },
        data: { referenceImageUrl: 'https://location.url' },
      });
    });

    it('should complete reference_generation step when all refs are done', async () => {
      const { subscriber, mockWorkflowService, mockPrisma } = createSubscriber();
      // Both counts return 0 => all references done
      mockPrisma.character.count.mockResolvedValue(0);
      mockPrisma.location.count.mockResolvedValue(0);

      const data = {
        projectId: UUID1,
        executionId: UUID3,
        characterId: UUID4,
        imageUrl: 'https://portrait.url',
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.REFERENCE_COMPLETED, data);

      expect(mockWorkflowService.handleStepCompleted).toHaveBeenCalledWith(
        UUID3,
        'reference_generation',
        data,
      );
    });

    it('should route REFERENCE_FAILED to handleStepFailed', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = {
        projectId: UUID1,
        executionId: UUID3,
        error: 'portrait generation failed',
        correlationId: CORR,
      };

      await callHandleMessage(subscriber, AI_SUBJECTS.REFERENCE_FAILED, data);

      expect(mockWorkflowService.handleStepFailed).toHaveBeenCalledWith(
        UUID3,
        'reference_generation',
        'portrait generation failed',
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should drain the NATS connection', async () => {
      const { subscriber } = createSubscriber();
      const mockNc = { drain: vi.fn().mockResolvedValue(undefined) };
      (subscriber as unknown as Record<string, unknown>).nc = mockNc;

      await subscriber.onModuleDestroy();

      expect(mockNc.drain).toHaveBeenCalled();
    });

    it('should close consumer if present', async () => {
      const { subscriber } = createSubscriber();
      const mockConsumer = { close: vi.fn().mockResolvedValue(undefined) };
      const mockNc = { drain: vi.fn().mockResolvedValue(undefined) };
      const s = subscriber as unknown as Record<string, unknown>;
      s.consumer = mockConsumer;
      s.nc = mockNc;

      await subscriber.onModuleDestroy();

      expect(mockConsumer.close).toHaveBeenCalled();
      expect(mockNc.drain).toHaveBeenCalled();
    });
  });
});
