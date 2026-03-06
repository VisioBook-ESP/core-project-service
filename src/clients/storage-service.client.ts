import { Injectable, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../common/config/app.config.js';
import type { AppConfig } from '../common/config/app.config.js';

export interface UploadUrlParams {
  fileName: string;
  contentType: string;
  projectId: string;
  userId: string;
}

export interface UploadUrlResult {
  uploadUrl: string;
  fileKey: string;
}

export interface FileMetadata {
  key: string;
  size: number;
  contentType: string;
  createdAt: string;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

@Injectable()
export class StorageServiceClient {
  private readonly logger = new Logger(StorageServiceClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.baseUrl = config.STORAGE_SERVICE_URL;
  }

  async getUploadUrl(params: UploadUrlParams, requestId?: string): Promise<UploadUrlResult> {
    return this.withRetry<UploadUrlResult>(async () => {
      const { data } = await firstValueFrom(
        this.httpService.post<UploadUrlResult>(
          `${this.baseUrl}/api/v1/storage/upload-url`,
          params,
          {
            headers: this.buildHeaders(requestId),
          },
        ),
      );
      return data;
    }, 'getUploadUrl');
  }

  async deleteFile(key: string, requestId?: string): Promise<void> {
    await this.withRetry<void>(async () => {
      await firstValueFrom(
        this.httpService.delete(`${this.baseUrl}/api/v1/storage/files/${encodeURIComponent(key)}`, {
          headers: this.buildHeaders(requestId),
        }),
      );
    }, 'deleteFile');
  }

  async getFileMetadata(key: string, requestId?: string): Promise<FileMetadata> {
    return this.withRetry<FileMetadata>(async () => {
      const { data } = await firstValueFrom(
        this.httpService.get<FileMetadata>(
          `${this.baseUrl}/api/v1/storage/files/${encodeURIComponent(key)}/metadata`,
          { headers: this.buildHeaders(requestId) },
        ),
      );
      return data;
    }, 'getFileMetadata');
  }

  private buildHeaders(requestId?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (requestId) {
      headers['X-Request-Id'] = requestId;
    }
    return headers;
  }

  private async withRetry<T>(fn: () => Promise<T>, operation: string): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          this.logger.error({ error, operation, attempt }, 'Request failed after max retries');
          throw new ServiceUnavailableException(`Storage service unavailable: ${operation}`);
        }
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn({ operation, attempt, delay }, 'Request failed, retrying');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new ServiceUnavailableException(`Storage service unavailable: ${operation}`);
  }
}
