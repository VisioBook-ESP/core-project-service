import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SceneResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  order: z.number(),
  text: z.string(),
  description: z.string(),
  imagePrompt: z.string(),
  generatedImageUrl: z.string().nullable(),
  duration: z.number(),
  sentiment: z.string().nullable(),
});

export type SceneResponseDto = z.infer<typeof SceneResponseSchema>;

export class SceneResponseDtoClass extends createZodDto(SceneResponseSchema) {}
