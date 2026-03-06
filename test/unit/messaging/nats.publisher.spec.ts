import { NatsPublisher } from '../../../src/messaging/nats.publisher.js';
import { SUBJECTS } from '../../../src/messaging/subjects.js';

function createPublisher() {
  const mockConfig = { NATS_URL: 'nats://localhost:4222', NATS_USER: '', NATS_PASSWORD: '' };
  const publisher = new NatsPublisher(mockConfig as never);

  const mockJs = { publish: vi.fn().mockResolvedValue({ stream: 'test', seq: 1 }) };
  const mockNc = {
    drain: vi.fn().mockResolvedValue(undefined),
    jetstream: vi.fn().mockReturnValue(mockJs),
    jetstreamManager: vi.fn(),
  };
  const mockSc = { encode: vi.fn((s: string) => new TextEncoder().encode(s)) };

  const p = publisher as Record<string, unknown>;
  p.js = mockJs;
  p.nc = mockNc;
  p.sc = mockSc;

  return { publisher, mockJs, mockNc, mockSc };
}

describe('NatsPublisher', () => {
  describe('publishWorkflowStarted', () => {
    it('should publish to WORKFLOW_STARTED subject', async () => {
      const { publisher, mockJs } = createPublisher();
      const payload = {
        projectId: 'p1',
        versionId: 'v1',
        executionId: 'e1',
        userId: 'u1',
        config: {},
        contentText: 'text',
        sceneCount: 3,
        timestamp: '2026-01-01T00:00:00.000Z',
        correlationId: 'c1',
      };

      await publisher.publishWorkflowStarted(payload);

      expect(mockJs.publish).toHaveBeenCalledWith(
        SUBJECTS.WORKFLOW_STARTED,
        expect.any(Uint8Array),
      );
    });
  });

  describe('publishWorkflowStepCompleted', () => {
    it('should publish to WORKFLOW_STEP_COMPLETED subject', async () => {
      const { publisher, mockJs } = createPublisher();
      const payload = {
        projectId: 'p1',
        versionId: 'v1',
        executionId: 'e1',
        userId: 'u1',
        step: 'analysis',
        timestamp: '2026-01-01T00:00:00.000Z',
        correlationId: 'c1',
      };

      await publisher.publishWorkflowStepCompleted(payload);

      expect(mockJs.publish).toHaveBeenCalledWith(
        SUBJECTS.WORKFLOW_STEP_COMPLETED,
        expect.any(Uint8Array),
      );
    });
  });

  describe('publishWorkflowCompleted', () => {
    it('should publish to WORKFLOW_COMPLETED subject', async () => {
      const { publisher, mockJs } = createPublisher();
      const payload = {
        projectId: 'p1',
        versionId: 'v1',
        executionId: 'e1',
        userId: 'u1',
        videoUrl: 'https://example.com/video.mp4',
        timestamp: '2026-01-01T00:00:00.000Z',
        correlationId: 'c1',
      };

      await publisher.publishWorkflowCompleted(payload);

      expect(mockJs.publish).toHaveBeenCalledWith(
        SUBJECTS.WORKFLOW_COMPLETED,
        expect.any(Uint8Array),
      );
    });
  });

  describe('publishWorkflowFailed', () => {
    it('should publish to WORKFLOW_FAILED subject', async () => {
      const { publisher, mockJs } = createPublisher();
      const payload = {
        projectId: 'p1',
        versionId: 'v1',
        executionId: 'e1',
        userId: 'u1',
        step: 'analysis',
        error: 'something went wrong',
        timestamp: '2026-01-01T00:00:00.000Z',
        correlationId: 'c1',
      };

      await publisher.publishWorkflowFailed(payload);

      expect(mockJs.publish).toHaveBeenCalledWith(SUBJECTS.WORKFLOW_FAILED, expect.any(Uint8Array));
    });
  });

  describe('publishWorkflowCancelled', () => {
    it('should publish to WORKFLOW_CANCELLED subject', async () => {
      const { publisher, mockJs } = createPublisher();
      const payload = {
        projectId: 'p1',
        versionId: 'v1',
        executionId: 'e1',
        userId: 'u1',
        timestamp: '2026-01-01T00:00:00.000Z',
        correlationId: 'c1',
      };

      await publisher.publishWorkflowCancelled(payload);

      expect(mockJs.publish).toHaveBeenCalledWith(
        SUBJECTS.WORKFLOW_CANCELLED,
        expect.any(Uint8Array),
      );
    });
  });

  describe('publishProjectDeleted', () => {
    it('should publish to PROJECT_DELETED subject', async () => {
      const { publisher, mockJs } = createPublisher();
      const payload = {
        projectId: 'p1',
        userId: 'u1',
        timestamp: '2026-01-01T00:00:00.000Z',
        correlationId: 'c1',
      };

      await publisher.publishProjectDeleted(payload);

      expect(mockJs.publish).toHaveBeenCalledWith(SUBJECTS.PROJECT_DELETED, expect.any(Uint8Array));
    });
  });

  describe('publishWithRetry', () => {
    it('should retry on failure then succeed', async () => {
      const { publisher, mockJs } = createPublisher();
      // Make setTimeout execute callback immediately to avoid real delays
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
        fn();
        return 0 as never;
      });

      mockJs.publish
        .mockRejectedValueOnce(new Error('connection lost'))
        .mockResolvedValueOnce({ stream: 'test', seq: 2 });

      const payload = {
        projectId: 'p1',
        userId: 'u1',
        timestamp: '2026-01-01T00:00:00.000Z',
        correlationId: 'c1',
      };

      await publisher.publishProjectDeleted(payload);

      expect(mockJs.publish).toHaveBeenCalledTimes(2);
      vi.restoreAllMocks();
    });

    it('should throw after MAX_RETRIES failures', async () => {
      const { publisher, mockJs } = createPublisher();
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
        fn();
        return 0 as never;
      });

      mockJs.publish.mockRejectedValue(new Error('connection lost'));

      const payload = {
        projectId: 'p1',
        userId: 'u1',
        timestamp: '2026-01-01T00:00:00.000Z',
        correlationId: 'c1',
      };

      await expect(publisher.publishProjectDeleted(payload)).rejects.toThrow('connection lost');
      expect(mockJs.publish).toHaveBeenCalledTimes(3);
      vi.restoreAllMocks();
    });
  });

  describe('onModuleDestroy', () => {
    it('should drain the NATS connection', async () => {
      const { publisher, mockNc } = createPublisher();

      await publisher.onModuleDestroy();

      expect(mockNc.drain).toHaveBeenCalled();
    });

    it('should not throw when nc is not set', async () => {
      const mockConfig = { NATS_URL: 'nats://localhost:4222', NATS_USER: '', NATS_PASSWORD: '' };
      const publisher = new NatsPublisher(mockConfig as never);
      // nc is not initialized (undefined via the ! assertion)

      await expect(publisher.onModuleDestroy()).resolves.toBeUndefined();
    });
  });
});
