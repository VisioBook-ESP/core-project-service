import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const VerifyPasswordSchema = z.object({
  password: z.string().min(1),
});

export type VerifyPasswordDto = z.infer<typeof VerifyPasswordSchema>;
export class VerifyPasswordDtoClass extends createZodDto(VerifyPasswordSchema) {}
