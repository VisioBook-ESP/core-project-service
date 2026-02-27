import { Global, Module } from '@nestjs/common';
import { validateEnv, APP_CONFIG } from './app.config.js';
import type { AppConfig } from './app.config.js';

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => validateEnv(),
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
