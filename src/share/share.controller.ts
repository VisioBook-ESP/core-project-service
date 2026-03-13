import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Inject,
  HttpCode,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { APP_CONFIG } from '../common/config/app.config.js';
import type { AppConfig } from '../common/config/app.config.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ShareService } from './share.service.js';
import { CreateShareLinkDtoClass } from './dto/create-share-link.dto.js';
import { ShareLinkResponseDtoClass } from './dto/share-link-response.dto.js';
import { SharedProjectResponseDtoClass } from './dto/shared-project-response.dto.js';

@ApiTags('Sharing')
@Controller()
export class ShareController {
  constructor(
    private readonly shareService: ShareService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private ensureShareEnabled(): void {
    if (!this.config.FEATURE_SHARE_ENABLED) {
      throw new NotFoundException('Share feature is not available');
    }
  }

  @Post('projects/:projectId/share')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a share link for a project' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiResponse({ status: 201, type: ShareLinkResponseDtoClass })
  async createShareLink(
    @CurrentUser() userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateShareLinkDtoClass,
  ): Promise<ShareLinkResponseDtoClass> {
    this.ensureShareEnabled();
    return this.shareService.createShareLink(projectId, userId, dto);
  }

  @Public()
  @Get('shared/:token')
  @ApiOperation({ summary: 'Access a shared project by token' })
  @ApiParam({ name: 'token' })
  @ApiResponse({ status: 200, type: SharedProjectResponseDtoClass })
  async accessSharedProject(@Param('token') token: string): Promise<SharedProjectResponseDtoClass> {
    this.ensureShareEnabled();
    return this.shareService.accessSharedProject(token);
  }
}
