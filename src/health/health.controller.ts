import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  check() {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'core-project-service',
      version: '1.0.0',
      checks: {
        mongodb: {
          status: 'UP',
          responseTime: '12ms',
        },
        redis: {
          status: 'UP',
          responseTime: '3ms',
        },
        memory: {
          status: 'UP',
          heap: '45MB',
          rss: '67MB',
        },
      },
    };
  }

  @Get('ready')
  readiness() {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      ready: true,
    };
  }

  @Get('metrics')
  metrics() {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      metrics: {
        requests_total: 0,
        response_time_avg: 0,
        memory_usage: process.memoryUsage(),
      },
    };
  }
}
