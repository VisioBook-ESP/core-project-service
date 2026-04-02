import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { ProjectConfigSchema } from '../../common/schemas/project-config.schema.js';

export const CreateVersionSchema = z.object({
  config: ProjectConfigSchema.optional(),
});

export type CreateVersionDto = z.infer<typeof CreateVersionSchema>;

export class CreateVersionDtoClass extends createZodDto(CreateVersionSchema) {}
