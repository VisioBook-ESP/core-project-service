import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const VersionResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  versionNumber: z.number(),
  config: z.record(z.unknown()),
  status: z.enum([
    'draft',
    'analyzing',
    'analyzed',
    'configuring',
    'generating',
    'completed',
    'failed',
    'cancelled',
  ]),
  videoUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
  executions: z.array(z.unknown()).optional(),
});

export type VersionResponseDto = z.infer<typeof VersionResponseSchema>;

export class VersionResponseDtoClass extends createZodDto(VersionResponseSchema) {}
