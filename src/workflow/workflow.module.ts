import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessagingModule } from '../messaging/messaging.module.js';
import { ProjectModule } from '../project/project.module.js';
import { WorkflowProcessor } from './workflow.processor.js';
import { WorkflowService } from './workflow.service.js';
import { WorkflowController } from './workflow.controller.js';
import { WorkflowSSEController } from './workflow.sse.controller.js';
import { WORKFLOW_QUEUE_NAME } from './workflow.types.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: WORKFLOW_QUEUE_NAME }),
    EventEmitterModule.forRoot(),
    MessagingModule,
    forwardRef(() => ProjectModule),
  ],
  controllers: [WorkflowController, WorkflowSSEController],
  providers: [WorkflowProcessor, WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
