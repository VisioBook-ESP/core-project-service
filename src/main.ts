// Shutdown order: HTTP server → BullMQ workers → NATS consumers → Prisma → exit
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';
import { AppModule } from './app.module.js';
import { validateEnv } from './common/config/app.config.js';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { RateLimitHeadersInterceptor } from './common/interceptors/rate-limit-headers.interceptor.js';

async function bootstrap(): Promise<void> {
  // Patch Swagger before creating the app
  patchNestJsSwagger();

  // Fail-fast on invalid env
  const config = validateEnv();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino logger
  app.useLogger(app.get(Logger));

  // CORS
  app.enableCors({
    origin: config.CORS_ORIGINS === '*' ? '*' : config.CORS_ORIGINS.split(','),
  });

  // Global prefix (exclude health and metrics)
  app.setGlobalPrefix('api/v1', {
    exclude: ['/health/ready', '/health/live', '/metrics'],
  });

  // Global pipes, filters, interceptors
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new RateLimitHeadersInterceptor());

  // Swagger (conditional)
  if (config.SWAGGER_ENABLED) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Core Project Service')
      .setDescription('VisioBook core project management API')
      .setVersion('0.1.0')
      .addApiKey({ type: 'apiKey', name: 'X-User-Id', in: 'header' }, 'X-User-Id')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(config.PORT);
}

bootstrap();
