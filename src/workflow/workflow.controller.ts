import { Controller, Get, Post, Body, Param, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { WorkflowService } from './workflow.service.js';
import { StartWorkflowDtoClass } from './dto/start-workflow.dto.js';
import { WorkflowStatusResponseDtoClass } from './dto/workflow-status-response.dto.js';

@ApiTags('Workflow')
@Controller('projects/:projectId/versions/:versionId/workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('start')
  @HttpCode(201)
  @ApiOperation({ summary: 'Start a workflow for a version' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiParam({ name: 'versionId', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Workflow started' })
  async start(
    @CurrentUser() userId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Body() dto: StartWorkflowDtoClass,
  ) {
    const correlationId = dto.correlationId ?? randomUUID();
    return this.workflowService.startWorkflow(projectId, versionId, userId, correlationId);
  }

  @Get('status/:executionId')
  @ApiOperation({ summary: 'Get workflow execution status' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiParam({ name: 'versionId', format: 'uuid' })
  @ApiParam({ name: 'executionId', format: 'uuid' })
  @ApiResponse({ status: 200, type: WorkflowStatusResponseDtoClass })
  async getStatus(
    @CurrentUser() userId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('executionId') executionId: string,
  ) {
    return this.workflowService.getStatus(projectId, versionId, executionId, userId);
  }

  @Post('cancel/:executionId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a running workflow' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiParam({ name: 'versionId', format: 'uuid' })
  @ApiParam({ name: 'executionId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Workflow cancelled' })
  async cancel(
    @CurrentUser() userId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('executionId') executionId: string,
  ) {
    await this.workflowService.cancelWorkflow(projectId, versionId, executionId, userId);
  }

  @Post('retry/:executionId')
  @HttpCode(202)
  @ApiOperation({ summary: 'Retry a failed workflow' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiParam({ name: 'versionId', format: 'uuid' })
  @ApiParam({ name: 'executionId', format: 'uuid' })
  @ApiResponse({ status: 202, description: 'Workflow retry started' })
  async retry(
    @CurrentUser() userId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('executionId') _executionId: string,
  ) {
    const correlationId = randomUUID();
    return this.workflowService.retryWorkflow(projectId, versionId, userId, correlationId);
  }
}
