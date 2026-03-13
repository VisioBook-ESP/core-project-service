import { validateEnv, envSchema } from '../../../src/common/config/app.config.js';

const REQUIRED_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
  REDIS_HOST: 'localhost',
  NATS_URL: 'nats://localhost:4222',
  USER_SERVICE_URL: 'http://localhost:8081',
  NOTIFICATION_SERVICE_URL: 'http://localhost:8085',
};

describe('validateEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear all keys that the schema cares about
    for (const key of Object.keys(envSchema.shape)) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return a typed AppConfig when all required vars are set', () => {
    Object.assign(process.env, REQUIRED_ENV);

    const config = validateEnv();

    expect(config.DATABASE_URL).toBe(REQUIRED_ENV.DATABASE_URL);
    expect(config.REDIS_HOST).toBe(REQUIRED_ENV.REDIS_HOST);
    expect(config.NATS_URL).toBe(REQUIRED_ENV.NATS_URL);
    expect(config.USER_SERVICE_URL).toBe(REQUIRED_ENV.USER_SERVICE_URL);
  });

  it('should apply default values when only required vars are set', () => {
    Object.assign(process.env, REQUIRED_ENV);

    const config = validateEnv();

    expect(config.PORT).toBe(8086);
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.NODE_ENV).toBe('development');
    expect(config.SWAGGER_ENABLED).toBe(true);
    expect(config.CORS_ORIGINS).toBe('*');
    expect(config.DATABASE_POOL_MIN).toBe(2);
    expect(config.DATABASE_POOL_MAX).toBe(10);
    expect(config.REDIS_PORT).toBe(6379);
    expect(config.REDIS_DB).toBe(0);
    expect(config.REDIS_TLS_ENABLED).toBe(false);
    expect(config.NATS_STREAM_NAME).toBe('VISIOBOOK_PROJECT');
    expect(config.BULLMQ_CONCURRENCY).toBe(5);
    expect(config.BULLMQ_MAX_RETRIES).toBe(3);
    expect(config.HTTP_CLIENT_TIMEOUT).toBe(5000);
    expect(config.FEATURE_SSE_ENABLED).toBe(true);
    expect(config.FEATURE_SHARE_ENABLED).toBe(true);
    expect(config.FEATURE_SEARCH_ENABLED).toBe(true);
  });

  it('should throw an error mentioning DATABASE_URL when it is missing', () => {
    const { DATABASE_URL: _, ...rest } = REQUIRED_ENV;
    Object.assign(process.env, rest);

    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
  });

  it('should throw an error mentioning REDIS_HOST when it is missing', () => {
    const { REDIS_HOST: _, ...rest } = REQUIRED_ENV;
    Object.assign(process.env, rest);

    expect(() => validateEnv()).toThrow(/REDIS_HOST/);
  });

  it('should throw an error when DATABASE_URL does not start with postgresql://', () => {
    Object.assign(process.env, { ...REQUIRED_ENV, DATABASE_URL: 'mysql://host/db' });

    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
  });

  it('should reject invalid types (PORT as non-numeric string)', () => {
    Object.assign(process.env, { ...REQUIRED_ENV, PORT: 'abc' });

    expect(() => validateEnv()).toThrow();
  });

  it('should coerce PORT from string to number', () => {
    Object.assign(process.env, { ...REQUIRED_ENV, PORT: '3000' });

    const config = validateEnv();
    expect(config.PORT).toBe(3000);
  });

  it('should coerce SWAGGER_ENABLED "true" to boolean true', () => {
    Object.assign(process.env, { ...REQUIRED_ENV, SWAGGER_ENABLED: 'true' });

    const config = validateEnv();
    expect(config.SWAGGER_ENABLED).toBe(true);
  });

  it('should coerce SWAGGER_ENABLED "false" to boolean false', () => {
    Object.assign(process.env, { ...REQUIRED_ENV, SWAGGER_ENABLED: 'false' });

    const config = validateEnv();
    expect(config.SWAGGER_ENABLED).toBe(false);
  });

  it('should coerce SWAGGER_ENABLED "1" to boolean true', () => {
    Object.assign(process.env, { ...REQUIRED_ENV, SWAGGER_ENABLED: '1' });

    const config = validateEnv();
    expect(config.SWAGGER_ENABLED).toBe(true);
  });

  it('should coerce REDIS_TLS_ENABLED "true" to boolean true', () => {
    Object.assign(process.env, { ...REQUIRED_ENV, REDIS_TLS_ENABLED: 'true' });

    const config = validateEnv();
    expect(config.REDIS_TLS_ENABLED).toBe(true);
  });

  it('should throw when USER_SERVICE_URL is not a valid URL', () => {
    Object.assign(process.env, { ...REQUIRED_ENV, USER_SERVICE_URL: 'not-a-url' });

    expect(() => validateEnv()).toThrow();
  });

  it('should include the formatted error message', () => {
    // No required vars set at all
    expect(() => validateEnv()).toThrow('Environment validation failed');
  });
});
