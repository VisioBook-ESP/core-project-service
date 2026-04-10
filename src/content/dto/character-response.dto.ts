import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CharacterResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  aliases: z.array(z.string()),
  traits: z.array(z.string()),
  voiceDescription: z.string().nullable(),
});

export type CharacterResponseDto = z.infer<typeof CharacterResponseSchema>;

export class CharacterResponseDtoClass extends createZodDto(CharacterResponseSchema) {}
