import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateProjectSchema = z.object({
  title: z.string().min(1).max(200),
  config: z.record(z.unknown()).optional().default({}),
});

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;

export class CreateProjectDtoClass extends createZodDto(CreateProjectSchema) {}
