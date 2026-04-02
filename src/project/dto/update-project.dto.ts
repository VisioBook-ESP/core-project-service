import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { ProjectConfigSchema } from '../../common/schemas/project-config.schema.js';

export const UpdateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  config: ProjectConfigSchema.partial().optional(),
});

export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;

export class UpdateProjectDtoClass extends createZodDto(UpdateProjectSchema) {}
