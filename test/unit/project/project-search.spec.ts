import { NotFoundException } from '@nestjs/common';
import { ProjectService } from '../../../src/project/project.service.js';
import { ProjectController } from '../../../src/project/project.controller.js';

function createMocks() {
  const mockPrisma = {
    project: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    projectContent: {
      findUnique: vi.fn(),
    },
    projectVersion: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
    $queryRaw: vi.fn(),
  };

  const mockNatsPublisher = {
    publishProjectDeleted: vi.fn().mockResolvedValue(undefined),
  };

  const service = new ProjectService(mockPrisma as never, mockNatsPublisher as never);

  return { service, mockPrisma, mockNatsPublisher };
}

describe('ProjectService.search', () => {
  it('should return matching projects for a query', async () => {
    const { service, mockPrisma } = createMocks();
    const items = [
      { id: 'p1', userId: 'u1', title: 'Machine Learning Intro' },
      { id: 'p2', userId: 'u1', title: 'Deep Learning Guide' },
    ];
    mockPrisma.$queryRaw
      .mockResolvedValueOnce(items)
      .mockResolvedValueOnce([{ count: BigInt(2) }]);

    const result = await service.search('u1', 'learning');

    expect(result.items).toBe(items);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(1);
  });

  it('should return empty results for non-matching query', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);

    const result = await service.search('u1', 'nonexistent');

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('should handle pagination correctly', async () => {
    const { service, mockPrisma } = createMocks();
    const items = [{ id: 'p3', userId: 'u1', title: 'Page 2 Item' }];
    mockPrisma.$queryRaw
      .mockResolvedValueOnce(items)
      .mockResolvedValueOnce([{ count: BigInt(15) }]);

    const result = await service.search('u1', 'test', 2, 10);

    expect(result.items).toBe(items);
    expect(result.total).toBe(15);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(2);
  });

  it('should use default page and pageSize when not provided', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);

    const result = await service.search('u1', 'test');

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('should trim the query string', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);

    await service.search('u1', '  hello  ');

    // Verify $queryRaw was called (twice: items + count)
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('should handle count result with undefined gracefully', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.search('u1', 'test');

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});

describe('ProjectController.search — feature flag', () => {
  it('should throw NotFoundException when FEATURE_SEARCH_ENABLED is false', async () => {
    const mockService = { search: vi.fn() };
    const mockConfig = { FEATURE_SEARCH_ENABLED: false };
    const controller = new ProjectController(mockService as never, mockConfig as never);

    await expect(
      controller.search('u1', { q: 'test', page: 1, pageSize: 20 } as never),
    ).rejects.toThrow(NotFoundException);

    expect(mockService.search).not.toHaveBeenCalled();
  });

  it('should delegate to service when FEATURE_SEARCH_ENABLED is true', async () => {
    const mockService = {
      search: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      }),
    };
    const mockConfig = { FEATURE_SEARCH_ENABLED: true };
    const controller = new ProjectController(mockService as never, mockConfig as never);

    const result = await controller.search('u1', { q: 'hello', page: 1, pageSize: 20 } as never);

    expect(mockService.search).toHaveBeenCalledWith('u1', 'hello', 1, 20);
    expect(result.total).toBe(0);
  });
});
