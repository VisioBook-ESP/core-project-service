import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { connect } from 'nats';
import { APP_CONFIG } from '../common/config/app.config.js';
import type { AppConfig } from '../common/config/app.config.js';

@Injectable()
export class NatsHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const nc = await connect({
        servers: this.config.NATS_URL,
        user: this.config.NATS_USER,
        pass: this.config.NATS_PASSWORD,
        timeout: 3000,
      });
      await nc.close();
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: (error as Error).message });
    }
  }
}
