import { z } from 'zod';

export const ProjectConfigSchema = z
  .object({
    style: z.enum(['realistic', 'cartoon', 'manga', 'watercolor']).default('realistic'),
    vibe: z
      .enum(['dramatic', 'calm', 'joyful', 'dark', 'epic', 'romantic', 'mysterious'])
      .optional(),
    language: z.enum(['fr', 'en', 'es', 'de']).default('fr'),
    format: z.enum(['portrait', 'landscape']).default('landscape'),
  })
  .passthrough();

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
