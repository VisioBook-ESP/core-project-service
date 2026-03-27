import { Injectable, Inject, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../common/config/app.config.js';
import type { AppConfig } from '../common/config/app.config.js';

export interface SendNotificationPayload {
  userId: string;
  type: string;
  data: Record<string, unknown>;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

@Injectable()
export class NotificationServiceClient {
  private readonly logger = new Logger(NotificationServiceClient.name);
  private readonly baseUrl: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.baseUrl = config.NOTIFICATION_SERVICE_URL;
  }

  async sendNotification(
    payload: SendNotificationPayload,
    requestId?: string,
    bearerToken?: string,
  ): Promise<void> {
    if (!this.baseUrl) {
      this.logger.debug('NOTIFICATION_SERVICE_URL not configured — skipping notification');
      return;
    }
    const headers = this.buildHeaders({
      requestId,
      userId: payload.userId,
      bearerToken,
    });
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await firstValueFrom(
          this.httpService.post(`${this.baseUrl}/api/v1/notifications/send`, payload, {
            headers,
          }),
        );
        this.logger.debug({ userId: payload.userId, type: payload.type }, 'Notification sent');
        return;
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          this.logger.warn(
            { error, userId: payload.userId, type: payload.type, attempt },
            'Failed to send notification after max retries — skipping (best-effort)',
          );
          return;
        }
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          { userId: payload.userId, type: payload.type, attempt, delay },
          'Notification request failed, retrying',
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
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
}
