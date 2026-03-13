import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../common/database/prisma.service.js';
import { ProjectService } from '../project/project.service.js';
import type { CreateShareLinkDto } from './dto/create-share-link.dto.js';
import type { ShareLinkResponseDto } from './dto/share-link-response.dto.js';
import type { SharedProjectResponseDto } from './dto/shared-project-response.dto.js';

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
  ) {}

  async createShareLink(
    projectId: string,
    userId: string,
    dto: CreateShareLinkDto,
  ): Promise<ShareLinkResponseDto> {
    await this.projectService.ensureOwnership(projectId, userId);

    const shareToken = randomBytes(32).toString('base64url');

    const shareLink = await this.prisma.shareLink.create({
      data: {
        projectId,
        shareToken,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        allowDownload: dto.allowDownload ?? false,
      },
    });

    this.logger.log({ projectId, userId, shareLinkId: shareLink.id }, 'Share link created');

    return {
      id: shareLink.id,
      projectId: shareLink.projectId,
      shareToken: shareLink.shareToken,
      expiresAt: shareLink.expiresAt,
      allowDownload: shareLink.allowDownload,
      createdAt: shareLink.createdAt,
    };
  }

  async accessSharedProject(token: string): Promise<SharedProjectResponseDto> {
    const shareLink = await this.prisma.shareLink.findUnique({
      where: { shareToken: token },
      include: {
        project: {
          include: {
            versions: {
              where: { status: 'completed' },
              orderBy: { versionNumber: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!shareLink) {
      throw new NotFoundException('Shared project not found');
    }

    if (shareLink.project.deletedAt) {
      throw new NotFoundException('Shared project not found');
    }

    if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
      throw new NotFoundException('Shared project not found');
    }

    if (shareLink.passwordHash) {
      return {
        title: shareLink.project.title,
        videoUrl: null,
        allowDownload: shareLink.allowDownload,
        requiresPassword: true,
        createdAt: shareLink.project.createdAt,
      };
    }

    const latestVersion = shareLink.project.versions[0] ?? null;

    return {
      title: shareLink.project.title,
      videoUrl: latestVersion?.videoUrl ?? null,
      allowDownload: shareLink.allowDownload,
      requiresPassword: false,
      createdAt: shareLink.project.createdAt,
    };
  }
}
