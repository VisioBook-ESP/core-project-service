import { NatsSubscriber } from '../../../src/messaging/nats.subscriber.js';
import { AI_SUBJECTS } from '../../../src/messaging/subjects.js';

function createSubscriber() {
  const mockConfig = { NATS_URL: 'nats://localhost:4222', NATS_USER: '', NATS_PASSWORD: '' };
  const mockModuleRef = {} as never;
  const subscriber = new NatsSubscriber(mockConfig as never, mockModuleRef);

  const mockWorkflowService = {
    handleStepCompleted: vi.fn().mockResolvedValue(undefined),
    handleStepFailed: vi.fn().mockResolvedValue(undefined),
    handleProgressUpdate: vi.fn().mockResolvedValue(undefined),
  };
  const s = subscriber as Record<string, unknown>;
  s.workflowService = mockWorkflowService;

  return { subscriber, mockWorkflowService };
}

// Helper to call private handleMessage
function callHandleMessage(
  subscriber: NatsSubscriber,
  subject: string,
  data: Record<string, unknown>,
): Promise<void> {
  return (subscriber as unknown as Record<string, (...args: unknown[]) => Promise<void>>).handleMessage(subject, data);
}

describe('NatsSubscriber', () => {
  describe('handleMessage', () => {
    it('should route ANALYSIS_COMPLETED to handleStepCompleted with analysis step', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = { executionId: 'e1', scenes: [], characters: [] };

      await callHandleMessage(subscriber,AI_SUBJECTS.ANALYSIS_COMPLETED, data);

      expect(mockWorkflowService.handleStepCompleted).toHaveBeenCalledWith('e1', 'analysis', data);
    });

    it('should route ANALYSIS_FAILED to handleStepFailed with analysis step', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = { executionId: 'e1', error: 'analysis broke' };

      await callHandleMessage(subscriber,AI_SUBJECTS.ANALYSIS_FAILED, data);

      expect(mockWorkflowService.handleStepFailed).toHaveBeenCalledWith(
        'e1',
        'analysis',
        'analysis broke',
      );
    });

    it('should route MEDIA_IMAGE_COMPLETED to handleStepCompleted with image_generation step', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = { executionId: 'e1', sceneId: 's1', imageUrl: 'https://img.url' };

      await callHandleMessage(subscriber,AI_SUBJECTS.MEDIA_IMAGE_COMPLETED, data);

      expect(mockWorkflowService.handleStepCompleted).toHaveBeenCalledWith(
        'e1',
        'image_generation',
        data,
      );
    });

    it('should route MEDIA_AUDIO_COMPLETED to handleStepCompleted with audio_generation step', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = { executionId: 'e1', audioUrl: 'https://audio.url' };

      await callHandleMessage(subscriber,AI_SUBJECTS.MEDIA_AUDIO_COMPLETED, data);

      expect(mockWorkflowService.handleStepCompleted).toHaveBeenCalledWith(
        'e1',
        'audio_generation',
        data,
      );
    });

    it('should route ASSEMBLY_COMPLETED to handleStepCompleted with assembly step', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = { executionId: 'e1', videoUrl: 'https://video.url' };

      await callHandleMessage(subscriber,AI_SUBJECTS.ASSEMBLY_COMPLETED, data);

      expect(mockWorkflowService.handleStepCompleted).toHaveBeenCalledWith(
        'e1',
        'assembly',
        data,
      );
    });

    it('should route ASSEMBLY_FAILED to handleStepFailed with assembly step', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = { executionId: 'e1', error: 'assembly broke' };

      await callHandleMessage(subscriber,AI_SUBJECTS.ASSEMBLY_FAILED, data);

      expect(mockWorkflowService.handleStepFailed).toHaveBeenCalledWith(
        'e1',
        'assembly',
        'assembly broke',
      );
    });

    it('should route PROGRESS to handleProgressUpdate', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = { executionId: 'e1', step: 'image_generation', progress: 42 };

      await callHandleMessage(subscriber,AI_SUBJECTS.PROGRESS, data);

      expect(mockWorkflowService.handleProgressUpdate).toHaveBeenCalledWith(
        'e1',
        'image_generation',
        42,
      );
    });

    it('should not throw on unknown subject', async () => {
      const { subscriber, mockWorkflowService } = createSubscriber();
      const data = { executionId: 'e1' };

      await expect(
        callHandleMessage(subscriber, 'visiobook.ai.unknown.event', data),
      ).resolves.toBeUndefined();

      expect(mockWorkflowService.handleStepCompleted).not.toHaveBeenCalled();
      expect(mockWorkflowService.handleStepFailed).not.toHaveBeenCalled();
      expect(mockWorkflowService.handleProgressUpdate).not.toHaveBeenCalled();
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
