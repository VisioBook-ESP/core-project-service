import { Controller, Get, Post, Body, Param, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { VersionService } from './version.service.js';
import { CreateVersionDtoClass } from './dto/create-version.dto.js';
import { VersionResponseDtoClass } from './dto/version-response.dto.js';

@ApiTags('Versions')
@Controller('projects/:projectId/versions')
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new version for a project' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiResponse({ status: 201, type: VersionResponseDtoClass })
  async create(
    @CurrentUser() userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateVersionDtoClass,
  ) {
    return this.versionService.create(projectId, userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List versions for a project' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiResponse({ status: 200, type: [VersionResponseDtoClass] })
  async findAll(@CurrentUser() userId: string, @Param('projectId') projectId: string) {
    return this.versionService.listByProject(projectId, userId);
  }

  @Get(':versionId')
  @ApiOperation({ summary: 'Get a version by ID with executions' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiParam({ name: 'versionId', format: 'uuid' })
  @ApiResponse({ status: 200, type: VersionResponseDtoClass })
  async findOne(
    @CurrentUser() userId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.versionService.findById(projectId, versionId, userId);
  }
}
