import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const StartWorkflowSchema = z.object({
  correlationId: z.string().uuid().optional(),
});

export type StartWorkflowDto = z.infer<typeof StartWorkflowSchema>;

export class StartWorkflowDtoClass extends createZodDto(StartWorkflowSchema) {}
