import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MessagingModule } from '../messaging/messaging.module.js';
import { VersionModule } from '../version/version.module.js';
import { WorkflowModule } from '../workflow/workflow.module.js';
import { ContentIngestionClient } from '../clients/content-ingestion.client.js';
import { ProjectService } from './project.service.js';
import { ProjectController } from './project.controller.js';

@Module({
  imports: [
    HttpModule,
    MessagingModule,
    forwardRef(() => VersionModule),
    forwardRef(() => WorkflowModule),
  ],
  controllers: [ProjectController],
  providers: [ProjectService, ContentIngestionClient],
  exports: [ProjectService],
})
export class ProjectModule {}
