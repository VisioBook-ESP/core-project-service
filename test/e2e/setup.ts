/**
 * E2E test bootstrap — starts testcontainers for PostgreSQL, Redis, and NATS,
 * then builds a real NestJS app with overridden config and mocked external clients.
 */

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/common/database/prisma.service.js';
import { UserServiceClient } from '../../src/clients/user-service.client.js';
import { NotificationServiceClient } from '../../src/clients/notification-service.client.js';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe.js';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter.js';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor.js';
import { startPostgres, startRedis, startNats, cleanDatabase } from '../integration/setup.js';

// ---- Mock types ----

export interface MockUserServiceClient {
  checkQuota: ReturnType<typeof vi.fn>;
  decrementQuota: ReturnType<typeof vi.fn>;
}

export interface MockNotificationServiceClient {
  sendNotification: ReturnType<typeof vi.fn>;
}

// ---- E2E context ----

export interface E2EContext {
  app: INestApplication;
  httpServer: ReturnType<INestApplication['getHttpServer']>;
  prisma: PrismaService;
  mocks: {
    userServiceClient: MockUserServiceClient;
    notificationClient: MockNotificationServiceClient;
  };
  cleanup: () => Promise<void>;
}

// ---- Bootstrap ----

export async function bootstrapE2E(): Promise<E2EContext> {
  // 1. Start containers in parallel
  const [pgCtx, redisCtx, natsCtx] = await Promise.all([
    startPostgres(),
    startRedis(),
    startNats(),
  ]);

  // 2. Apply additional migrations (fulltext search, schema changes)
  await applyAdditionalMigrations(pgCtx.connectionUrl);

  // 3. Fix connection URL (testcontainers returns postgres:// but Zod schema requires postgresql://)
  const databaseUrl = pgCtx.connectionUrl.replace(/^postgres:\/\//, 'postgresql://');

  // 4. Set process.env for ConfigModule's validateEnv()
  process.env.NODE_ENV = 'development';
  process.env.DATABASE_URL = databaseUrl;
  process.env.REDIS_HOST = redisCtx.host;
  process.env.REDIS_PORT = String(redisCtx.port);
  process.env.NATS_URL = natsCtx.url;
  process.env.USER_SERVICE_URL = 'http://localhost:9999';
  process.env.NOTIFICATION_SERVICE_URL = 'http://localhost:9998';
  process.env.LOG_LEVEL = 'warn';
  process.env.SWAGGER_ENABLED = 'false';

  // 5. Mock external service clients
  const mockUserServiceClient: MockUserServiceClient = {
    checkQuota: vi.fn().mockResolvedValue({ hasQuota: true, remaining: 10 }),
    decrementQuota: vi.fn().mockResolvedValue(undefined),
  };

  const mockNotificationClient: MockNotificationServiceClient = {
    sendNotification: vi.fn().mockResolvedValue(undefined),
  };

  // 6. Build NestJS testing module
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(UserServiceClient)
    .useValue(mockUserServiceClient)
    .overrideProvider(NotificationServiceClient)
    .useValue(mockNotificationClient)
    .compile();

  const app = moduleRef.createNestApplication();

  // 7. Mirror main.ts global config
  app.setGlobalPrefix('api/v1', {
    exclude: ['/health/ready', '/health/live', '/metrics'],
  });
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.init();
  await app.listen(0);

  const prisma = app.get(PrismaService);
  const httpServer = app.getHttpServer();

  // 8. Return context
  return {
    app,
    httpServer,
    prisma,
    mocks: {
      userServiceClient: mockUserServiceClient,
      notificationClient: mockNotificationClient,
    },
    cleanup: async () => {
      await app.close();
      await Promise.all([
        pgCtx.container.stop(),
        redisCtx.container.stop(),
        natsCtx.container.stop(),
      ]);
    },
  };
}

// Re-export for convenience
export { cleanDatabase };

// ---- Helpers ----

async function applyAdditionalMigrations(connectionUrl: string): Promise<void> {
  // Only migrations NOT already applied by startPostgres() (which handles init + sourceType removal)
  const migrations = [
    '20260313000000_add_fulltext_search',
    '20260403120000_add_locations_references_pipeline',
  ];
  const pool = new pg.Pool({ connectionString: connectionUrl });
  try {
    for (const migration of migrations) {
      const sql = readFileSync(
        join(process.cwd(), 'prisma', 'migrations', migration, 'migration.sql'),
        'utf-8',
      );
      await pool.query(sql);
    }
  } finally {
    await pool.end();
  }
}
