import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service.js';
import { NatsPublisher } from '../messaging/nats.publisher.js';
import { CacheService } from '../common/cache/cache.service.js';
import { ContentIngestionClient } from '../clients/content-ingestion.client.js';
import { sanitizeText } from '../common/utils/sanitize.js';
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
    private readonly cache: CacheService,
    private readonly contentIngestionClient: ContentIngestionClient,
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
    const sanitizedTitle = sanitizeText(dto.title);

    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          userId,
          title: sanitizedTitle,
          config: (dto.config ?? {}) as Prisma.InputJsonValue,
        },
      });

      if (dto.fileId) {
        const extracted = await this.contentIngestionClient.fetchExtractedText(dto.fileId, {
          userId,
        });
        await tx.projectContent.create({
          data: {
            projectId: created.id,
            text: sanitizeText(extracted.text),
            wordCount: extracted.wordCount,
            metadata: (extracted.metadata ?? {}) as Prisma.InputJsonValue,
          },
        });
      }

      return tx.project.findFirstOrThrow({
        where: { id: created.id },
        include: { content: true },
      });
    });

    this.logger.log({ projectId: project.id, userId }, 'Project created');
    return project;
  }

  async findById(projectId: string, userId: string): Promise<Project> {
    await this.ensureOwnership(projectId, userId);

    const cacheKey = 'project:' + userId + ':' + projectId;
    const cached = await this.cache.get<Project>(cacheKey);
    if (cached) return cached;

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId, deletedAt: null },
      include: { content: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.cache.set(cacheKey, project, 300);
    return project;
  }

  async findAllByUser(
    userId: string,
    query: ListProjectsQueryDto,
  ): Promise<PaginatedResponse<Project>> {
    const where: Prisma.ProjectWhereInput = { userId, deletedAt: null };

    if (query.status) {
      where.status = query.status;
    }

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
    if (dto.title !== undefined) data.title = sanitizeText(dto.title);
    if (dto.config !== undefined) data.config = dto.config as Prisma.InputJsonValue;

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data,
    });

    await this.cache.del('project:' + userId + ':' + projectId);

    this.logger.log({ projectId, userId }, 'Project updated');
    return updated;
  }

  async softDelete(projectId: string, userId: string): Promise<void> {
    await this.ensureOwnership(projectId, userId);

    await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });

    await this.cache.del('project:' + userId + ':' + projectId);

    await this.natsPublisher.publishProjectDeleted({
      projectId,
      userId,
      timestamp: new Date().toISOString(),
      correlationId: projectId,
    });

    this.logger.log({ projectId, userId }, 'Project soft-deleted');
  }

  async activateIfDraft(projectId: string): Promise<void> {
    await this.prisma.project.updateMany({
      where: { id: projectId, status: 'draft' },
      data: { status: 'active' },
    });
  }

  async archiveProject(projectId: string, userId: string): Promise<Project> {
    const project = await this.ensureOwnership(projectId, userId);

    if (project.status === 'archived') {
      throw new ConflictException('Project is already archived');
    }

    const activeVersion = await this.prisma.projectVersion.findFirst({
      where: {
        projectId,
        status: { in: ['analyzing', 'generating'] },
      },
    });

    if (activeVersion) {
      throw new ConflictException('Cannot archive project while a workflow is active');
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'archived' },
    });

    this.logger.log({ projectId, userId }, 'Project archived');
    return updated;
  }

  async search(
    userId: string,
    query: string,
    page: number = 1,
    pageSize: number = 20,
    status?: string,
  ): Promise<PaginatedResponse<Project>> {
    const offset = (page - 1) * pageSize;
    const tsQuery = query.trim();
    const statusFilter = status ?? null;

    const items = await this.prisma.$queryRaw<Project[]>`
      SELECT p."id", p."userId", p."title", p."status", p."config", p."createdAt", p."updatedAt", p."deletedAt" FROM "Project" p
      LEFT JOIN "ProjectContent" pc ON pc."projectId" = p.id
      WHERE p."userId" = ${userId}
        AND p."deletedAt" IS NULL
        AND (${statusFilter}::text IS NULL OR p."status" = ${statusFilter})
        AND (
          p."search_vector" @@ plainto_tsquery('english', ${tsQuery})
          OR pc."search_vector" @@ plainto_tsquery('english', ${tsQuery})
        )
      ORDER BY GREATEST(
        ts_rank(p."search_vector", plainto_tsquery('english', ${tsQuery})),
        COALESCE(ts_rank(pc."search_vector", plainto_tsquery('english', ${tsQuery})), 0)
      ) DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    const countResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM "Project" p
      LEFT JOIN "ProjectContent" pc ON pc."projectId" = p.id
      WHERE p."userId" = ${userId}
        AND p."deletedAt" IS NULL
        AND (${statusFilter}::text IS NULL OR p."status" = ${statusFilter})
        AND (
          p."search_vector" @@ plainto_tsquery('english', ${tsQuery})
          OR pc."search_vector" @@ plainto_tsquery('english', ${tsQuery})
        )
    `;

    const total = Number(countResult[0]?.count ?? 0);

    this.logger.log({ userId, query: tsQuery, total }, 'Search executed');

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
