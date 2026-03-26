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
    activateIfDraft: vi.fn().mockResolvedValue(undefined),
  };

  const service = new VersionService(mockPrisma as never, mockProjectService as never);

  return { service, mockPrisma, mockProjectService };
}

describe('VersionService — revertToVersion', () => {
  it('should create new version with source version config', async () => {
    const { service, mockPrisma } = createMocks();
    const sourceConfig = { style: 'anime', duration: 60 };

    mockPrisma.projectVersion.findFirst.mockResolvedValue({
      id: 'v1',
      projectId: 'p1',
      versionNumber: 1,
      config: sourceConfig,
    });

    mockPrisma.projectVersion.aggregate.mockResolvedValue({
      _max: { versionNumber: 2 },
    });

    const newVersion = { id: 'v3', projectId: 'p1', versionNumber: 3, config: sourceConfig };
    mockPrisma.projectVersion.create.mockResolvedValue(newVersion);

    const result = await service.revertToVersion('p1', 'v1', 'u1');

    expect(result).toBe(newVersion);
    expect(mockPrisma.projectVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'p1',
          versionNumber: 3,
          config: sourceConfig,
        }),
      }),
    );
  });

  it('should throw NotFoundException for non-existent version', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.projectVersion.findFirst.mockResolvedValue(null);

    await expect(service.revertToVersion('p1', 'v999', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('should call create with correct config from source version', async () => {
    const { service, mockPrisma } = createMocks();
    const sourceConfig = { resolution: '1080p' };

    mockPrisma.projectVersion.findFirst.mockResolvedValue({
      id: 'v2',
      projectId: 'p1',
      versionNumber: 2,
      config: sourceConfig,
    });

    mockPrisma.projectVersion.aggregate.mockResolvedValue({
      _max: { versionNumber: 5 },
    });

    mockPrisma.projectVersion.create.mockResolvedValue({
      id: 'v6',
      projectId: 'p1',
      versionNumber: 6,
      config: sourceConfig,
    });

    await service.revertToVersion('p1', 'v2', 'u1');

    expect(mockPrisma.projectVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          config: sourceConfig,
        }),
      }),
    );
  });
});
