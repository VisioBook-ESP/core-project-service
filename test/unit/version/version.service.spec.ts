import { NotFoundException } from '@nestjs/common';
import { VersionService } from '../../../src/version/version.service.js';

function createMocks() {
  const mockPrisma = {
    projectVersion: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };

  const mockProjectService = {
    ensureOwnership: vi.fn().mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      config: { style: 'default' },
    }),
  };

  const service = new VersionService(mockPrisma as never, mockProjectService as never);

  return { service, mockPrisma, mockProjectService };
}

describe('VersionService', () => {
  describe('create', () => {
    it('should auto-increment version number from max', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.projectVersion.aggregate.mockResolvedValue({
        _max: { versionNumber: 2 },
      });
      const version = { id: 'v1', projectId: 'p1', versionNumber: 3 };
      mockPrisma.projectVersion.create.mockResolvedValue(version);

      const result = await service.create('p1', 'u1', {});
      expect(result).toBe(version);
      expect(mockPrisma.projectVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'p1',
            versionNumber: 3,
          }),
        }),
      );
    });

    it('should start at version 1 when no versions exist', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.projectVersion.aggregate.mockResolvedValue({
        _max: { versionNumber: null },
      });
      const version = { id: 'v1', projectId: 'p1', versionNumber: 1 };
      mockPrisma.projectVersion.create.mockResolvedValue(version);

      const result = await service.create('p1', 'u1', {});
      expect(result.versionNumber).toBe(1);
      expect(mockPrisma.projectVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ versionNumber: 1 }),
        }),
      );
    });

    it('should use provided config over project config', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.projectVersion.aggregate.mockResolvedValue({
        _max: { versionNumber: null },
      });
      mockPrisma.projectVersion.create.mockResolvedValue({ id: 'v1' });

      await service.create('p1', 'u1', { config: { custom: true } });
      expect(mockPrisma.projectVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            config: { custom: true },
          }),
        }),
      );
    });

    it('should fall back to project config when dto.config is undefined', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.projectVersion.aggregate.mockResolvedValue({
        _max: { versionNumber: null },
      });
      mockPrisma.projectVersion.create.mockResolvedValue({ id: 'v1' });

      await service.create('p1', 'u1', {});
      expect(mockPrisma.projectVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            config: { style: 'default' },
          }),
        }),
      );
    });

    it('should verify ownership', async () => {
      const { service, mockPrisma, mockProjectService } = createMocks();
      mockPrisma.projectVersion.aggregate.mockResolvedValue({
        _max: { versionNumber: null },
      });
      mockPrisma.projectVersion.create.mockResolvedValue({ id: 'v1' });

      await service.create('p1', 'u1', {});
      expect(mockProjectService.ensureOwnership).toHaveBeenCalledWith('p1', 'u1');
    });
  });

  describe('listByProject', () => {
    it('should return versions ordered by versionNumber desc', async () => {
      const { service, mockPrisma } = createMocks();
      const versions = [{ id: 'v2', versionNumber: 2 }, { id: 'v1', versionNumber: 1 }];
      mockPrisma.projectVersion.findMany.mockResolvedValue(versions);

      const result = await service.listByProject('p1', 'u1');
      expect(result).toBe(versions);
      expect(mockPrisma.projectVersion.findMany).toHaveBeenCalledWith({
        where: { projectId: 'p1' },
        orderBy: { versionNumber: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('should return version with executions when found', async () => {
      const { service, mockPrisma } = createMocks();
      const version = { id: 'v1', projectId: 'p1', executions: [] };
      mockPrisma.projectVersion.findFirst.mockResolvedValue(version);

      const result = await service.findById('p1', 'v1', 'u1');
      expect(result).toBe(version);
    });

    it('should throw NotFoundException when version not found', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.projectVersion.findFirst.mockResolvedValue(null);

      await expect(service.findById('p1', 'v1', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
