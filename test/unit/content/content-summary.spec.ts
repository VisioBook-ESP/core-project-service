import { ContentService } from '../../../src/content/content.service.js';

function createMocks() {
  const mockPrisma = {
    projectContent: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    scene: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    character: {
      findMany: vi.fn(),
    },
  };

  const mockProjectService = {
    ensureOwnership: vi.fn().mockResolvedValue({ id: 'p1', userId: 'u1' }),
  };

  const mockCache = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  };

  const service = new ContentService(mockPrisma as never, mockProjectService as never, mockCache as never);

  return { service, mockPrisma, mockProjectService };
}

describe('ContentService.getSummary', () => {
  it('should return summary when content has been analyzed', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.projectContent.findUnique.mockResolvedValue({
      summary: 'A story about a brave hero.',
    });

    const result = await service.getSummary('p1', 'u1');

    expect(result).toEqual({ summary: 'A story about a brave hero.' });
    expect(mockPrisma.projectContent.findUnique).toHaveBeenCalledWith({
      where: { projectId: 'p1' },
      select: { summary: true },
    });
  });

  it('should return null summary when content exists but has no summary', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.projectContent.findUnique.mockResolvedValue({ summary: null });

    const result = await service.getSummary('p1', 'u1');

    expect(result).toEqual({ summary: null });
  });

  it('should return null summary when content record not found', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.projectContent.findUnique.mockResolvedValue(null);

    const result = await service.getSummary('p1', 'u1');

    expect(result).toEqual({ summary: null });
  });

  it('should verify ownership before fetching summary', async () => {
    const { service, mockProjectService, mockPrisma } = createMocks();
    mockPrisma.projectContent.findUnique.mockResolvedValue({ summary: 'test' });

    await service.getSummary('p1', 'u1');

    expect(mockProjectService.ensureOwnership).toHaveBeenCalledWith('p1', 'u1');
  });
});
