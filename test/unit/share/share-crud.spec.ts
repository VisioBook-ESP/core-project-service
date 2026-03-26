import { NotFoundException } from '@nestjs/common';
import { ShareService } from '../../../src/share/share.service.js';

function createMocks() {
  const mockPrisma = {
    shareLink: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  const mockProjectService = {
    ensureOwnership: vi.fn().mockResolvedValue({ id: 'p1', userId: 'u1' }),
  };

  const service = new ShareService(mockPrisma as never, mockProjectService as never);

  return { service, mockPrisma, mockProjectService };
}

describe('ShareService — CRUD', () => {
  describe('getShareLinkInfo', () => {
    it('should return metadata with isPasswordProtected flag', async () => {
      const { service, mockPrisma } = createMocks();
      const now = new Date();
      mockPrisma.shareLink.findFirst.mockResolvedValue({
        id: 'sl1',
        projectId: 'p1',
        shareToken: 'tok123',
        expiresAt: null,
        allowDownload: true,
        passwordHash: '$2b$12$somehash',
        createdAt: now,
      });

      const result = await service.getShareLinkInfo('p1', 'u1');

      expect(result).toEqual({
        id: 'sl1',
        projectId: 'p1',
        shareToken: 'tok123',
        expiresAt: null,
        allowDownload: true,
        isPasswordProtected: true,
        createdAt: now,
      });
    });

    it('should return null when no share link exists', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.shareLink.findFirst.mockResolvedValue(null);

      const result = await service.getShareLinkInfo('p1', 'u1');

      expect(result).toBeNull();
    });
  });

  describe('deleteShareLink', () => {
    it('should call deleteMany and succeed', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.shareLink.deleteMany.mockResolvedValue({ count: 1 });

      await expect(service.deleteShareLink('p1', 'u1')).resolves.toBeUndefined();
      expect(mockPrisma.shareLink.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'p1' },
      });
    });

    it('should throw NotFoundException when count is 0', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.shareLink.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.deleteShareLink('p1', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
