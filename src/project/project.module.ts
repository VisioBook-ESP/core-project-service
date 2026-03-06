import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module.js';
import { ProjectService } from './project.service.js';
import { ProjectController } from './project.controller.js';

@Module({
  imports: [MessagingModule],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
