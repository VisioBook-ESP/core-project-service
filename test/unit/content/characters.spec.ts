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

  const service = new ContentService(mockPrisma as never, mockProjectService as never);

  return { service, mockPrisma, mockProjectService };
}

describe('ContentService.listCharacters', () => {
  it('should return characters for a project', async () => {
    const { service, mockPrisma } = createMocks();
    const characters = [
      { id: 'ch1', projectId: 'p1', name: 'Alice', description: 'Protagonist' },
      { id: 'ch2', projectId: 'p1', name: 'Bob', description: 'Antagonist' },
    ];
    mockPrisma.character.findMany.mockResolvedValue(characters);

    const result = await service.listCharacters('p1', 'u1');

    expect(result).toBe(characters);
    expect(result).toHaveLength(2);
    expect(mockPrisma.character.findMany).toHaveBeenCalledWith({
      where: { projectId: 'p1' },
    });
  });

  it('should return empty array when no characters exist', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.character.findMany.mockResolvedValue([]);

    const result = await service.listCharacters('p1', 'u1');

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should verify ownership before listing characters', async () => {
    const { service, mockProjectService, mockPrisma } = createMocks();
    mockPrisma.character.findMany.mockResolvedValue([]);

    await service.listCharacters('p1', 'u1');

    expect(mockProjectService.ensureOwnership).toHaveBeenCalledWith('p1', 'u1');
  });
});
