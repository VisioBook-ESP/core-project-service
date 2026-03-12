import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, type HealthCheckResult } from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaHealthIndicator } from './prisma.health.js';
import { RedisHealthIndicator } from './redis.health.js';
import { NatsHealthIndicator } from './nats.health.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly natsHealth: NatsHealthIndicator,
  ) {}

  @Get('ready')
  @Public()
  @HealthCheck()
  async readiness(): Promise<HealthCheckResult> {
    // Only check database for readiness — Redis/NATS are non-blocking dependencies
    return this.health.check([() => this.prismaHealth.isHealthy('database')]);
  }

  @Get('live')
  @Public()
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('details')
  @Public()
  @HealthCheck()
  async details(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
      () => this.natsHealth.isHealthy('nats'),
    ]);
  }
}
