import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const DialogueResponseSchema = z.object({
  id: z.string().uuid(),
  order: z.number(),
  speaker: z.string(),
  line: z.string(),
  delivery: z.string(),
});

export type DialogueResponseDto = z.infer<typeof DialogueResponseSchema>;

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
  sceneType: z.string().nullable(),
  audioPrompt: z.string().nullable(),
  narrationText: z.string().nullable(),
  dialogues: z.array(DialogueResponseSchema).optional(),
});

export type SceneResponseDto = z.infer<typeof SceneResponseSchema>;

export class SceneResponseDtoClass extends createZodDto(SceneResponseSchema) {}
