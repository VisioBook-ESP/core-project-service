import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from './common/config/config.module.js';
import { APP_CONFIG } from './common/config/app.config.js';
import type { AppConfig } from './common/config/app.config.js';
import { PrismaModule } from './common/database/prisma.module.js';
import { GatewayAuthGuard } from './common/guards/gateway-auth.guard.js';
import { HealthModule } from './health/health.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { WorkflowModule } from './workflow/workflow.module.js';
import { ProjectModule } from './project/project.module.js';
import { ContentModule } from './content/content.module.js';
import { VersionModule } from './version/version.module.js';
import { ShareModule } from './share/share.module.js';
import { MetricsModule } from './metrics/metrics.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.LOG_LEVEL,
          autoLogging: true,
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
            remove: true,
          },
          customProps: () => ({}),
        },
      }),
    }),
    BullModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        connection: {
          host: config.REDIS_HOST,
          port: config.REDIS_PORT,
          password: config.REDIS_PASSWORD || undefined,
          db: config.REDIS_DB,
          tls: config.REDIS_TLS_ENABLED ? {} : undefined,
        },
      }),
    }),
    PrismaModule,
    HealthModule,
    MessagingModule,
    WorkflowModule,
    ProjectModule,
    ContentModule,
    VersionModule,
    ShareModule,
    MetricsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GatewayAuthGuard,
    },
  ],
})
export class AppModule {}
