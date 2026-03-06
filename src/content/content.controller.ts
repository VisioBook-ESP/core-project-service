import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ContentService } from './content.service.js';
import { UpdateContentDtoClass } from './dto/update-content.dto.js';
import { ContentResponseDtoClass } from './dto/content-response.dto.js';
import { SceneResponseDtoClass } from './dto/scene-response.dto.js';

@ApiTags('Content')
@Controller('projects/:projectId/content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @ApiOperation({ summary: 'Get project content' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiResponse({ status: 200, type: ContentResponseDtoClass })
  async getContent(@CurrentUser() userId: string, @Param('projectId') projectId: string) {
    return this.contentService.getContent(projectId, userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update project content' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiResponse({ status: 200, type: ContentResponseDtoClass })
  async updateContent(
    @CurrentUser() userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateContentDtoClass,
  ) {
    return this.contentService.updateContent(projectId, userId, dto);
  }

  @Get('scenes')
  @ApiOperation({ summary: 'List scenes for a project' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiResponse({ status: 200, type: [SceneResponseDtoClass] })
  async listScenes(@CurrentUser() userId: string, @Param('projectId') projectId: string) {
    return this.contentService.listScenes(projectId, userId);
  }
}
