import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const WorkflowStepSchema = z.object({
  step: z.string(),
  status: z.string(),
  progress: z.number(),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
});

export const WorkflowStatusResponseSchema = z.object({
  executionId: z.string().uuid(),
  versionId: z.string().uuid(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  currentStep: z.string().nullable(),
  progress: z.number().min(0).max(100),
  steps: z.array(WorkflowStepSchema),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
});

export type WorkflowStatusResponseDto = z.infer<typeof WorkflowStatusResponseSchema>;

export class WorkflowStatusResponseDtoClass extends createZodDto(WorkflowStatusResponseSchema) {}
