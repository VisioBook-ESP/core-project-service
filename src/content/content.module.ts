import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module.js';
import { ContentService } from './content.service.js';
import { ContentController } from './content.controller.js';

@Module({
  imports: [ProjectModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
