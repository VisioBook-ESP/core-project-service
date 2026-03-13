import { NotFoundException, ConflictException } from '@nestjs/common';
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
    mockProjectService,
    mockQueue,
    mockEventEmitter,
  };
}

describe('WorkflowService.cancelWorkflow', () => {
  it('should cancel a running workflow and update DB', async () => {
    const { service, mockPrisma } = createMocks();
    const execution = {
      id: 'e1',
      versionId: 'v1',
      projectId: 'p1',
      status: 'running',
      progress: 30,
      steps: [
        { step: 'analysis', status: 'completed', progress: 100 },
        { step: 'image_generation', status: 'running', progress: 50 },
        { step: 'audio_generation', status: 'pending', progress: 0 },
      ],
    };
    mockPrisma.workflowExecution.findFirst.mockResolvedValue(execution);
    mockPrisma.workflowExecution.update.mockResolvedValue({});
    mockPrisma.workflowStep.updateMany.mockResolvedValue({});
    mockPrisma.projectVersion.update.mockResolvedValue({});

    await service.cancelWorkflow('p1', 'v1', 'e1', 'u1', 'corr-1');

    expect(mockPrisma.workflowExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1' },
        data: expect.objectContaining({ status: 'cancelled' }),
      }),
    );
    expect(mockPrisma.workflowStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          executionId: 'e1',
          status: { in: ['pending', 'running'] },
        },
        data: { status: 'skipped' },
      }),
    );
    expect(mockPrisma.projectVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v1' },
        data: { status: 'cancelled' },
      }),
    );
  });

  it('should remove pending BullMQ jobs for the execution', async () => {
    const { service, mockPrisma, mockQueue } = createMocks();
    const matchingJob = { id: 'j1', data: { executionId: 'e1' }, remove: vi.fn() };
    const otherJob = { id: 'j2', data: { executionId: 'e-other' }, remove: vi.fn() };
    mockQueue.getJobs.mockResolvedValue([matchingJob, otherJob]);

    mockPrisma.workflowExecution.findFirst.mockResolvedValue({
      id: 'e1',
      versionId: 'v1',
      projectId: 'p1',
      status: 'running',
      progress: 0,
      steps: [],
    });
    mockPrisma.workflowExecution.update.mockResolvedValue({});
    mockPrisma.workflowStep.updateMany.mockResolvedValue({});
    mockPrisma.projectVersion.update.mockResolvedValue({});

    await service.cancelWorkflow('p1', 'v1', 'e1', 'u1');

    expect(matchingJob.remove).toHaveBeenCalled();
    expect(otherJob.remove).not.toHaveBeenCalled();
  });

  it('should publish workflow cancelled event via NATS', async () => {
    const { service, mockPrisma, mockNatsPublisher } = createMocks();
    mockPrisma.workflowExecution.findFirst.mockResolvedValue({
      id: 'e1',
      versionId: 'v1',
      projectId: 'p1',
      status: 'running',
      progress: 0,
      steps: [],
    });
    mockPrisma.workflowExecution.update.mockResolvedValue({});
    mockPrisma.workflowStep.updateMany.mockResolvedValue({});
    mockPrisma.projectVersion.update.mockResolvedValue({});

    await service.cancelWorkflow('p1', 'v1', 'e1', 'u1', 'corr-1');

    expect(mockNatsPublisher.publishWorkflowCancelled).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'p1',
        versionId: 'v1',
        executionId: 'e1',
        userId: 'u1',
        correlationId: 'corr-1',
      }),
    );
  });

  it('should emit progress event with cancelled status', async () => {
    const { service, mockPrisma, mockEventEmitter } = createMocks();
    mockPrisma.workflowExecution.findFirst.mockResolvedValue({
      id: 'e1',
      versionId: 'v1',
      projectId: 'p1',
      status: 'running',
      progress: 25,
      steps: [
        { step: 'analysis', status: 'completed', progress: 100 },
        { step: 'image_generation', status: 'running', progress: 50 },
      ],
    });
    mockPrisma.workflowExecution.update.mockResolvedValue({});
    mockPrisma.workflowStep.updateMany.mockResolvedValue({});
    mockPrisma.projectVersion.update.mockResolvedValue({});

    await service.cancelWorkflow('p1', 'v1', 'e1', 'u1');

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'workflow.progress.v1',
      expect.objectContaining({
        executionId: 'e1',
        status: 'cancelled',
      }),
    );
  });

  it('should throw NotFoundException when execution not found', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.workflowExecution.findFirst.mockResolvedValue(null);

    await expect(service.cancelWorkflow('p1', 'v1', 'e1', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException when execution is not running (409)', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.workflowExecution.findFirst.mockResolvedValue({
      id: 'e1',
      status: 'completed',
      steps: [],
    });

    await expect(service.cancelWorkflow('p1', 'v1', 'e1', 'u1')).rejects.toThrow(ConflictException);
  });

  it('should throw ConflictException for already-cancelled execution', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.workflowExecution.findFirst.mockResolvedValue({
      id: 'e1',
      status: 'cancelled',
      steps: [],
    });

    await expect(service.cancelWorkflow('p1', 'v1', 'e1', 'u1')).rejects.toThrow(ConflictException);
  });
});
