import { NotFoundException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { WorkflowSSEController } from '../../../src/workflow/workflow.sse.controller.js';

function createMocks() {
  const mockWorkflowService = {
    getLatestExecution: vi.fn(),
  };

  const mockEventEmitter = {
    on: vi.fn(),
    off: vi.fn(),
    removeListener: vi.fn(),
  };

  const mockConfig = {
    FEATURE_SSE_ENABLED: true,
  };

  const controller = new WorkflowSSEController(
    mockWorkflowService as never,
    mockEventEmitter as never,
    mockConfig as never,
  );

  return { controller, mockWorkflowService, mockEventEmitter, mockConfig };
}

describe('WorkflowSSEController.streamProgress', () => {
  it('should emit initial state as first SSE event', async () => {
    const { controller, mockWorkflowService } = createMocks();
    const execution = {
      id: 'e1',
      status: 'running',
      currentStep: 'analysis',
      progress: 25,
      steps: [
        { step: 'analysis', status: 'running', progress: 50 },
        { step: 'image_generation', status: 'pending', progress: 0 },
      ],
    };
    mockWorkflowService.getLatestExecution.mockResolvedValue(execution);

    const observable = await controller.streamProgress('u1', 'p1', 'v1');

    // The first emitted event should be the initial snapshot
    const firstEvent = await firstValueFrom(observable);
    expect(firstEvent.data).toEqual({
      executionId: 'e1',
      status: 'running',
      currentStep: 'analysis',
      progress: 25,
      steps: [
        { step: 'analysis', status: 'running', progress: 50 },
        { step: 'image_generation', status: 'pending', progress: 0 },
      ],
    });
  });

  it('should throw NotFoundException when SSE feature is disabled', async () => {
    const { mockWorkflowService, mockEventEmitter } = createMocks();
    const disabledConfig = { FEATURE_SSE_ENABLED: false };
    const controller = new WorkflowSSEController(
      mockWorkflowService as never,
      mockEventEmitter as never,
      disabledConfig as never,
    );

    await expect(controller.streamProgress('u1', 'p1', 'v1')).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when no execution found', async () => {
    const { controller, mockWorkflowService } = createMocks();
    mockWorkflowService.getLatestExecution.mockResolvedValue(null);

    await expect(controller.streamProgress('u1', 'p1', 'v1')).rejects.toThrow(NotFoundException);
  });

  it('should verify ownership via getLatestExecution', async () => {
    const { controller, mockWorkflowService } = createMocks();
    mockWorkflowService.getLatestExecution.mockResolvedValue({
      id: 'e1',
      status: 'running',
      currentStep: 'analysis',
      progress: 0,
      steps: [],
    });

    await controller.streamProgress('u1', 'p1', 'v1');

    expect(mockWorkflowService.getLatestExecution).toHaveBeenCalledWith('p1', 'v1', 'u1');
  });
});
