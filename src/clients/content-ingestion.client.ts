import { Injectable, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../common/config/app.config.js';
import type { AppConfig } from '../common/config/app.config.js';

export interface ExtractedTextResult {
  text: string;
  wordCount: number;
  metadata: Record<string, unknown>;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

@Injectable()
export class ContentIngestionClient {
  private readonly logger = new Logger(ContentIngestionClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.baseUrl = config.CONTENT_INGESTION_SERVICE_URL ?? '';
  }

  async fetchExtractedText(
    fileId: string,
    opts?: { userId?: string; bearerToken?: string; requestId?: string },
  ): Promise<ExtractedTextResult> {
    return this.withRetry<ExtractedTextResult>(async () => {
      const { data } = await firstValueFrom(
        this.httpService.get<ExtractedTextResult>(
          `${this.baseUrl}/api/v1/documents/${encodeURIComponent(fileId)}`,
          { headers: this.buildHeaders(opts) },
        ),
      );
      return data;
    }, 'fetchExtractedText');
  }

  private buildHeaders(opts?: {
    userId?: string;
    bearerToken?: string;
    requestId?: string;
  }): Record<string, string> {
    const headers: Record<string, string> = {};
    if (opts?.requestId) headers['X-Request-Id'] = opts.requestId;
    if (opts?.userId) headers['X-User-Id'] = opts.userId;
    if (opts?.bearerToken) headers['Authorization'] = `Bearer ${opts.bearerToken}`;
    return headers;
  }

  private async withRetry<T>(fn: () => Promise<T>, operation: string): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          this.logger.error({ error, operation, attempt }, 'Request failed after max retries');
          throw new ServiceUnavailableException(
            `Content ingestion service unavailable: ${operation}`,
          );
        }
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn({ operation, attempt, delay }, 'Request failed, retrying');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new ServiceUnavailableException(`Content ingestion service unavailable: ${operation}`);
  }
}
