import { Injectable, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../common/config/app.config.js';
import type { AppConfig } from '../common/config/app.config.js';

export interface QuotaCheckResult {
  hasQuota: boolean;
  remaining: number;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

@Injectable()
export class UserServiceClient {
  private readonly logger = new Logger(UserServiceClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.baseUrl = config.USER_SERVICE_URL;
  }

  async checkQuota(
    userId: string,
    requestId?: string,
    bearerToken?: string,
  ): Promise<QuotaCheckResult> {
    return this.withRetry<QuotaCheckResult>(async () => {
      const { data } = await firstValueFrom(
        this.httpService.get<QuotaCheckResult>(`${this.baseUrl}/api/v1/users/${userId}/quota`, {
          headers: this.buildHeaders({ requestId, userId, bearerToken }),
        }),
      );
      return data;
    }, 'checkQuota');
  }

  async decrementQuota(
    userId: string,
    requestId?: string,
    bearerToken?: string,
  ): Promise<void> {
    await this.withRetry<void>(async () => {
      await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/api/v1/users/${userId}/quota/decrement`,
          {},
          {
            headers: this.buildHeaders({ requestId, userId, bearerToken }),
          },
        ),
      );
    }, 'decrementQuota');
  }

  private buildHeaders(opts?: {
    requestId?: string;
    userId?: string;
    bearerToken?: string;
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
          throw new ServiceUnavailableException(`User service unavailable: ${operation}`);
        }
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn({ operation, attempt, delay }, 'Request failed, retrying');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new ServiceUnavailableException(`User service unavailable: ${operation}`);
  }
}
