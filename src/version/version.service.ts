import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service.js';
import { ProjectService } from '../project/project.service.js';
import type { ProjectVersion, Prisma } from '../generated/prisma/client.js';
import type { CreateVersionDto } from './dto/create-version.dto.js';
import type { VersionCompareResponseDto } from './dto/version-compare-response.dto.js';

@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
  ) {}

  async create(projectId: string, userId: string, dto: CreateVersionDto): Promise<ProjectVersion> {
    const project = await this.projectService.ensureOwnership(projectId, userId);

    const aggregate = await this.prisma.projectVersion.aggregate({
      where: { projectId },
      _max: { versionNumber: true },
    });

    const nextVersion = (aggregate._max.versionNumber ?? 0) + 1;

    const config = dto.config ?? (project.config as Record<string, unknown>);

    const version = await this.prisma.projectVersion.create({
      data: {
        projectId,
        versionNumber: nextVersion,
        config: config as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      { projectId, versionId: version.id, versionNumber: nextVersion, userId },
      'Version created',
    );

    await this.projectService.activateIfDraft(projectId);

    return version;
  }

  async listByProject(projectId: string, userId: string): Promise<ProjectVersion[]> {
    await this.projectService.ensureOwnership(projectId, userId);

    return this.prisma.projectVersion.findMany({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async findById(projectId: string, versionId: string, userId: string): Promise<ProjectVersion> {
    await this.projectService.ensureOwnership(projectId, userId);

    const version = await this.prisma.projectVersion.findFirst({
      where: { id: versionId, projectId },
      include: {
        executions: {
          include: { steps: true },
        },
      },
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    return version;
  }

  async compareVersions(
    projectId: string,
    v1Id: string,
    v2Id: string,
    userId: string,
  ): Promise<VersionCompareResponseDto> {
    await this.projectService.ensureOwnership(projectId, userId);

    const [version1, version2] = await Promise.all([
      this.prisma.projectVersion.findFirst({ where: { id: v1Id, projectId } }),
      this.prisma.projectVersion.findFirst({ where: { id: v2Id, projectId } }),
    ]);

    if (!version1) {
      throw new NotFoundException('Version 1 not found');
    }

    if (!version2) {
      throw new NotFoundException('Version 2 not found');
    }

    const config1 = (version1.config ?? {}) as Record<string, unknown>;
    const config2 = (version2.config ?? {}) as Record<string, unknown>;

    const configDiff = this.computeConfigDiff(config1, config2);

    return {
      version1: {
        id: version1.id,
        versionNumber: version1.versionNumber,
        status: version1.status,
        config: config1,
        videoUrl: version1.videoUrl,
        createdAt: version1.createdAt,
      },
      version2: {
        id: version2.id,
        versionNumber: version2.versionNumber,
        status: version2.status,
        config: config2,
        videoUrl: version2.videoUrl,
        createdAt: version2.createdAt,
      },
      configDiff,
    };
  }

  async revertToVersion(
    projectId: string,
    versionId: string,
    userId: string,
  ): Promise<ProjectVersion> {
    await this.projectService.ensureOwnership(projectId, userId);

    const sourceVersion = await this.prisma.projectVersion.findFirst({
      where: { id: versionId, projectId },
    });

    if (!sourceVersion) {
      throw new NotFoundException('Version not found');
    }

    return this.create(projectId, userId, {
      config: sourceVersion.config as Record<string, unknown>,
    });
  }

  private computeConfigDiff(
    config1: Record<string, unknown>,
    config2: Record<string, unknown>,
  ): {
    added: Record<string, unknown>;
    removed: Record<string, unknown>;
    changed: Record<string, { from: unknown; to: unknown }>;
  } {
    const added: Record<string, unknown> = {};
    const removed: Record<string, unknown> = {};
    const changed: Record<string, { from: unknown; to: unknown }> = {};

    const allKeys = new Set([...Object.keys(config1), ...Object.keys(config2)]);

    for (const key of allKeys) {
      const inV1 = key in config1;
      const inV2 = key in config2;

      if (!inV1 && inV2) {
        added[key] = config2[key];
      } else if (inV1 && !inV2) {
        removed[key] = config1[key];
      } else if (inV1 && inV2) {
        if (JSON.stringify(config1[key]) !== JSON.stringify(config2[key])) {
          changed[key] = { from: config1[key], to: config2[key] };
        }
      }
    }

    return { added, removed, changed };
  }
}
