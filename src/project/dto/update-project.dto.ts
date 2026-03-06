import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
});

export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;

export class UpdateProjectDtoClass extends createZodDto(UpdateProjectSchema) {}
