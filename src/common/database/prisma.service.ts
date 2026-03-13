import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { APP_CONFIG } from '../config/app.config.js';
import type { AppConfig } from '../config/app.config.js';
import type { MetricsService } from '../../metrics/metrics.service.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: pg.Pool;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly moduleRef: ModuleRef,
  ) {
    const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();

    // Instrument pg pool queries with Prometheus histogram
    try {
      const { MetricsService: MetricsSvc } = await import('../../metrics/metrics.service.js');
      const metrics = this.moduleRef.get(MetricsSvc, { strict: false }) as MetricsService;
      const originalQuery = this.pool.query.bind(this.pool);
      this.pool.query = ((...args: unknown[]) => {
        const end = metrics.prismaQueryDuration.startTimer({ operation: 'query' });
        const result = (originalQuery as (...a: unknown[]) => unknown)(...args);
        if (result && typeof result === 'object' && 'then' in result) {
          (result as Promise<unknown>).then(() => end(), () => end());
        } else {
          end();
        }
        return result;
      }) as typeof this.pool.query;
    } catch {
      // MetricsService not available — skip instrumentation
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}
