import { StartWorkflowSchema } from '../../../src/workflow/dto/start-workflow.dto.js';
import { WorkflowStatusResponseSchema } from '../../../src/workflow/dto/workflow-status-response.dto.js';

describe('StartWorkflowSchema', () => {
  it('should accept empty object (correlationId is optional)', () => {
    const result = StartWorkflowSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid correlationId', () => {
    const result = StartWorkflowSchema.safeParse({
      correlationId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.correlationId).toBe('550e8400-e29b-41d4-a716-446655440000');
    }
  });

  it('should reject non-UUID correlationId', () => {
    const result = StartWorkflowSchema.safeParse({ correlationId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('WorkflowStatusResponseSchema', () => {
  const validResponse = {
    executionId: '550e8400-e29b-41d4-a716-446655440000',
    versionId: '550e8400-e29b-41d4-a716-446655440001',
    status: 'running' as const,
    currentStep: 'analysis',
    progress: 25,
    steps: [
      {
        step: 'analysis',
        status: 'running',
        progress: 50,
        startedAt: '2025-01-01T00:00:00Z',
        completedAt: null,
      },
    ],
    startedAt: '2025-01-01T00:00:00Z',
    completedAt: null,
  };

  it('should accept valid response', () => {
    const result = WorkflowStatusResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it('should coerce date strings to Date objects', () => {
    const result = WorkflowStatusResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startedAt).toBeInstanceOf(Date);
      expect(result.data.steps[0].startedAt).toBeInstanceOf(Date);
    }
  });

  it('should accept all valid status values', () => {
    for (const status of ['pending', 'running', 'completed', 'failed', 'cancelled']) {
      const result = WorkflowStatusResponseSchema.safeParse({ ...validResponse, status });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid status', () => {
    const result = WorkflowStatusResponseSchema.safeParse({
      ...validResponse,
      status: 'paused',
    });
    expect(result.success).toBe(false);
  });

  it('should reject progress below 0', () => {
    const result = WorkflowStatusResponseSchema.safeParse({
      ...validResponse,
      progress: -1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject progress above 100', () => {
    const result = WorkflowStatusResponseSchema.safeParse({
      ...validResponse,
      progress: 101,
    });
    expect(result.success).toBe(false);
  });

  it('should accept null currentStep', () => {
    const result = WorkflowStatusResponseSchema.safeParse({
      ...validResponse,
      currentStep: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty steps array', () => {
    const result = WorkflowStatusResponseSchema.safeParse({
      ...validResponse,
      steps: [],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID for executionId', () => {
    const result = WorkflowStatusResponseSchema.safeParse({
      ...validResponse,
      executionId: 'bad',
    });
    expect(result.success).toBe(false);
  });
});
