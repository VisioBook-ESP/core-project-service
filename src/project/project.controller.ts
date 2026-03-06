import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ProjectService } from './project.service.js';
import { CreateProjectDtoClass } from './dto/create-project.dto.js';
import { UpdateProjectDtoClass } from './dto/update-project.dto.js';
import { ProjectResponseDtoClass } from './dto/project-response.dto.js';
import { ListProjectsQueryDtoClass } from './dto/list-projects-query.dto.js';

@ApiTags('Projects')
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, type: ProjectResponseDtoClass })
  async create(@CurrentUser() userId: string, @Body() dto: CreateProjectDtoClass) {
    return this.projectService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List projects for the current user' })
  async findAll(@CurrentUser() userId: string, @Query() query: ListProjectsQueryDtoClass) {
    return this.projectService.findAllByUser(userId, query);
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

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a project' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204 })
  async remove(@CurrentUser() userId: string, @Param('id') id: string) {
    await this.projectService.softDelete(id, userId);
  }
}
