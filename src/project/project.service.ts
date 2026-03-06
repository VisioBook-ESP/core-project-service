import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service.js';
import { NatsPublisher } from '../messaging/nats.publisher.js';
import type { Project, Prisma } from '../generated/prisma/client.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import type { UpdateProjectDto } from './dto/update-project.dto.js';
import type { ListProjectsQueryDto } from './dto/list-projects-query.dto.js';
import type { PaginatedResponse } from '../common/types/index.js';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly natsPublisher: NatsPublisher,
  ) {}

  async ensureOwnership(projectId: string, userId: string): Promise<Project> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
        deletedAt: null,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const wordCount = dto.content.text.split(/\s+/).filter(Boolean).length;

    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          userId,
          title: dto.title,
          sourceType: dto.sourceType,
          config: (dto.config ?? {}) as Prisma.InputJsonValue,
          content: {
            create: {
              text: dto.content.text,
              wordCount,
              metadata: (dto.content.metadata ?? {}) as Prisma.InputJsonValue,
            },
          },
        },
        include: { content: true },
      });

      return created;
    });

    this.logger.log({ projectId: project.id, userId }, 'Project created');
    return project;
  }

  async findById(projectId: string, userId: string): Promise<Project> {
    await this.ensureOwnership(projectId, userId);

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId, deletedAt: null },
      include: { content: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async findAllByUser(
    userId: string,
    query: ListProjectsQueryDto,
  ): Promise<PaginatedResponse<Project>> {
    const where = { userId, deletedAt: null };
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take: query.pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async update(projectId: string, userId: string, dto: UpdateProjectDto): Promise<Project> {
    await this.ensureOwnership(projectId, userId);

    const activeVersion = await this.prisma.projectVersion.findFirst({
      where: {
        projectId,
        status: { in: ['analyzing', 'generating'] },
      },
    });

    if (activeVersion) {
      throw new ConflictException('Cannot update project while a workflow is active');
    }

    const data: Prisma.ProjectUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.config !== undefined) data.config = dto.config as Prisma.InputJsonValue;

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data,
    });

    this.logger.log({ projectId, userId }, 'Project updated');
    return updated;
  }

  async softDelete(projectId: string, userId: string): Promise<void> {
    await this.ensureOwnership(projectId, userId);

    await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });

    await this.natsPublisher.publishProjectDeleted({
      projectId,
      userId,
      timestamp: new Date().toISOString(),
      correlationId: projectId,
    });

    this.logger.log({ projectId, userId }, 'Project soft-deleted');
  }
}
