import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ContentResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  text: z.string(),
  wordCount: z.number(),
  summary: z.string().nullable(),
  metadata: z.record(z.unknown()),
});

export type ContentResponseDto = z.infer<typeof ContentResponseSchema>;

export class ContentResponseDtoClass extends createZodDto(ContentResponseSchema) {}
