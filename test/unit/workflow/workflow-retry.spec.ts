import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { WorkflowService } from '../../../src/workflow/workflow.service.js';

function createMocks() {
  const mockPrisma = {
    project: { findFirst: vi.fn(), findUnique: vi.fn().mockResolvedValue({ userId: 'u1' }) },
    projectContent: { findUnique: vi.fn() },
    projectVersion: { findFirst: vi.fn(), update: vi.fn() },
    workflowExecution: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    workflowStep: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
  };

  const mockNatsPublisher = {
    publishWorkflowStarted: vi.fn().mockResolvedValue(undefined),
    publishWorkflowCompleted: vi.fn().mockResolvedValue(undefined),
    publishWorkflowFailed: vi.fn().mockResolvedValue(undefined),
    publishWorkflowCancelled: vi.fn().mockResolvedValue(undefined),
    publishWorkflowStepCompleted: vi.fn().mockResolvedValue(undefined),
  };

  const mockProjectService = {
    ensureOwnership: vi.fn().mockResolvedValue({ id: 'p1', userId: 'u1' }),
  };

  const mockUserServiceClient = {
    checkQuota: vi.fn().mockResolvedValue({ hasQuota: true, remaining: 10 }),
  };

  const mockNotificationClient = {
    sendNotification: vi.fn().mockResolvedValue(undefined),
  };

  const mockMetricsService = {
    workflowExecutionsTotal: { inc: vi.fn() },
  };

  const mockEventEmitter = {
    emit: vi.fn(),
  };

  const mockConfig = {
    BULLMQ_MAX_RETRIES: 3,
    FEATURE_SSE_ENABLED: true,
  };

  const mockQueue = {
    add: vi.fn().mockResolvedValue(undefined),
    getJobs: vi.fn().mockResolvedValue([]),
  };

  const service = new WorkflowService(
    mockPrisma as never,
    mockNatsPublisher as never,
    mockProjectService as never,
    mockUserServiceClient as never,
    mockNotificationClient as never,
    mockMetricsService as never,
    mockEventEmitter as never,
    mockConfig as never,
    mockQueue as never,
  );

  return {
    service,
    mockPrisma,
    mockNatsPublisher,
    mockQueue,
    mockConfig,
  };
}

