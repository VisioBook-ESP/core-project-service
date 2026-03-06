import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module.js';
import { VersionService } from './version.service.js';
import { VersionController } from './version.controller.js';

@Module({
  imports: [ProjectModule],
  controllers: [VersionController],
  providers: [VersionService],
  exports: [VersionService],
})
export class VersionModule {}
