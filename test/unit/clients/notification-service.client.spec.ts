import { of, throwError } from 'rxjs';
import { NotificationServiceClient } from '../../../src/clients/notification-service.client.js';

function createClient() {
  const mockHttpService = {
    post: vi.fn(),
  };
  const mockConfig = { NOTIFICATION_SERVICE_URL: 'http://localhost:8085' };
  const client = new NotificationServiceClient(mockHttpService as never, mockConfig as never);

  return { client, mockHttpService };
}

describe('NotificationServiceClient', () => {
  describe('sendNotification', () => {
    it('should POST to the notifications endpoint', async () => {
      const { client, mockHttpService } = createClient();
      mockHttpService.post.mockReturnValue(of({ data: undefined }));

      const payload = { userId: 'u1', type: 'generation_completed', data: { projectId: 'p1' } };
      await client.sendNotification(payload);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:8085/api/v1/notifications/send',
        payload,
        { headers: { 'X-User-Id': 'u1' } },
      );
    });

    it('should include X-Request-Id header when requestId is provided', async () => {
      const { client, mockHttpService } = createClient();
      mockHttpService.post.mockReturnValue(of({ data: undefined }));

      await client.sendNotification({ userId: 'u1', type: 'test', data: {} }, 'req-123');

      expect(mockHttpService.post).toHaveBeenCalledWith(expect.any(String), expect.any(Object), {
        headers: { 'X-Request-Id': 'req-123', 'X-User-Id': 'u1' },
      });
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const { client, mockHttpService } = createClient();
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
        fn();
        return 0 as never;
      });

      mockHttpService.post
        .mockReturnValueOnce(throwError(() => new Error('network error')))
        .mockReturnValueOnce(of({ data: undefined }));

      await client.sendNotification({ userId: 'u1', type: 'test', data: {} });

      expect(mockHttpService.post).toHaveBeenCalledTimes(2);
      vi.restoreAllMocks();
    });

    it('should NOT throw after exhausting all retries (best-effort)', async () => {
      const { client, mockHttpService } = createClient();
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
        fn();
        return 0 as never;
      });

      mockHttpService.post.mockReturnValue(throwError(() => new Error('network error')));

      // Should resolve without throwing
      await expect(
        client.sendNotification({ userId: 'u1', type: 'test', data: {} }),
      ).resolves.toBeUndefined();

      expect(mockHttpService.post).toHaveBeenCalledTimes(3);
      vi.restoreAllMocks();
    });

    it('should use exponential backoff between retries', async () => {
      const { client, mockHttpService } = createClient();
      const delays: number[] = [];
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void, ms?: number) => {
        delays.push(ms ?? 0);
        fn();
        return 0 as never;
      });

      mockHttpService.post.mockReturnValue(throwError(() => new Error('fail')));

      await client.sendNotification({ userId: 'u1', type: 'test', data: {} });

      // Retries 3 times, delays for attempt 1 and 2 (third attempt logs and returns)
      expect(delays[0]).toBe(1000); // BASE_DELAY * 2^0
      expect(delays[1]).toBe(2000); // BASE_DELAY * 2^1
      vi.restoreAllMocks();
    });
  });
});
