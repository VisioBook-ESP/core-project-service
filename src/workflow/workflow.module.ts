import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessagingModule } from '../messaging/messaging.module.js';
import { ProjectModule } from '../project/project.module.js';
import { WorkflowProcessor } from './workflow.processor.js';
import { WorkflowService } from './workflow.service.js';
import { WorkflowController } from './workflow.controller.js';
import { WORKFLOW_QUEUE_NAME } from './workflow.types.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: WORKFLOW_QUEUE_NAME }),
    MessagingModule,
    ProjectModule,
  ],
  controllers: [WorkflowController],
  providers: [WorkflowProcessor, WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
