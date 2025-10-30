// import { Injectable, OnModuleInit } from '@nestjs/common';
// import { PrismaClient } from '@prisma/client';

// @Injectable()
// export class PrismaService extends PrismaClient implements OnModuleInit {
//   async onModuleInit() {
//     await this.$connect();
//   }

//   async onModuleDestroy() {
//     await this.$disconnect();
//   }
// }

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    const dbUrl = process.env.DATABASE_URL;

    // Phase 1 : on ne veut pas bloquer si la DB n'est pas dispo
    if (!dbUrl) {
      this.logger.warn(
        'DATABASE_URL is not set. Skipping Prisma connection (Phase 1 mode).',
      );
      return;
    }

    try {
      await this.$connect();
      this.logger.log('Prisma connected to database');
    } catch (error) {
      this.logger.error(
        'Failed to connect to database. Continuing because we are in Phase 1.',
        error as Error,
      );
      // en phase 1 on NE throw PAS, sinon le container ne démarre pas
      // if (process.env.NODE_ENV === 'production') throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch (error) {
      this.logger.error('Error while disconnecting Prisma', error as Error);
    }
  }
}
