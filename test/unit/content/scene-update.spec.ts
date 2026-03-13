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

describe('ContentService.updateScene', () => {
  it('should update a scene with partial data', async () => {
    const { service, mockPrisma } = createMocks();
    const existingScene = { id: 's1', projectId: 'p1', order: 1, description: 'old' };
    mockPrisma.scene.findFirst.mockResolvedValue(existingScene);
    const updatedScene = { ...existingScene, description: 'new description' };
    mockPrisma.scene.update.mockResolvedValue(updatedScene);

    const result = await service.updateScene('p1', 's1', 'u1', { description: 'new description' });

    expect(result).toBe(updatedScene);
    expect(mockPrisma.scene.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { description: 'new description' },
    });
  });

  it('should throw NotFoundException when scene does not exist', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.scene.findFirst.mockResolvedValue(null);

    await expect(
      service.updateScene('p1', 's-nonexistent', 'u1', { description: 'test' }),
    ).rejects.toThrow(NotFoundException);

    expect(mockPrisma.scene.update).not.toHaveBeenCalled();
  });

  it('should verify ownership before updating scene', async () => {
    const { service, mockProjectService, mockPrisma } = createMocks();
    mockPrisma.scene.findFirst.mockResolvedValue({ id: 's1', projectId: 'p1' });
    mockPrisma.scene.update.mockResolvedValue({ id: 's1' });

    await service.updateScene('p1', 's1', 'u1', { description: 'x' });

    expect(mockProjectService.ensureOwnership).toHaveBeenCalledWith('p1', 'u1');
  });

  it('should reject when ownership fails', async () => {
    const { service, mockProjectService } = createMocks();
    mockProjectService.ensureOwnership.mockRejectedValue(new NotFoundException('Project not found'));

    await expect(
      service.updateScene('p1', 's1', 'wrong-user', { description: 'test' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should look up scene scoped to projectId', async () => {
    const { service, mockPrisma } = createMocks();
    mockPrisma.scene.findFirst.mockResolvedValue({ id: 's1', projectId: 'p1' });
    mockPrisma.scene.update.mockResolvedValue({ id: 's1' });

    await service.updateScene('p1', 's1', 'u1', {});

    expect(mockPrisma.scene.findFirst).toHaveBeenCalledWith({
      where: { id: 's1', projectId: 'p1' },
    });
  });
});
