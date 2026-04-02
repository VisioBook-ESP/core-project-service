import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProjectService } from '../../../src/project/project.service.js';

function createMocks() {
  const mockPrisma = {
    project: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    projectContent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    projectVersion: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
  };

  const mockNatsPublisher = {
    publishProjectDeleted: vi.fn().mockResolvedValue(undefined),
  };

  const mockCache = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  };

  const mockContentIngestionClient = {
    fetchExtractedText: vi.fn().mockResolvedValue({
      text: 'extracted text',
      wordCount: 2,
      metadata: {},
    }),
  };

  const service = new ProjectService(
    mockPrisma as never,
    mockNatsPublisher as never,
    mockCache as never,
    mockContentIngestionClient as never,
  );

  return { service, mockPrisma, mockNatsPublisher, mockContentIngestionClient };
}

describe('ProjectService', () => {
  describe('ensureOwnership', () => {
    it('should return project when ownership matches', async () => {
      const { service, mockPrisma } = createMocks();
      const project = { id: 'p1', userId: 'u1', deletedAt: null };
      mockPrisma.project.findFirst.mockResolvedValue(project);

      const result = await service.ensureOwnership('p1', 'u1');
      expect(result).toBe(project);
      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'p1', userId: 'u1', deletedAt: null },
      });
    });

    it('should throw NotFoundException when project not found', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(service.ensureOwnership('p1', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for wrong userId (not 403)', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(service.ensureOwnership('p1', 'wrong-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create project with title and config', async () => {
      const { service, mockPrisma } = createMocks();
      const created = { id: 'p1', userId: 'u1', title: 'Test' };
      const projectWithContent = { ...created, content: null };
      mockPrisma.project.create.mockResolvedValue(created);
      mockPrisma.project.findFirstOrThrow.mockResolvedValue(projectWithContent);

      const dto = {
        title: 'Test',
        config: {},
      };

      const result = await service.create('u1', dto);

      expect(result).toEqual(projectWithContent);
      expect(mockPrisma.project.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          title: 'Test',
          config: {},
        },
      });
    });

    it('should fetch content when fileId is provided', async () => {
      const { service, mockPrisma, mockContentIngestionClient } = createMocks();
      const created = { id: 'p1', userId: 'u1', title: 'Test' };
      const projectWithContent = { ...created, content: { text: 'extracted text', wordCount: 2 } };
      mockPrisma.project.create.mockResolvedValue(created);
      mockPrisma.project.findFirstOrThrow.mockResolvedValue(projectWithContent);
      mockPrisma.projectContent.create.mockResolvedValue({});

      const dto = {
        title: 'Test',
        fileId: 'file-123',
        config: {},
      };

      const result = await service.create('u1', dto);

      expect(result).toEqual(projectWithContent);
      expect(mockContentIngestionClient.fetchExtractedText).toHaveBeenCalledWith('file-123', {
        userId: 'u1',
      });
      expect(mockPrisma.projectContent.create).toHaveBeenCalled();
    });
  });

  describe('findAllByUser', () => {
    it('should return paginated results', async () => {
      const { service, mockPrisma } = createMocks();
      const items = [{ id: 'p1' }, { id: 'p2' }];
      mockPrisma.project.findMany.mockResolvedValue(items);
      mockPrisma.project.count.mockResolvedValue(25);

      const result = await service.findAllByUser('u1', {
        page: 2,
        pageSize: 10,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      expect(result.items).toBe(items);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  describe('update', () => {
    it('should update project when no active workflow', async () => {
      const { service, mockPrisma } = createMocks();
      const project = { id: 'p1', userId: 'u1', deletedAt: null };
      mockPrisma.project.findFirst.mockResolvedValue(project);
      mockPrisma.projectVersion.findFirst.mockResolvedValue(null);
      const updated = { ...project, title: 'Updated' };
      mockPrisma.project.update.mockResolvedValue(updated);

      const result = await service.update('p1', 'u1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });

    it('should throw ConflictException when a workflow is active', async () => {
      const { service, mockPrisma } = createMocks();
      const project = { id: 'p1', userId: 'u1', deletedAt: null };
      mockPrisma.project.findFirst.mockResolvedValue(project);
      mockPrisma.projectVersion.findFirst.mockResolvedValue({ id: 'v1', status: 'analyzing' });

      await expect(service.update('p1', 'u1', { title: 'Updated' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('softDelete', () => {
    it('should soft-delete project and publish event', async () => {
      const { service, mockPrisma, mockNatsPublisher } = createMocks();
      const project = { id: 'p1', userId: 'u1', deletedAt: null };
      mockPrisma.project.findFirst.mockResolvedValue(project);
      mockPrisma.project.update.mockResolvedValue({ ...project, deletedAt: new Date() });

      await service.softDelete('p1', 'u1');

      expect(mockPrisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(mockNatsPublisher.publishProjectDeleted).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'p1',
          userId: 'u1',
        }),
      );
    });

    it('should throw NotFoundException for non-owned project', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(service.softDelete('p1', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
