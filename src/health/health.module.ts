import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { PrismaHealthIndicator } from './prisma.health.js';
import { RedisHealthIndicator } from './redis.health.js';
import { NatsHealthIndicator } from './nats.health.js';
import { MessagingModule } from '../messaging/messaging.module.js';

@Module({
  imports: [TerminusModule, MessagingModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator, NatsHealthIndicator],
})
export class HealthModule {}
