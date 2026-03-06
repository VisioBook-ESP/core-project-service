import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service.js';
import { ProjectService } from '../project/project.service.js';
import type { ProjectContent, Scene, Prisma } from '../generated/prisma/client.js';
import type { UpdateContentDto } from './dto/update-content.dto.js';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
  ) {}

  async getContent(projectId: string, userId: string): Promise<ProjectContent> {
    await this.projectService.ensureOwnership(projectId, userId);

    const content = await this.prisma.projectContent.findUnique({
      where: { projectId },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    return content;
  }

  async updateContent(
    projectId: string,
    userId: string,
    dto: UpdateContentDto,
  ): Promise<ProjectContent> {
    await this.projectService.ensureOwnership(projectId, userId);

    const data: Prisma.ProjectContentUpdateInput = {};

    if (dto.text !== undefined) {
      data.text = dto.text;
      data.wordCount = dto.text.split(/\s+/).filter(Boolean).length;
    }

    if (dto.metadata !== undefined) {
      data.metadata = dto.metadata as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.projectContent.update({
      where: { projectId },
      data,
    });

    this.logger.log({ projectId, userId }, 'Content updated');
    return updated;
  }

  async listScenes(projectId: string, userId: string): Promise<Scene[]> {
    await this.projectService.ensureOwnership(projectId, userId);

    return this.prisma.scene.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }
}
