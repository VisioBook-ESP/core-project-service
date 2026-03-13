import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ContentService } from './content.service.js';
import { UpdateContentDtoClass } from './dto/update-content.dto.js';
import { ContentResponseDtoClass } from './dto/content-response.dto.js';
import { SceneResponseDtoClass } from './dto/scene-response.dto.js';
import { UpdateSceneDtoClass } from './dto/update-scene.dto.js';
import { CharacterResponseDtoClass } from './dto/character-response.dto.js';

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

  @Get('summary')
  @ApiOperation({ summary: 'Get project content summary' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Returns the content summary' })
  async getSummary(@CurrentUser() userId: string, @Param('projectId') projectId: string) {
    return this.contentService.getSummary(projectId, userId);
  }

  @Patch('scenes/:sceneId')
  @ApiOperation({ summary: 'Update a scene' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiParam({ name: 'sceneId', format: 'uuid' })
  @ApiResponse({ status: 200, type: SceneResponseDtoClass })
  async updateScene(
    @CurrentUser() userId: string,
    @Param('projectId') projectId: string,
    @Param('sceneId') sceneId: string,
    @Body() dto: UpdateSceneDtoClass,
  ) {
    return this.contentService.updateScene(projectId, sceneId, userId, dto);
  }

  @Get('characters')
  @ApiOperation({ summary: 'List characters for a project' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiResponse({ status: 200, type: [CharacterResponseDtoClass] })
  async listCharacters(@CurrentUser() userId: string, @Param('projectId') projectId: string) {
    return this.contentService.listCharacters(projectId, userId);
  }
}
