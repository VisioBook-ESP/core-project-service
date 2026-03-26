import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

export type ListProjectsQueryDto = z.infer<typeof ListProjectsQuerySchema>;

export class ListProjectsQueryDtoClass extends createZodDto(ListProjectsQuerySchema) {}
