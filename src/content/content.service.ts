import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service.js';
import { ProjectService } from '../project/project.service.js';
import { CacheService } from '../common/cache/cache.service.js';
import { sanitizeText } from '../common/utils/sanitize.js';
import type { ProjectContent, Scene, Character, Dialogue, Prisma } from '../generated/prisma/client.js';
import type { UpdateContentDto } from './dto/update-content.dto.js';
import type { UpdateSceneDto } from './dto/update-scene.dto.js';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly cache: CacheService,
  ) {}

  async getContent(projectId: string, userId: string): Promise<ProjectContent> {
    await this.projectService.ensureOwnership(projectId, userId);

    const cached = await this.cache.get<ProjectContent>('content:' + projectId);
    if (cached) return cached;

    const content = await this.prisma.projectContent.findUnique({
      where: { projectId },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    await this.cache.set('content:' + projectId, content, 300);
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
      data.text = sanitizeText(dto.text);
      data.wordCount = (data.text as string).split(/\s+/).filter(Boolean).length;
    }

    if (dto.metadata !== undefined) {
      data.metadata = dto.metadata as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.projectContent.update({
      where: { projectId },
      data,
    });

    await this.cache.del('content:' + projectId);

    this.logger.log({ projectId, userId }, 'Content updated');
    return updated;
  }

  async listScenes(projectId: string, userId: string): Promise<(Scene & { dialogues: Dialogue[] })[]> {
    await this.projectService.ensureOwnership(projectId, userId);

    return this.prisma.scene.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      include: { dialogues: { orderBy: { order: 'asc' } } },
    });
  }

  async getSummary(projectId: string, userId: string): Promise<{ summary: string | null }> {
    await this.projectService.ensureOwnership(projectId, userId);

    const cached = await this.cache.get<{ summary: string | null }>('summary:' + projectId);
    if (cached) return cached;

    const content = await this.prisma.projectContent.findUnique({
      where: { projectId },
      select: { summary: true },
    });

    const result = { summary: content?.summary ?? null };
    await this.cache.set('summary:' + projectId, result, 600);
    return result;
  }

  async updateScene(
    projectId: string,
    sceneId: string,
    userId: string,
    dto: UpdateSceneDto,
  ): Promise<Scene> {
    await this.projectService.ensureOwnership(projectId, userId);

    const scene = await this.prisma.scene.findFirst({
      where: { id: sceneId, projectId },
    });

    if (!scene) {
      throw new NotFoundException('Scene not found');
    }

    const sanitizedData: Record<string, unknown> = {};
    if (dto.text !== undefined) sanitizedData.text = sanitizeText(dto.text);
    if (dto.description !== undefined) sanitizedData.description = sanitizeText(dto.description);
    if (dto.imagePrompt !== undefined) sanitizedData.imagePrompt = sanitizeText(dto.imagePrompt);
    const updateData = { ...dto, ...sanitizedData };

    const updated = await this.prisma.scene.update({
      where: { id: sceneId },
      data: updateData,
    });

    this.logger.log({ projectId, sceneId, userId }, 'Scene updated');
    return updated;
  }

  async listCharacters(projectId: string, userId: string): Promise<Character[]> {
    await this.projectService.ensureOwnership(projectId, userId);

    return this.prisma.character.findMany({
      where: { projectId },
    });
  }
}
