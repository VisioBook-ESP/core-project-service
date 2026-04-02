import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ProjectService } from './project.service.js';
import { VersionService } from '../version/version.service.js';
import { WorkflowService } from '../workflow/workflow.service.js';
import { CreateProjectDtoClass } from './dto/create-project.dto.js';
import { CreateAndGenerateDtoClass } from './dto/create-and-generate.dto.js';
import { UpdateProjectDtoClass } from './dto/update-project.dto.js';
import { ProjectResponseDtoClass } from './dto/project-response.dto.js';
import { ListProjectsQueryDtoClass } from './dto/list-projects-query.dto.js';
import { SearchProjectsQueryDtoClass } from './dto/search-projects-query.dto.js';
import { APP_CONFIG } from '../common/config/app.config.js';
import type { AppConfig } from '../common/config/app.config.js';

@ApiTags('Projects')
@Controller('projects')
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly versionService: VersionService,
    private readonly workflowService: WorkflowService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, type: ProjectResponseDtoClass })
  async create(@CurrentUser() userId: string, @Body() dto: CreateProjectDtoClass) {
    return this.projectService.create(userId, dto);
  }

  @Post('generate')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a project and start generation in one step' })
  @ApiResponse({ status: 201, description: 'Project created and workflow started' })
  async createAndGenerate(@CurrentUser() userId: string, @Body() dto: CreateAndGenerateDtoClass) {
    const project = await this.projectService.create(userId, dto);
    const version = await this.versionService.create(project.id, userId, {});
    const correlationId = randomUUID();
    const execution = await this.workflowService.startWorkflow(
      project.id,
      version.id,
      userId,
      correlationId,
    );
    return {
      projectId: project.id,
      versionId: version.id,
      executionId: execution.id,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List projects for the current user' })
  @ApiResponse({ status: 200, type: [ProjectResponseDtoClass] })
  async findAll(@CurrentUser() userId: string, @Query() query: ListProjectsQueryDtoClass) {
    return this.projectService.findAllByUser(userId, query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search projects by text' })
  @ApiResponse({ status: 200 })
  async search(@CurrentUser() userId: string, @Query() query: SearchProjectsQueryDtoClass) {
    if (!this.config.FEATURE_SEARCH_ENABLED) {
      throw new NotFoundException('Search is not available');
    }
    return this.projectService.search(userId, query.q, query.page, query.pageSize, query.status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProjectResponseDtoClass })
  async findOne(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.projectService.findById(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProjectResponseDtoClass })
  async update(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDtoClass,
  ) {
    return this.projectService.update(id, userId, dto);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Archive a project' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProjectResponseDtoClass })
  async archive(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.projectService.archiveProject(id, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a project' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204 })
  async remove(@CurrentUser() userId: string, @Param('id') id: string) {
    await this.projectService.softDelete(id, userId);
  }
}
