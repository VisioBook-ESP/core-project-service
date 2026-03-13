import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateShareLinkSchema = z.object({
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .refine((val) => !val || new Date(val) > new Date(), {
      message: 'Expiration date must be in the future',
    }),
  allowDownload: z.boolean().optional().default(false),
});

export type CreateShareLinkDto = z.infer<typeof CreateShareLinkSchema>;

export class CreateShareLinkDtoClass extends createZodDto(CreateShareLinkSchema) {}
