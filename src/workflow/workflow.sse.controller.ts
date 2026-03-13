import { Controller, Get, Param, Sse, Inject, NotFoundException, Logger } from '@nestjs/common';
import { ApiTags, ApiParam, ApiOperation } from '@nestjs/swagger';
import { Observable, fromEvent, map, takeWhile, startWith } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { APP_CONFIG } from '../common/config/app.config.js';
import type { AppConfig } from '../common/config/app.config.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { WorkflowService } from './workflow.service.js';

interface MessageEvent {
  data: string | object;
}

interface WorkflowProgressEvent {
  executionId: string;
  status: string;
  currentStep: string | null;
  progress: number;
  steps: Array<{ step: string; status: string; progress: number }>;
}

@ApiTags('Workflow')
@Controller('projects/:projectId/versions/:versionId/workflow')
export class WorkflowSSEController {
  private readonly logger = new Logger(WorkflowSSEController.name);

  constructor(
    private readonly workflowService: WorkflowService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('progress/stream')
  @Sse()
  @ApiOperation({ summary: 'Stream workflow progress via SSE' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiParam({ name: 'versionId', format: 'uuid' })
  async streamProgress(
    @CurrentUser() userId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
  ): Promise<Observable<MessageEvent>> {
    if (!this.config.FEATURE_SSE_ENABLED) {
      throw new NotFoundException('SSE streaming is not enabled');
    }

    // Verify ownership via the latest execution lookup
    const execution = await this.workflowService.getLatestExecution(projectId, versionId, userId);

    if (!execution) {
      throw new NotFoundException('No workflow execution found for this version');
    }

    const initialSnapshot: WorkflowProgressEvent = {
      executionId: execution.id,
      status: execution.status,
      currentStep: execution.currentStep,
      progress: execution.progress,
      steps: execution.steps.map((s) => ({
        step: s.step,
        status: s.status,
        progress: s.progress,
      })),
    };

    const eventName = `workflow.progress.${versionId}`;

    this.logger.debug(
      { projectId, versionId, executionId: execution.id },
      'SSE stream started',
    );

    const progressEvents$: Observable<MessageEvent> = fromEvent<WorkflowProgressEvent>(
      this.eventEmitter,
      eventName,
    ).pipe(
      takeWhile(
        (event) =>
          event.status !== 'completed' &&
          event.status !== 'failed' &&
          event.status !== 'cancelled',
        true, // include the terminal event
      ),
      map((event) => ({ data: event })),
    );

    return progressEvents$.pipe(
      startWith({ data: initialSnapshot } as MessageEvent),
    );
  }
}
