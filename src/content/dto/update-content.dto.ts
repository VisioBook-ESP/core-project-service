import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateContentSchema = z.object({
  text: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateContentDto = z.infer<typeof UpdateContentSchema>;

export class UpdateContentDtoClass extends createZodDto(UpdateContentSchema) {}
