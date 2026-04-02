import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { ProjectConfigSchema } from '../../common/schemas/project-config.schema.js';

export const CreateAndGenerateSchema = z.object({
  title: z.string().min(1).max(200),
  fileId: z.string().optional(),
  config: ProjectConfigSchema.optional().default({}),
});

export type CreateAndGenerateDto = z.infer<typeof CreateAndGenerateSchema>;

export class CreateAndGenerateDtoClass extends createZodDto(CreateAndGenerateSchema) {}