describe('WorkflowService.retryWorkflow', () => {
  it('should create new execution and enqueue from the first failed step', async () => {
    const { service, mockPrisma, mockQueue, mockNatsPublisher } = createMocks();

    const latestExecution = {
      id: 'e1',
      projectId: 'p1',
      versionId: 'v1',
      status: 'failed',
      steps: [
        { step: 'analysis', status: 'completed' },
        { step: 'scene_extraction', status: 'completed' },
        { step: 'character_extraction', status: 'completed' },
        { step: 'reference_generation', status: 'completed' },
        { step: 'image_generation', status: 'failed' },
        { step: 'audio_generation', status: 'pending' },
        { step: 'assembly', status: 'pending' },
      ],
    };
    mockPrisma.workflowExecution.findFirst.mockResolvedValue(latestExecution);
    mockPrisma.workflowExecution.count.mockResolvedValue(1);

    const newExecution = {
      id: 'e2',
      projectId: 'p1',
      versionId: 'v1',
      status: 'running',
      steps: [],
    };
    mockPrisma.workflowExecution.create.mockResolvedValue(newExecution);
    mockPrisma.projectVersion.update.mockResolvedValue({});

    const result = await service.retryWorkflow('p1', 'v1', 'u1', 'corr-1');

    expect(result).toBe(newExecution);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'workflow:image-generation',
      expect.objectContaining({
        projectId: 'p1',
        versionId: 'v1',
        executionId: 'e2',
        step: 'image_generation',
      }),
    );
    expect(mockNatsPublisher.publishWorkflowStarted).toHaveBeenCalled();
  });

  it('should skip already-completed steps in the new execution', async () => {
    const { service, mockPrisma } = createMocks();

    mockPrisma.workflowExecution.findFirst.mockResolvedValue({
      id: 'e1',
      projectId: 'p1',
      versionId: 'v1',
      status: 'failed',
      steps: [
        { step: 'analysis', status: 'completed' },
        { step: 'scene_extraction', status: 'completed' },
        { step: 'character_extraction', status: 'completed' },
        { step: 'reference_generation', status: 'completed' },
        { step: 'image_generation', status: 'failed' },
        { step: 'audio_generation', status: 'pending' },
        { step: 'assembly', status: 'pending' },
      ],
    });
    mockPrisma.workflowExecution.count.mockResolvedValue(1);
    mockPrisma.workflowExecution.create.mockResolvedValue({ id: 'e2', steps: [] });
    mockPrisma.projectVersion.update.mockResolvedValue({});

    await service.retryWorkflow('p1', 'v1', 'u1', 'corr-1');

    expect(mockPrisma.workflowExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          steps: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ step: 'analysis', status: 'completed', progress: 100 }),
              expect.objectContaining({ step: 'image_generation', status: 'pending', progress: 0 }),
            ]),
          }),
        }),
      }),
    );
  });

  it('should enqueue from analysis when it failed at first step', async () => {
    const { service, mockPrisma, mockQueue } = createMocks();

    mockPrisma.workflowExecution.findFirst.mockResolvedValue({
      id: 'e1',
      projectId: 'p1',
      versionId: 'v1',
      status: 'failed',
      steps: [
        { step: 'analysis', status: 'failed' },
        { step: 'scene_extraction', status: 'pending' },
        { step: 'character_extraction', status: 'pending' },
        { step: 'reference_generation', status: 'pending' },
        { step: 'image_generation', status: 'pending' },
        { step: 'audio_generation', status: 'pending' },
        { step: 'assembly', status: 'pending' },
      ],
    });
    mockPrisma.workflowExecution.count.mockResolvedValue(1);
    mockPrisma.workflowExecution.create.mockResolvedValue({ id: 'e2', steps: [] });
    mockPrisma.projectVersion.update.mockResolvedValue({});

    await service.retryWorkflow('p1', 'v1', 'u1', 'corr-1');

    expect(mockQueue.add).toHaveBeenCalledWith(
      'workflow:analysis',
      expect.objectContaining({ step: 'analysis' }),
    );
  });

  it('should throw ConflictException when latest execution is not failed', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.workflowExecution.findFirst.mockResolvedValue({
      id: 'e1',
      status: 'running',
      steps: [],
    });

    await expect(service.retryWorkflow('p1', 'v1', 'u1', 'c1')).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when no execution exists', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.workflowExecution.findFirst.mockResolvedValue(null);

    await expect(service.retryWorkflow('p1', 'v1', 'u1', 'c1')).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when max retries exceeded', async () => {
    const { service, mockPrisma, mockConfig } = createMocks();
    mockConfig.BULLMQ_MAX_RETRIES = 3;

    mockPrisma.workflowExecution.findFirst.mockResolvedValue({
      id: 'e1',
      status: 'failed',
      steps: [{ step: 'analysis', status: 'failed' }],
    });
    mockPrisma.workflowExecution.count.mockResolvedValue(4); // > maxRetries

    await expect(service.retryWorkflow('p1', 'v1', 'u1', 'c1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should set version status to analyzing when retrying from first step', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.workflowExecution.findFirst.mockResolvedValue({
      id: 'e1',
      projectId: 'p1',
      versionId: 'v1',
      status: 'failed',
      steps: [
        { step: 'analysis', status: 'failed' },
        { step: 'scene_extraction', status: 'pending' },
        { step: 'character_extraction', status: 'pending' },
        { step: 'reference_generation', status: 'pending' },
        { step: 'image_generation', status: 'pending' },
        { step: 'audio_generation', status: 'pending' },
        { step: 'assembly', status: 'pending' },
      ],
    });
    mockPrisma.workflowExecution.count.mockResolvedValue(1);
    mockPrisma.workflowExecution.create.mockResolvedValue({ id: 'e2', steps: [] });
    mockPrisma.projectVersion.update.mockResolvedValue({});

    await service.retryWorkflow('p1', 'v1', 'u1', 'c1');

    expect(mockPrisma.projectVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'analyzing' },
      }),
    );
  });

  it('should set version status to generating when retrying from a later step', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.workflowExecution.findFirst.mockResolvedValue({
      id: 'e1',
      projectId: 'p1',
      versionId: 'v1',
      status: 'failed',
      steps: [
        { step: 'analysis', status: 'completed' },
        { step: 'scene_extraction', status: 'completed' },
        { step: 'character_extraction', status: 'completed' },
        { step: 'reference_generation', status: 'completed' },
        { step: 'image_generation', status: 'completed' },
        { step: 'audio_generation', status: 'failed' },
        { step: 'assembly', status: 'pending' },
      ],
    });
    mockPrisma.workflowExecution.count.mockResolvedValue(1);
    mockPrisma.workflowExecution.create.mockResolvedValue({ id: 'e2', steps: [] });
    mockPrisma.projectVersion.update.mockResolvedValue({});

    await service.retryWorkflow('p1', 'v1', 'u1', 'c1');

    expect(mockPrisma.projectVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'generating' },
      }),
    );
  });
});
