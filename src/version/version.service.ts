import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service.js';
import { ProjectService } from '../project/project.service.js';
import type { ProjectVersion, Prisma } from '../generated/prisma/client.js';
import type { CreateVersionDto } from './dto/create-version.dto.js';

@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
  ) {}

  async create(
    projectId: string,
    userId: string,
    dto: CreateVersionDto,
  ): Promise<ProjectVersion> {
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

    return version;
  }

  async listByProject(
    projectId: string,
    userId: string,
  ): Promise<ProjectVersion[]> {
    await this.projectService.ensureOwnership(projectId, userId);

    return this.prisma.projectVersion.findMany({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async findById(
    projectId: string,
    versionId: string,
    userId: string,
  ): Promise<ProjectVersion> {
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
}
