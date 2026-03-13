import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SharedProjectResponseSchema = z.object({
  title: z.string(),
  videoUrl: z.string().nullable(),
  allowDownload: z.boolean(),
  requiresPassword: z.boolean(),
  createdAt: z.coerce.date(),
});

export type SharedProjectResponseDto = z.infer<typeof SharedProjectResponseSchema>;

export class SharedProjectResponseDtoClass extends createZodDto(SharedProjectResponseSchema) {}
