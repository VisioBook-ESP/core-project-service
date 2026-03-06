import { of, throwError } from 'rxjs';
import { ServiceUnavailableException } from '@nestjs/common';
import { UserServiceClient } from '../../../src/clients/user-service.client.js';

function createClient() {
  const mockHttpService = {
    get: vi.fn(),
    post: vi.fn(),
  };
  const mockConfig = { USER_SERVICE_URL: 'http://localhost:8081' };
  const client = new UserServiceClient(mockHttpService as never, mockConfig as never);

  return { client, mockHttpService };
}

describe('UserServiceClient', () => {
  describe('checkQuota', () => {
    it('should return quota check result on success', async () => {
      const { client, mockHttpService } = createClient();
      const quotaResult = { hasQuota: true, remaining: 5 };
      mockHttpService.get.mockReturnValue(of({ data: quotaResult }));

      const result = await client.checkQuota('u1');

      expect(result).toEqual(quotaResult);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        'http://localhost:8081/api/v1/users/u1/quota',
        { headers: {} },
      );
    });

    it('should include X-Request-Id header when requestId is provided', async () => {
      const { client, mockHttpService } = createClient();
      mockHttpService.get.mockReturnValue(of({ data: { hasQuota: true, remaining: 3 } }));

      await client.checkQuota('u1', 'req-123');

      expect(mockHttpService.get).toHaveBeenCalledWith(
        'http://localhost:8081/api/v1/users/u1/quota',
        { headers: { 'X-Request-Id': 'req-123' } },
      );
    });

    it('should retry on failure then succeed on second attempt', async () => {
      const { client, mockHttpService } = createClient();
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
        fn();
        return 0 as never;
      });

      const quotaResult = { hasQuota: true, remaining: 2 };
      mockHttpService.get
        .mockReturnValueOnce(throwError(() => new Error('network error')))
        .mockReturnValueOnce(of({ data: quotaResult }));

      const result = await client.checkQuota('u1');

      expect(result).toEqual(quotaResult);
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

      await expect(client.checkQuota('u1')).rejects.toThrow(ServiceUnavailableException);
      expect(mockHttpService.get).toHaveBeenCalledTimes(3);
      vi.restoreAllMocks();
    });
  });

  describe('decrementQuota', () => {
    it('should call post on success', async () => {
      const { client, mockHttpService } = createClient();
      mockHttpService.post.mockReturnValue(of({ data: undefined }));

      await client.decrementQuota('u1');

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:8081/api/v1/users/u1/quota/decrement',
        {},
        { headers: {} },
      );
    });

    it('should throw ServiceUnavailableException after 3 failures', async () => {
      const { client, mockHttpService } = createClient();
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
        fn();
        return 0 as never;
      });

      mockHttpService.post.mockReturnValue(throwError(() => new Error('network error')));

      await expect(client.decrementQuota('u1')).rejects.toThrow(ServiceUnavailableException);
      expect(mockHttpService.post).toHaveBeenCalledTimes(3);
      vi.restoreAllMocks();
    });
  });
});
