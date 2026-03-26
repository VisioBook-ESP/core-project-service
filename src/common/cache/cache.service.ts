import { Injectable, Logger, Inject, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG } from '../config/app.config.js';
import type { AppConfig } from '../config/app.config.js';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.redis = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD || undefined,
      db: config.REDIS_DB,
      tls: config.REDIS_TLS_ENABLED ? {} : undefined,
      lazyConnect: false,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn({ key, error: (error as Error).message }, 'Cache get failed');
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn({ key, error: (error as Error).message }, 'Cache set failed');
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn({ key, error: (error as Error).message }, 'Cache del failed');
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      const stream = this.redis.scanStream({ match: pattern, count: 100 });
      const pipeline = this.redis.pipeline();
      let count = 0;

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          for (const key of keys) {
            pipeline.del(key);
            count++;
          }
        });
        stream.on('end', () => resolve());
        stream.on('error', (err: Error) => reject(err));
      });

      if (count > 0) {
        await pipeline.exec();
      }
    } catch (error) {
      this.logger.warn({ pattern, error: (error as Error).message }, 'Cache delByPattern failed');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
    this.logger.log('Redis cache connection closed');
  }
}
