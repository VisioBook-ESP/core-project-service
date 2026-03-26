import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const VersionSummarySchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.number(),
  status: z.string(),
  config: z.record(z.unknown()),
  videoUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const VersionCompareResponseSchema = z.object({
  version1: VersionSummarySchema,
  version2: VersionSummarySchema,
  configDiff: z.object({
    added: z.record(z.unknown()),
    removed: z.record(z.unknown()),
    changed: z.record(z.object({ from: z.unknown(), to: z.unknown() })),
  }),
});

export type VersionCompareResponseDto = z.infer<typeof VersionCompareResponseSchema>;
export class VersionCompareResponseDtoClass extends createZodDto(VersionCompareResponseSchema) {}
