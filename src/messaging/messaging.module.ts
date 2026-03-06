import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { APP_CONFIG } from '../common/config/app.config.js';
import type { AppConfig } from '../common/config/app.config.js';
import { NatsPublisher } from './nats.publisher.js';
import { NatsSubscriber } from './nats.subscriber.js';
import { UserServiceClient } from '../clients/user-service.client.js';
import { StorageServiceClient } from '../clients/storage-service.client.js';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        timeout: config.HTTP_CLIENT_TIMEOUT,
      }),
    }),
  ],
  providers: [NatsPublisher, NatsSubscriber, UserServiceClient, StorageServiceClient],
  exports: [NatsPublisher, NatsSubscriber, UserServiceClient, StorageServiceClient],
})
export class MessagingModule {}
