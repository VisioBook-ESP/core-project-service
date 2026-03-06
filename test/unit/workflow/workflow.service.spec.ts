import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { WorkflowService } from '../../../src/workflow/workflow.service.js';

function createMocks() {
  const mockPrisma = {
    project: { findFirst: vi.fn() },
    projectContent: { findUnique: vi.fn() },
    projectVersion: { findFirst: vi.fn(), update: vi.fn() },
    workflowExecution: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

  const mockQueue = {
    add: vi.fn().mockResolvedValue(undefined),
  };

  const service = new WorkflowService(
    mockPrisma as never,
    mockNatsPublisher as never,
    mockProjectService as never,
    mockUserServiceClient as never,
    mockQueue as never,
  );

  return {
    service,
    mockPrisma,
    mockNatsPublisher,
    mockProjectService,
    mockUserServiceClient,
    mockQueue,
  };
}

describe('WorkflowService', () => {
  describe('startWorkflow', () => {
    it('should start workflow for a draft version with content and quota', async () => {
      const { service, mockPrisma, mockQueue, mockNatsPublisher } = createMocks();

      mockPrisma.projectVersion.findFirst.mockResolvedValue({
        id: 'v1',
        projectId: 'p1',
        status: 'draft',
        config: {},
      });
      mockPrisma.projectContent.findUnique.mockResolvedValue({
        projectId: 'p1',
        text: 'hello world',
      });
      const execution = {
        id: 'e1',
        projectId: 'p1',
        versionId: 'v1',
        status: 'running',
        steps: [],
      };
      mockPrisma.workflowExecution.create.mockResolvedValue(execution);
      mockPrisma.projectVersion.update.mockResolvedValue({ status: 'analyzing' });

      const result = await service.startWorkflow('p1', 'v1', 'u1', 'corr-1');
      expect(result).toBe(execution);
      expect(mockQueue.add).toHaveBeenCalled();
      expect(mockNatsPublisher.publishWorkflowStarted).toHaveBeenCalled();
    });

    it('should throw NotFoundException when version not found', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.projectVersion.findFirst.mockResolvedValue(null);

      await expect(service.startWorkflow('p1', 'v1', 'u1', 'c1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when version is not in draft or failed', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.projectVersion.findFirst.mockResolvedValue({
        id: 'v1',
        status: 'analyzing',
      });

      await expect(service.startWorkflow('p1', 'v1', 'u1', 'c1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when no quota', async () => {
      const { service, mockPrisma, mockUserServiceClient } = createMocks();
      mockPrisma.projectVersion.findFirst.mockResolvedValue({
        id: 'v1',
        status: 'draft',
      });
      mockUserServiceClient.checkQuota.mockResolvedValue({ hasQuota: false, remaining: 0 });

      await expect(service.startWorkflow('p1', 'v1', 'u1', 'c1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ServiceUnavailableException when user service fails', async () => {
      const { service, mockPrisma, mockUserServiceClient } = createMocks();
      mockPrisma.projectVersion.findFirst.mockResolvedValue({
        id: 'v1',
        status: 'draft',
      });
      mockUserServiceClient.checkQuota.mockRejectedValue(new Error('connection refused'));

      await expect(service.startWorkflow('p1', 'v1', 'u1', 'c1')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw BadRequestException when project has no content', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.projectVersion.findFirst.mockResolvedValue({
        id: 'v1',
        status: 'draft',
        config: {},
      });
      mockPrisma.projectContent.findUnique.mockResolvedValue(null);

      await expect(service.startWorkflow('p1', 'v1', 'u1', 'c1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow starting workflow from failed version', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.projectVersion.findFirst.mockResolvedValue({
        id: 'v1',
        projectId: 'p1',
        status: 'failed',
        config: {},
      });
      mockPrisma.projectContent.findUnique.mockResolvedValue({
        projectId: 'p1',
        text: 'content',
      });
      mockPrisma.workflowExecution.create.mockResolvedValue({
        id: 'e1',
        steps: [],
      });
      mockPrisma.projectVersion.update.mockResolvedValue({});

      const result = await service.startWorkflow('p1', 'v1', 'u1', 'c1');
      expect(result).toBeDefined();
    });
  });

  describe('getStatus', () => {
    it('should return execution with steps', async () => {
      const { service, mockPrisma } = createMocks();
      const execution = {
        id: 'e1',
        versionId: 'v1',
        projectId: 'p1',
        steps: [{ step: 'analysis', status: 'completed' }],
      };
      mockPrisma.workflowExecution.findFirst.mockResolvedValue(execution);

      const result = await service.getStatus('p1', 'v1', 'e1', 'u1');
      expect(result).toBe(execution);
    });

    it('should throw NotFoundException when execution not found', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.workflowExecution.findFirst.mockResolvedValue(null);

      await expect(service.getStatus('p1', 'v1', 'e1', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelWorkflow', () => {
    it('should cancel a running workflow', async () => {
      const { service, mockPrisma, mockNatsPublisher } = createMocks();
      const execution = {
        id: 'e1',
        versionId: 'v1',
        projectId: 'p1',
        status: 'running',
        steps: [{ step: 'analysis', status: 'running' }],
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
      expect(mockNatsPublisher.publishWorkflowCancelled).toHaveBeenCalled();
    });

    it('should throw NotFoundException when execution not found', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.workflowExecution.findFirst.mockResolvedValue(null);

      await expect(service.cancelWorkflow('p1', 'v1', 'e1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when execution is not running', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.workflowExecution.findFirst.mockResolvedValue({
        id: 'e1',
        status: 'completed',
        steps: [],
      });

      await expect(service.cancelWorkflow('p1', 'v1', 'e1', 'u1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('handleStepCompleted', () => {
    it('should mark step as completed and enqueue next job', async () => {
      const { service, mockPrisma, mockQueue } = createMocks();
      const execution = {
        id: 'e1',
        projectId: 'p1',
        versionId: 'v1',
        status: 'running',
        steps: [
          { id: 's1', step: 'analysis', status: 'running', progress: 50 },
          { id: 's2', step: 'scene_extraction', status: 'pending', progress: 0 },
          { id: 's3', step: 'character_extraction', status: 'pending', progress: 0 },
          { id: 's4', step: 'image_generation', status: 'pending', progress: 0 },
          { id: 's5', step: 'audio_generation', status: 'pending', progress: 0 },
          { id: 's6', step: 'assembly', status: 'pending', progress: 0 },
        ],
      };
      mockPrisma.workflowExecution.findFirst
        .mockResolvedValueOnce(execution)
        .mockResolvedValueOnce({ ...execution, status: 'running', steps: execution.steps });
      mockPrisma.workflowStep.update.mockResolvedValue({});
      mockPrisma.workflowExecution.update.mockResolvedValue({});

      await service.handleStepCompleted('e1', 'analysis');

      expect(mockPrisma.workflowStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1' },
          data: expect.objectContaining({ status: 'completed', progress: 100 }),
        }),
      );
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should complete workflow when last step finishes', async () => {
      const { service, mockPrisma, mockNatsPublisher } = createMocks();
      const execution = {
        id: 'e1',
        projectId: 'p1',
        versionId: 'v1',
        status: 'running',
        steps: [
          { id: 's1', step: 'analysis', status: 'completed', progress: 100 },
          { id: 's2', step: 'scene_extraction', status: 'completed', progress: 100 },
          { id: 's3', step: 'character_extraction', status: 'completed', progress: 100 },
          { id: 's4', step: 'image_generation', status: 'completed', progress: 100 },
          { id: 's5', step: 'audio_generation', status: 'completed', progress: 100 },
          { id: 's6', step: 'assembly', status: 'running', progress: 50 },
        ],
      };
      mockPrisma.workflowExecution.findFirst
        .mockResolvedValueOnce(execution)
        .mockResolvedValueOnce(null); // second call for progress recalculation
      mockPrisma.workflowStep.update.mockResolvedValue({});
      mockPrisma.workflowExecution.update.mockResolvedValue({});
      mockPrisma.projectVersion.update.mockResolvedValue({});

      await service.handleStepCompleted('e1', 'assembly');

      expect(mockNatsPublisher.publishWorkflowCompleted).toHaveBeenCalled();
    });

    it('should silently return when execution not found', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.workflowExecution.findFirst.mockResolvedValue(null);

      await expect(service.handleStepCompleted('e1', 'analysis')).resolves.toBeUndefined();
    });

    it('should silently return when execution is not running', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.workflowExecution.findFirst.mockResolvedValue({
        id: 'e1',
        status: 'cancelled',
        steps: [],
      });

      await expect(service.handleStepCompleted('e1', 'analysis')).resolves.toBeUndefined();
    });
  });

  describe('handleStepFailed', () => {
    it('should mark step as failed and update execution to failed', async () => {
      const { service, mockPrisma, mockNatsPublisher } = createMocks();
      const execution = {
        id: 'e1',
        projectId: 'p1',
        versionId: 'v1',
        status: 'running',
        steps: [{ id: 's1', step: 'analysis', status: 'running', progress: 50 }],
      };
      mockPrisma.workflowExecution.findFirst.mockResolvedValue(execution);
      mockPrisma.workflowStep.update.mockResolvedValue({});
      mockPrisma.workflowExecution.update.mockResolvedValue({});
      mockPrisma.projectVersion.update.mockResolvedValue({});

      await service.handleStepFailed('e1', 'analysis', 'AI model error');

      expect(mockPrisma.workflowStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1' },
          data: expect.objectContaining({ status: 'failed' }),
        }),
      );
      expect(mockPrisma.workflowExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
            error: { step: 'analysis', message: 'AI model error' },
          }),
        }),
      );
      expect(mockNatsPublisher.publishWorkflowFailed).toHaveBeenCalled();
    });

    it('should silently return when execution not found', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.workflowExecution.findFirst.mockResolvedValue(null);

      await expect(service.handleStepFailed('e1', 'analysis', 'error')).resolves.toBeUndefined();
    });
  });
});
