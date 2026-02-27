import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { Redis } from 'ioredis';
import { APP_CONFIG } from '../common/config/app.config.js';
import type { AppConfig } from '../common/config/app.config.js';

@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.redis = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,
      db: config.REDIS_DB,
      lazyConnect: true,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.redis.ping();
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: (error as Error).message });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
