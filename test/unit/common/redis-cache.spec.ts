import { CacheService } from '../../../src/common/cache/cache.service.js';

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  scanStream: vi.fn(),
  pipeline: vi.fn(),
  quit: vi.fn(),
};

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(() => mockRedis),
}));

function createService(): CacheService {
  return new CacheService({
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
    REDIS_DB: 0,
    REDIS_TLS_ENABLED: false,
  } as never);
}

describe('CacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return parsed JSON on cache hit', async () => {
      const service = createService();
      mockRedis.get.mockResolvedValue('{"name":"test"}');

      const result = await service.get<{ name: string }>('key1');

      expect(result).toEqual({ name: 'test' });
      expect(mockRedis.get).toHaveBeenCalledWith('key1');
    });

    it('should return null on cache miss', async () => {
      const service = createService();
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('key1');

      expect(result).toBeNull();
    });

    it('should return null on error (non-fatal)', async () => {
      const service = createService();
      mockRedis.get.mockRejectedValue(new Error('connection error'));

      const result = await service.get('key1');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should call redis.set with correct key, JSON value, EX, and ttl', async () => {
      const service = createService();
      mockRedis.set.mockResolvedValue('OK');

      await service.set('key1', { data: true }, 300);

      expect(mockRedis.set).toHaveBeenCalledWith('key1', '{"data":true}', 'EX', 300);
    });
  });

  describe('del', () => {
    it('should call redis.del with correct key', async () => {
      const service = createService();
      mockRedis.del.mockResolvedValue(1);

      await service.del('key1');

      expect(mockRedis.del).toHaveBeenCalledWith('key1');
    });
  });

  describe('delByPattern', () => {
    it('should use scanStream and pipeline to delete matching keys', async () => {
      const service = createService();

      const mockStream = {
        on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'data') {
            cb(['key:1', 'key:2']);
          }
          if (event === 'end') {
            cb();
          }
          return mockStream;
        }),
      };

      const mockPipeline = {
        del: vi.fn(),
        exec: vi.fn().mockResolvedValue([]),
      };

      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      await service.delByPattern('key:*');

      expect(mockRedis.scanStream).toHaveBeenCalledWith({ match: 'key:*', count: 100 });
      expect(mockPipeline.del).toHaveBeenCalledWith('key:1');
      expect(mockPipeline.del).toHaveBeenCalledWith('key:2');
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should call redis.quit', async () => {
      const service = createService();
      mockRedis.quit.mockResolvedValue('OK');

      await service.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
