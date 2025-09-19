import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockStorageService } from './mock-storage.service';
import { IStorageService } from './storage.interface';

@Module({
  providers: [
    {
      provide: 'IStorageService',
      useFactory: (configService: ConfigService): IStorageService => {
        const isMock =
          configService.get<string>('STORAGE_SERVICE_MOCK') === 'true';

        if (isMock) {
          return new MockStorageService();
        }

        // TODO: Implémenter le vrai service storage plus tard
        return new MockStorageService();
      },
      inject: [ConfigService],
    },
  ],
  exports: ['IStorageService'],
})
export class StorageModule {}
