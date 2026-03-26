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

function makeVersion(
  id: string,
  versionNumber: number,
  config: Record<string, unknown>,
  overrides?: Record<string, unknown>,
) {
  return {
    id,
    projectId: 'p1',
    versionNumber,
    status: 'completed',
    config,
    videoUrl: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('VersionService — compareVersions', () => {
  it('should return empty diff for identical configs', async () => {
    const { service, mockPrisma } = createMocks();
    const config = { style: 'anime', duration: 30 };
    mockPrisma.projectVersion.findFirst
      .mockResolvedValueOnce(makeVersion('v1', 1, config))
      .mockResolvedValueOnce(makeVersion('v2', 2, config));

    const result = await service.compareVersions('p1', 'v1', 'v2', 'u1');

    expect(result.configDiff).toEqual({ added: {}, removed: {}, changed: {} });
  });

  it('should detect added keys', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.projectVersion.findFirst
      .mockResolvedValueOnce(makeVersion('v1', 1, { style: 'anime' }))
      .mockResolvedValueOnce(makeVersion('v2', 2, { style: 'anime', audio: true }));

    const result = await service.compareVersions('p1', 'v1', 'v2', 'u1');

    expect(result.configDiff.added).toEqual({ audio: true });
    expect(result.configDiff.removed).toEqual({});
    expect(result.configDiff.changed).toEqual({});
  });

  it('should detect removed keys', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.projectVersion.findFirst
      .mockResolvedValueOnce(makeVersion('v1', 1, { style: 'anime', audio: true }))
      .mockResolvedValueOnce(makeVersion('v2', 2, { style: 'anime' }));

    const result = await service.compareVersions('p1', 'v1', 'v2', 'u1');

    expect(result.configDiff.removed).toEqual({ audio: true });
    expect(result.configDiff.added).toEqual({});
    expect(result.configDiff.changed).toEqual({});
  });

  it('should detect changed keys including nested objects', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.projectVersion.findFirst
      .mockResolvedValueOnce(
        makeVersion('v1', 1, { style: 'anime', nested: { a: 1 } }),
      )
      .mockResolvedValueOnce(
        makeVersion('v2', 2, { style: 'realistic', nested: { a: 2 } }),
      );

    const result = await service.compareVersions('p1', 'v1', 'v2', 'u1');

    expect(result.configDiff.changed).toEqual({
      style: { from: 'anime', to: 'realistic' },
      nested: { from: { a: 1 }, to: { a: 2 } },
    });
  });

  it('should throw NotFoundException when version 1 is missing', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.projectVersion.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeVersion('v2', 2, {}));

    await expect(service.compareVersions('p1', 'v1', 'v2', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw NotFoundException when version 2 is missing', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.projectVersion.findFirst
      .mockResolvedValueOnce(makeVersion('v1', 1, {}))
      .mockResolvedValueOnce(null);

    await expect(service.compareVersions('p1', 'v1', 'v2', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
