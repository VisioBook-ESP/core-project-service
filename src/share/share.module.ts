import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module.js';
import { ShareService } from './share.service.js';
import { ShareController } from './share.controller.js';

@Module({
  imports: [ProjectModule],
  controllers: [ShareController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
