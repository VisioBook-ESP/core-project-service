import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SearchProjectsQuerySchema = z.object({
  q: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

export type SearchProjectsQueryDto = z.infer<typeof SearchProjectsQuerySchema>;
export class SearchProjectsQueryDtoClass extends createZodDto(SearchProjectsQuerySchema) {}
