import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ShareService } from '../../../src/share/share.service.js';

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

import bcrypt from 'bcrypt';

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

describe('ShareService — password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createShareLink with password', () => {
    it('should hash password with work factor 12 and return isPasswordProtected=true', async () => {
      const { service, mockPrisma } = createMocks();
      const hashedPw = '$2b$12$hashedvalue';
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPw as never);

      const now = new Date();
      mockPrisma.shareLink.create.mockResolvedValue({
        id: 'sl1',
        projectId: 'p1',
        shareToken: 'tok123',
        expiresAt: null,
        allowDownload: false,
        passwordHash: hashedPw,
        createdAt: now,
      });

      const result = await service.createShareLink('p1', 'u1', { password: 'secret123' });

      expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 12);
      expect(result.isPasswordProtected).toBe(true);
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('createShareLink without password', () => {
    it('should set passwordHash to null and isPasswordProtected=false', async () => {
      const { service, mockPrisma } = createMocks();
      const now = new Date();
      mockPrisma.shareLink.create.mockResolvedValue({
        id: 'sl1',
        projectId: 'p1',
        shareToken: 'tok456',
        expiresAt: null,
        allowDownload: false,
        passwordHash: null,
        createdAt: now,
      });

      const result = await service.createShareLink('p1', 'u1', {});

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(result.isPasswordProtected).toBe(false);
    });
  });

  describe('verifySharePassword', () => {
    it('should return shared project data with correct password', async () => {
      const { service, mockPrisma } = createMocks();
      const createdAt = new Date();
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      mockPrisma.shareLink.findUnique.mockResolvedValue({
        id: 'sl1',
        shareToken: 'tok',
        expiresAt: null,
        allowDownload: true,
        passwordHash: '$2b$12$hash',
        project: {
          title: 'My Project',
          deletedAt: null,
          createdAt,
          versions: [{ videoUrl: 'https://cdn.example.com/video.mp4' }],
        },
      });

      const result = await service.verifySharePassword('tok', 'correct-pw');

      expect(bcrypt.compare).toHaveBeenCalledWith('correct-pw', '$2b$12$hash');
      expect(result).toEqual({
        title: 'My Project',
        videoUrl: 'https://cdn.example.com/video.mp4',
        allowDownload: true,
        requiresPassword: false,
        createdAt,
      });
    });

    it('should throw UnauthorizedException with incorrect password', async () => {
      const { service, mockPrisma } = createMocks();
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      mockPrisma.shareLink.findUnique.mockResolvedValue({
        id: 'sl1',
        shareToken: 'tok',
        expiresAt: null,
        allowDownload: false,
        passwordHash: '$2b$12$hash',
        project: {
          title: 'Protected',
          deletedAt: null,
          createdAt: new Date(),
          versions: [],
        },
      });

      await expect(service.verifySharePassword('tok', 'wrong-pw')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw NotFoundException for expired link', async () => {
      const { service, mockPrisma } = createMocks();

      mockPrisma.shareLink.findUnique.mockResolvedValue({
        id: 'sl1',
        shareToken: 'tok',
        expiresAt: new Date('2020-01-01'),
        allowDownload: false,
        passwordHash: '$2b$12$hash',
        project: {
          title: 'Expired',
          deletedAt: null,
          createdAt: new Date(),
          versions: [],
        },
      });

      await expect(service.verifySharePassword('tok', 'any')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on non-password-protected link', async () => {
      const { service, mockPrisma } = createMocks();

      mockPrisma.shareLink.findUnique.mockResolvedValue({
        id: 'sl1',
        shareToken: 'tok',
        expiresAt: null,
        allowDownload: false,
        passwordHash: null,
        project: {
          title: 'Not protected',
          deletedAt: null,
          createdAt: new Date(),
          versions: [],
        },
      });

      await expect(service.verifySharePassword('tok', 'any')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
