import { of, throwError } from 'rxjs';
import { ServiceUnavailableException } from '@nestjs/common';
import { StorageServiceClient } from '../../../src/clients/storage-service.client.js';

function createClient() {
  const mockHttpService = {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  };
  const mockConfig = { STORAGE_SERVICE_URL: 'http://localhost:8082' };
  const client = new StorageServiceClient(mockHttpService as never, mockConfig as never);

  return { client, mockHttpService };
}

describe('StorageServiceClient', () => {

  describe('getUploadUrl', () => {
    it('should return upload URL result on success', async () => {
      const { client, mockHttpService } = createClient();
      const uploadResult = { uploadUrl: 'https://s3.example.com/upload', fileKey: 'key-123' };
      mockHttpService.post.mockReturnValue(of({ data: uploadResult }));

      const params = {
        fileName: 'test.pdf',
        contentType: 'application/pdf',
        projectId: 'p1',
        userId: 'u1',
      };

      const result = await client.getUploadUrl(params);

      expect(result).toEqual(uploadResult);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:8082/api/v1/storage/upload-url',
        params,
        { headers: {} },
      );
    });

    it('should include X-Request-Id header when requestId is provided', async () => {
      const { client, mockHttpService } = createClient();
      mockHttpService.post.mockReturnValue(
        of({ data: { uploadUrl: 'https://s3.example.com/upload', fileKey: 'key-123' } }),
      );

      const params = {
        fileName: 'test.pdf',
        contentType: 'application/pdf',
        projectId: 'p1',
        userId: 'u1',
      };

      await client.getUploadUrl(params, 'req-456');

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:8082/api/v1/storage/upload-url',
        params,
        { headers: { 'X-Request-Id': 'req-456' } },
      );
    });
  });

  describe('deleteFile', () => {
    it('should call delete on success', async () => {
      const { client, mockHttpService } = createClient();
      mockHttpService.delete.mockReturnValue(of({ data: undefined }));

      await client.deleteFile('my-file-key');

      expect(mockHttpService.delete).toHaveBeenCalledWith(
        'http://localhost:8082/api/v1/storage/files/my-file-key',
        { headers: {} },
      );
    });

    it('should encode special characters in file key', async () => {
      const { client, mockHttpService } = createClient();
      mockHttpService.delete.mockReturnValue(of({ data: undefined }));

      await client.deleteFile('path/to/file name.pdf');

      expect(mockHttpService.delete).toHaveBeenCalledWith(
        'http://localhost:8082/api/v1/storage/files/path%2Fto%2Ffile%20name.pdf',
        { headers: {} },
      );
    });
  });

  describe('getFileMetadata', () => {
    it('should return file metadata on success', async () => {
      const { client, mockHttpService } = createClient();
      const metadata = {
        key: 'my-key',
        size: 1024,
        contentType: 'application/pdf',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      mockHttpService.get.mockReturnValue(of({ data: metadata }));

      const result = await client.getFileMetadata('my-key');

      expect(result).toEqual(metadata);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        'http://localhost:8082/api/v1/storage/files/my-key/metadata',
        { headers: {} },
      );
    });
  });

  describe('withRetry', () => {
    it('should retry on failure then succeed', async () => {
      const { client, mockHttpService } = createClient();
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
        fn();
        return 0 as never;
      });

      const metadata = {
        key: 'my-key',
        size: 1024,
        contentType: 'application/pdf',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      mockHttpService.get
        .mockReturnValueOnce(throwError(() => new Error('network error')))
        .mockReturnValueOnce(of({ data: metadata }));

      const result = await client.getFileMetadata('my-key');

      expect(result).toEqual(metadata);
      expect(mockHttpService.get).toHaveBeenCalledTimes(2);
      vi.restoreAllMocks();
    });

    it('should throw ServiceUnavailableException after 3 failures', async () => {
      const { client, mockHttpService } = createClient();
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
        fn();
        return 0 as never;
      });

      mockHttpService.get.mockReturnValue(throwError(() => new Error('network error')));

      await expect(client.getFileMetadata('my-key')).rejects.toThrow(ServiceUnavailableException);
      expect(mockHttpService.get).toHaveBeenCalledTimes(3);
      vi.restoreAllMocks();
    });
  });
});
