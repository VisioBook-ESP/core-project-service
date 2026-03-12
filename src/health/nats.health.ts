import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { NatsPublisher } from '../messaging/nats.publisher.js';

@Injectable()
export class NatsHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly natsPublisher: NatsPublisher,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    if (this.natsPublisher.isConnected()) {
      return indicator.up();
    }
    return indicator.down({ message: 'NATS not connected' });
  }
}
