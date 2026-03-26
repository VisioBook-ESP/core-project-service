import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ShareLinkResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  shareToken: z.string(),
  expiresAt: z.coerce.date().nullable(),
  allowDownload: z.boolean(),
  isPasswordProtected: z.boolean(),
  createdAt: z.coerce.date(),
});

export type ShareLinkResponseDto = z.infer<typeof ShareLinkResponseSchema>;

export class ShareLinkResponseDtoClass extends createZodDto(ShareLinkResponseSchema) {}
