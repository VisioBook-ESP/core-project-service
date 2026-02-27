import { z } from 'zod';

const coerceBoolean = z.union([z.boolean(), z.string()]).transform((val) => {
  if (typeof val === 'boolean') return val;
  return val === 'true' || val === '1';
});

export const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8086),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  SWAGGER_ENABLED: coerceBoolean.default('true'),
  CORS_ORIGINS: z.string().default('*'),

  // Database
  DATABASE_URL: z.string().startsWith('postgresql://'),
  DATABASE_POOL_MIN: z.coerce.number().int().min(1).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),

  // Redis
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  REDIS_TLS_ENABLED: coerceBoolean.default('false'),

  // NATS
  NATS_URL: z.string().min(1),
  NATS_USER: z.string().optional(),
  NATS_PASSWORD: z.string().optional(),
  NATS_STREAM_NAME: z.string().default('VISIOBOOK_PROJECT'),

  // BullMQ
  BULLMQ_CONCURRENCY: z.coerce.number().int().positive().default(5),
  BULLMQ_MAX_RETRIES: z.coerce.number().int().min(0).default(3),

  // External services
  USER_SERVICE_URL: z.string().url(),
  STORAGE_SERVICE_URL: z.string().url(),
  NOTIFICATION_SERVICE_URL: z.string().url(),
  HTTP_CLIENT_TIMEOUT: z.coerce.number().int().positive().default(5000),

  // Feature flags
  FEATURE_SSE_ENABLED: coerceBoolean.default('true'),
  FEATURE_SHARE_ENABLED: coerceBoolean.default('true'),
  FEATURE_SEARCH_ENABLED: coerceBoolean.default('true'),
});

export type AppConfig = z.infer<typeof envSchema>;

export const APP_CONFIG = 'APP_CONFIG';

export function validateEnv(): AppConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
  }
  return result.data;
}
