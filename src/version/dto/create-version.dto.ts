import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateVersionSchema = z.object({
  config: z.record(z.unknown()).optional(),
});

export type CreateVersionDto = z.infer<typeof CreateVersionSchema>;

export class CreateVersionDtoClass extends createZodDto(CreateVersionSchema) {}
