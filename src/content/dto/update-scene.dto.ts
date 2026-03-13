import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateSceneSchema = z.object({
  text: z.string().optional(),
  description: z.string().optional(),
  imagePrompt: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

export type UpdateSceneDto = z.infer<typeof UpdateSceneSchema>;

export class UpdateSceneDtoClass extends createZodDto(UpdateSceneSchema) {}
