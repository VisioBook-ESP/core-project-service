import { NotFoundException } from '@nestjs/common';
import { ShareService } from '../../../src/share/share.service.js';

function createMocks() {
  const mockPrisma = {
    shareLink: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  };

  const mockProjectService = {
    ensureOwnership: vi.fn().mockResolvedValue({ id: 'p1', userId: 'u1' }),
  };

  const service = new ShareService(mockPrisma as never, mockProjectService as never);

  return { service, mockPrisma, mockProjectService };
}

describe('ShareService', () => {
  describe('createShareLink', () => {
    it('should create a share link with a generated token', async () => {
      const { service, mockPrisma } = createMocks();
      const now = new Date();
      mockPrisma.shareLink.create.mockResolvedValue({
        id: 'sl1',
        projectId: 'p1',
        shareToken: 'abc123',
        expiresAt: null,
        allowDownload: false,
        createdAt: now,
      });

      const result = await service.createShareLink('p1', 'u1', {});

      expect(result).toEqual({
        id: 'sl1',
        projectId: 'p1',
        shareToken: 'abc123',
        expiresAt: null,
        allowDownload: false,
        createdAt: now,
      });
      expect(mockPrisma.shareLink.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'p1',
          shareToken: expect.any(String),
          expiresAt: null,
          allowDownload: false,
        }),
      });
    });

    it('should set expiresAt when provided', async () => {
      const { service, mockPrisma } = createMocks();
      const expiresAt = '2026-12-31T23:59:59.000Z';
      mockPrisma.shareLink.create.mockResolvedValue({
        id: 'sl1',
        projectId: 'p1',
        shareToken: 'tok',
        expiresAt: new Date(expiresAt),
        allowDownload: true,
        createdAt: new Date(),
      });

      await service.createShareLink('p1', 'u1', { expiresAt, allowDownload: true });

      expect(mockPrisma.shareLink.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: new Date(expiresAt),
          allowDownload: true,
        }),
      });
    });

    it('should verify ownership before creating', async () => {
      const { service, mockProjectService, mockPrisma } = createMocks();
      mockPrisma.shareLink.create.mockResolvedValue({
        id: 'sl1',
        projectId: 'p1',
        shareToken: 'tok',
        expiresAt: null,
        allowDownload: false,
        createdAt: new Date(),
      });

      await service.createShareLink('p1', 'u1', {});

      expect(mockProjectService.ensureOwnership).toHaveBeenCalledWith('p1', 'u1');
    });
  });

  describe('accessSharedProject', () => {
    it('should return shared project data for a valid token', async () => {
      const { service, mockPrisma } = createMocks();
      const createdAt = new Date('2026-01-01');
      mockPrisma.shareLink.findUnique.mockResolvedValue({
        id: 'sl1',
        shareToken: 'valid-token',
        expiresAt: null,
        allowDownload: true,
        passwordHash: null,
        project: {
          title: 'My Project',
          deletedAt: null,
          createdAt,
          versions: [{ videoUrl: 'https://cdn.example.com/video.mp4' }],
        },
      });

      const result = await service.accessSharedProject('valid-token');

      expect(result).toEqual({
        title: 'My Project',
        videoUrl: 'https://cdn.example.com/video.mp4',
        allowDownload: true,
        requiresPassword: false,
        createdAt,
      });
    });

    it('should throw NotFoundException for non-existent token', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.shareLink.findUnique.mockResolvedValue(null);

      await expect(service.accessSharedProject('bad-token')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for expired share link', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.shareLink.findUnique.mockResolvedValue({
        id: 'sl1',
        shareToken: 'expired-token',
        expiresAt: new Date('2020-01-01'), // in the past
        allowDownload: false,
        passwordHash: null,
        project: {
          title: 'Old Project',
          deletedAt: null,
          createdAt: new Date(),
          versions: [],
        },
      });

      await expect(service.accessSharedProject('expired-token')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for deleted project', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.shareLink.findUnique.mockResolvedValue({
        id: 'sl1',
        shareToken: 'tok',
        expiresAt: null,
        allowDownload: false,
        passwordHash: null,
        project: {
          title: 'Deleted',
          deletedAt: new Date(),
          createdAt: new Date(),
          versions: [],
        },
      });

      await expect(service.accessSharedProject('tok')).rejects.toThrow(NotFoundException);
    });

    it('should return requiresPassword=true and videoUrl=null for password-protected link', async () => {
      const { service, mockPrisma } = createMocks();
      const createdAt = new Date();
      mockPrisma.shareLink.findUnique.mockResolvedValue({
        id: 'sl1',
        shareToken: 'pw-token',
        expiresAt: null,
        allowDownload: false,
        passwordHash: '$2b$10$somehash',
        project: {
          title: 'Protected',
          deletedAt: null,
          createdAt,
          versions: [{ videoUrl: 'https://cdn.example.com/video.mp4' }],
        },
      });

      const result = await service.accessSharedProject('pw-token');

      expect(result).toEqual({
        title: 'Protected',
        videoUrl: null,
        allowDownload: false,
        requiresPassword: true,
        createdAt,
      });
    });

    it('should return null videoUrl when no completed version exists', async () => {
      const { service, mockPrisma } = createMocks();
      const createdAt = new Date();
      mockPrisma.shareLink.findUnique.mockResolvedValue({
        id: 'sl1',
        shareToken: 'tok',
        expiresAt: null,
        allowDownload: false,
        passwordHash: null,
        project: {
          title: 'No Video',
          deletedAt: null,
          createdAt,
          versions: [],
        },
      });

      const result = await service.accessSharedProject('tok');

      expect(result.videoUrl).toBeNull();
      expect(result.requiresPassword).toBe(false);
    });
  });
});
