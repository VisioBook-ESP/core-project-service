import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ProjectResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  status: z.enum(['draft', 'active', 'archived']),
  config: z.record(z.unknown()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ProjectResponseDto = z.infer<typeof ProjectResponseSchema>;

export class ProjectResponseDtoClass extends createZodDto(ProjectResponseSchema) {}
