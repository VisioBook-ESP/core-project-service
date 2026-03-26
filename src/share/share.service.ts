import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
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

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : null;

    const shareLink = await this.prisma.shareLink.create({
      data: {
        projectId,
        shareToken,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        allowDownload: dto.allowDownload ?? false,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });

    this.logger.log({ projectId, userId, shareLinkId: shareLink.id }, 'Share link created');

    return {
      id: shareLink.id,
      projectId: shareLink.projectId,
      shareToken: shareLink.shareToken,
      expiresAt: shareLink.expiresAt,
      allowDownload: shareLink.allowDownload,
      isPasswordProtected: !!shareLink.passwordHash,
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

  async verifySharePassword(
    token: string,
    password: string,
  ): Promise<SharedProjectResponseDto> {
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

    if (!shareLink.passwordHash) {
      throw new BadRequestException('This share link is not password-protected');
    }

    const isValid = await bcrypt.compare(password, shareLink.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid password');
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

  async getShareLinkInfo(
    projectId: string,
    userId: string,
  ): Promise<ShareLinkResponseDto | null> {
    await this.projectService.ensureOwnership(projectId, userId);

    const shareLink = await this.prisma.shareLink.findFirst({
      where: { projectId },
    });

    if (!shareLink) {
      return null;
    }

    return {
      id: shareLink.id,
      projectId: shareLink.projectId,
      shareToken: shareLink.shareToken,
      expiresAt: shareLink.expiresAt,
      allowDownload: shareLink.allowDownload,
      isPasswordProtected: !!shareLink.passwordHash,
      createdAt: shareLink.createdAt,
    };
  }

  async deleteShareLink(projectId: string, userId: string): Promise<void> {
    await this.projectService.ensureOwnership(projectId, userId);

    const result = await this.prisma.shareLink.deleteMany({
      where: { projectId },
    });

    if (result.count === 0) {
      throw new NotFoundException('No share link found for this project');
    }

    this.logger.log({ projectId, userId }, 'Share link deleted');
  }
}
