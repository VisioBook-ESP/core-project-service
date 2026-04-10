import { NotFoundException } from '@nestjs/common';
import { ContentService } from '../../../src/content/content.service.js';

function createMocks() {
  const mockPrisma = {
    projectContent: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    scene: {
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

  const service = new ContentService(
    mockPrisma as never,
    mockProjectService as never,
    mockCache as never,
  );

  return { service, mockPrisma, mockProjectService };
}

describe('ContentService', () => {
  describe('getContent', () => {
    it('should return content when found', async () => {
      const { service, mockPrisma } = createMocks();
      const content = { id: 'c1', projectId: 'p1', text: 'hello', wordCount: 1 };
      mockPrisma.projectContent.findUnique.mockResolvedValue(content);

      const result = await service.getContent('p1', 'u1');
      expect(result).toBe(content);
      expect(mockPrisma.projectContent.findUnique).toHaveBeenCalledWith({
        where: { projectId: 'p1' },
      });
    });

    it('should throw NotFoundException when content not found', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.projectContent.findUnique.mockResolvedValue(null);

      await expect(service.getContent('p1', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('should verify ownership before fetching', async () => {
      const { service, mockProjectService, mockPrisma } = createMocks();
      mockPrisma.projectContent.findUnique.mockResolvedValue({ id: 'c1' });

      await service.getContent('p1', 'u1');
      expect(mockProjectService.ensureOwnership).toHaveBeenCalledWith('p1', 'u1');
    });
  });

  describe('updateContent', () => {
    it('should update text and recalculate wordCount', async () => {
      const { service, mockPrisma } = createMocks();
      const updated = { id: 'c1', projectId: 'p1', text: 'one two three', wordCount: 3 };
      mockPrisma.projectContent.update.mockResolvedValue(updated);

      const result = await service.updateContent('p1', 'u1', { text: 'one two three' });
      expect(result).toBe(updated);
      expect(mockPrisma.projectContent.update).toHaveBeenCalledWith({
        where: { projectId: 'p1' },
        data: expect.objectContaining({
          text: 'one two three',
          wordCount: 3,
        }),
      });
    });

    it('should update metadata without changing text', async () => {
      const { service, mockPrisma } = createMocks();
      const updated = { id: 'c1', projectId: 'p1', metadata: { lang: 'fr' } };
      mockPrisma.projectContent.update.mockResolvedValue(updated);

      await service.updateContent('p1', 'u1', { metadata: { lang: 'fr' } });
      expect(mockPrisma.projectContent.update).toHaveBeenCalledWith({
        where: { projectId: 'p1' },
        data: { metadata: { lang: 'fr' } },
      });
    });

    it('should verify ownership before updating', async () => {
      const { service, mockProjectService, mockPrisma } = createMocks();
      mockPrisma.projectContent.update.mockResolvedValue({});

      await service.updateContent('p1', 'u1', {});
      expect(mockProjectService.ensureOwnership).toHaveBeenCalledWith('p1', 'u1');
    });
  });

  describe('listScenes', () => {
    it('should return scenes ordered by order ascending', async () => {
      const { service, mockPrisma } = createMocks();
      const scenes = [
        { id: 's1', order: 1 },
        { id: 's2', order: 2 },
      ];
      mockPrisma.scene.findMany.mockResolvedValue(scenes);

      const result = await service.listScenes('p1', 'u1');
      expect(result).toBe(scenes);
      expect(mockPrisma.scene.findMany).toHaveBeenCalledWith({
        where: { projectId: 'p1' },
        orderBy: { order: 'asc' },
        include: { dialogues: { orderBy: { order: 'asc' } } },
      });
    });

    it('should verify ownership before listing scenes', async () => {
      const { service, mockProjectService, mockPrisma } = createMocks();
      mockPrisma.scene.findMany.mockResolvedValue([]);

      await service.listScenes('p1', 'u1');
      expect(mockProjectService.ensureOwnership).toHaveBeenCalledWith('p1', 'u1');
    });
  });
});
