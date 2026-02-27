export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
}

// Re-export Prisma enums for convenience
export {
  ProjectStatus,
  SourceType,
  VersionStatus,
  ExecutionStatus,
  PipelineStep,
  StepStatus,
} from '../../generated/prisma/client.js';
