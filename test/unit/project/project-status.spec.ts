import { ConflictException } from '@nestjs/common';
import { ProjectService } from '../../../src/project/project.service.js';

function createMocks() {
  const mockPrisma = {
    project: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    projectContent: {
      findUnique: vi.fn(),
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

  const service = new ProjectService(
    mockPrisma as never,
    mockNatsPublisher as never,
    mockCache as never,
  );

  return { service, mockPrisma, mockNatsPublisher, mockCache };
}

describe('ProjectService — status operations', () => {
  describe('activateIfDraft', () => {
    it('should call updateMany with correct where and data', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.project.updateMany.mockResolvedValue({ count: 1 });

      await service.activateIfDraft('p1');

      expect(mockPrisma.project.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', status: 'draft' },
        data: { status: 'active' },
      });
    });
  });

  describe('archiveProject', () => {
    it('should set status to archived', async () => {
      const { service, mockPrisma } = createMocks();
      const project = { id: 'p1', userId: 'u1', deletedAt: null, status: 'active' };
      mockPrisma.project.findFirst.mockResolvedValue(project);
      mockPrisma.projectVersion.findFirst.mockResolvedValue(null);
      const archived = { ...project, status: 'archived' };
      mockPrisma.project.update.mockResolvedValue(archived);

      const result = await service.archiveProject('p1', 'u1');

      expect(result.status).toBe('archived');
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'archived' },
      });
    });

    it('should throw ConflictException if already archived', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.project.findFirst.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        deletedAt: null,
        status: 'archived',
      });

      await expect(service.archiveProject('p1', 'u1')).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if active workflow exists', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.project.findFirst.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        deletedAt: null,
        status: 'active',
      });
      mockPrisma.projectVersion.findFirst.mockResolvedValue({
        id: 'v1',
        status: 'analyzing',
      });

      await expect(service.archiveProject('p1', 'u1')).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllByUser', () => {
    it('should add status to where clause when status filter provided', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.count.mockResolvedValue(0);

      await service.findAllByUser('u1', {
        page: 1,
        pageSize: 10,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        status: 'active',
      });

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        }),
      );
    });

    it('should not include status in where clause when no status filter', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.count.mockResolvedValue(0);

      await service.findAllByUser('u1', {
        page: 1,
        pageSize: 10,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      const callArg = mockPrisma.project.findMany.mock.calls[0][0];
      expect(callArg.where.status).toBeUndefined();
    });
  });
});
