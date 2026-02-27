import type { HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import { HealthController } from '../../../src/health/health.controller.js';
import type { PrismaHealthIndicator } from '../../../src/health/prisma.health.js';
import type { RedisHealthIndicator } from '../../../src/health/redis.health.js';
import type { NatsHealthIndicator } from '../../../src/health/nats.health.js';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthService: { check: ReturnType<typeof vi.fn> };
  let mockPrismaHealth: { isHealthy: ReturnType<typeof vi.fn> };
  let mockRedisHealth: { isHealthy: ReturnType<typeof vi.fn> };
  let mockNatsHealth: { isHealthy: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPrismaHealth = { isHealthy: vi.fn() };
    mockRedisHealth = { isHealthy: vi.fn() };
    mockNatsHealth = { isHealthy: vi.fn() };
    mockHealthService = { check: vi.fn() };

    controller = new HealthController(
      mockHealthService as unknown as HealthCheckService,
      mockPrismaHealth as unknown as PrismaHealthIndicator,
      mockRedisHealth as unknown as RedisHealthIndicator,
      mockNatsHealth as unknown as NatsHealthIndicator,
    );
  });

  describe('readiness', () => {
    it('should return health check result when all indicators are healthy', async () => {
      const expectedResult: HealthCheckResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
          nats: { status: 'up' },
        },
        error: {},
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
          nats: { status: 'up' },
        },
      };

      mockHealthService.check.mockResolvedValue(expectedResult);

      const result = await controller.readiness();

      expect(result).toEqual(expectedResult);
      expect(mockHealthService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
    });

    it('should pass indicator callbacks that invoke the correct health indicators', async () => {
      mockHealthService.check.mockImplementation(
        async (indicators: Array<() => Promise<unknown>>) => {
          for (const indicator of indicators) {
            await indicator();
          }
          return { status: 'ok', info: {}, error: {}, details: {} };
        },
      );

      mockPrismaHealth.isHealthy.mockResolvedValue({ database: { status: 'up' } });
      mockRedisHealth.isHealthy.mockResolvedValue({ redis: { status: 'up' } });
      mockNatsHealth.isHealthy.mockResolvedValue({ nats: { status: 'up' } });

      await controller.readiness();

      expect(mockPrismaHealth.isHealthy).toHaveBeenCalledWith('database');
      expect(mockRedisHealth.isHealthy).toHaveBeenCalledWith('redis');
      expect(mockNatsHealth.isHealthy).toHaveBeenCalledWith('nats');
    });
  });

  describe('liveness', () => {
    it('should return { status: "ok" }', () => {
      const result = controller.liveness();

      expect(result).toEqual({ status: 'ok' });
    });
  });
});
