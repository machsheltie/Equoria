/**
 * 🧪 Cache Helper Tests
 *
 * Comprehensive test suite for cacheHelper.mjs
 * Tests all caching functionality with proper ioredis mocking
 *
 * Coverage target: 80%+
 * Mock strategy: Mock ioredis only (balanced mocking philosophy)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCachedQuery,
  invalidateCache,
  invalidateCachePattern,
  invalidateCacheMultiple,
  clearAllCache,
  generateCacheKey,
  getCacheStatistics,
  resetCacheStatistics,
  closeRedisConnection,
  cacheInvalidation,
  cacheStats,
} from '../../utils/cacheHelper.mjs';

// Mock ioredis
vi.mock('ioredis', () => {
  const RedisMock = vi.fn();
  RedisMock.prototype.connect = vi.fn();
  RedisMock.prototype.get = vi.fn();
  RedisMock.prototype.setex = vi.fn();
  RedisMock.prototype.del = vi.fn();
  RedisMock.prototype.keys = vi.fn();
  RedisMock.prototype.flushdb = vi.fn();
  RedisMock.prototype.dbsize = vi.fn();
  RedisMock.prototype.info = vi.fn();
  RedisMock.prototype.config = vi.fn();
  RedisMock.prototype.quit = vi.fn();
  RedisMock.prototype.on = vi.fn();
  return { default: RedisMock };
});

// Mock logger to prevent console spam during tests
vi.mock('../../utils/logger.mjs', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CacheHelper', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Reset cache statistics
    resetCacheStatistics();

    // Reset NODE_ENV to non-test (so Redis initializes)
    process.env.NODE_ENV = 'development';
  });

  afterEach(async () => {
    // Clean up Redis connection after each test
    await closeRedisConnection();
  });

  describe('generateCacheKey()', () => {
    it('should generate cache key from multiple components', () => {
      const key = generateCacheKey('horses', 'forSale', 'page1');
      expect(key).toBe('horses:forSale:page1');
    });

    it('should filter out null and undefined components', () => {
      const key = generateCacheKey('horses', null, 'page1', undefined, 'limit20');
      expect(key).toBe('horses:page1:limit20');
    });

    it('should replace colons and spaces with underscores', () => {
      const key = generateCacheKey('horses:special', 'for sale', 'page 1');
      expect(key).toBe('horses_special:for_sale:page_1');
    });

    it('should handle single component', () => {
      const key = generateCacheKey('horses');
      expect(key).toBe('horses');
    });

    it('should handle empty array', () => {
      const key = generateCacheKey();
      expect(key).toBe('');
    });

    it('should convert numbers to strings', () => {
      const key = generateCacheKey('horse', 123, 'page', 1);
      expect(key).toBe('horse:123:page:1');
    });
  });

  describe('Test Environment Behavior', () => {
    it('should disable Redis in test environment', async () => {
      // Set NODE_ENV to test
      process.env.NODE_ENV = 'test';

      // Mock query function
      const queryFn = vi.fn(async () => ({ data: 'result' }));

      // Call getCachedQuery
      const result = await getCachedQuery('test:key', queryFn, 60);

      // Should execute query directly without caching
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: 'result' });
      expect(cacheStats.misses).toBe(1);
    });
  });

  describe('Connection Management', () => {
    it('should initialize Redis connection successfully', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      // Mock successful connection
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');

      // Call getCachedQuery to trigger initialization
      const queryFn = vi.fn(async () => ({ data: 'result' }));
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.setex.mockResolvedValue('OK');

      await getCachedQuery('test:key', queryFn, 60);

      // Redis should have been initialized
      expect(mockRedisInstance.connect).toHaveBeenCalled();
    });

    it('should handle connection failure gracefully', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      // Mock connection failure
      mockRedisInstance.connect.mockRejectedValue(new Error('Connection refused'));

      // Call getCachedQuery
      const queryFn = vi.fn(async () => ({ data: 'result' }));
      const result = await getCachedQuery('test:key', queryFn, 60);

      // Should execute query directly
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: 'result' });
      expect(cacheStats.misses).toBe(1);
    });
  });

  describe('getCachedQuery()', () => {
    it('should execute query on cache miss and store result', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      // Mock Redis operations
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.get.mockResolvedValue(null); // Cache miss
      mockRedisInstance.setex.mockResolvedValue('OK');

      // Trigger connect event
      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      // Mock query function
      const queryFn = vi.fn(async () => ({ id: 1, name: 'Horse' }));

      const result = await getCachedQuery('horse:1', queryFn, 120);

      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: 1, name: 'Horse' });
      expect(mockRedisInstance.get).toHaveBeenCalledWith('horse:1');
      expect(mockRedisInstance.setex).toHaveBeenCalledWith('horse:1', 120, JSON.stringify({ id: 1, name: 'Horse' }));
      expect(cacheStats.misses).toBe(1);
      expect(cacheStats.hits).toBe(0);
    });

    it('should return cached result on cache hit without executing query', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      // Mock Redis operations
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');

      const cachedData = { id: 1, name: 'Cached Horse' };
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(cachedData)); // Cache hit

      // Trigger connect event
      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      // Mock query function (should NOT be called)
      const queryFn = vi.fn(async () => ({ id: 1, name: 'Fresh Horse' }));

      const result = await getCachedQuery('horse:1', queryFn, 120);

      expect(queryFn).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData);
      expect(cacheStats.hits).toBe(1);
      expect(cacheStats.misses).toBe(0);
    });

    it('should use default TTL of 60 seconds when not specified', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.setex.mockResolvedValue('OK');

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const queryFn = vi.fn(async () => ({ data: 'result' }));
      await getCachedQuery('test:key', queryFn);

      expect(mockRedisInstance.setex).toHaveBeenCalledWith('test:key', 60, expect.any(String));
    });

    it('should handle JSON parse errors gracefully', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.get.mockResolvedValue('invalid json {{{');
      mockRedisInstance.setex.mockResolvedValue('OK');

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const queryFn = vi.fn(async () => ({ data: 'fresh result' }));
      const result = await getCachedQuery('test:key', queryFn, 60);

      // Should fall back to executing query
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: 'fresh result' });
    });

    it('should handle query function errors', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.get.mockResolvedValue(null);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const queryFn = vi.fn(async () => {
        throw new Error('Database error');
      });

      await expect(getCachedQuery('test:key', queryFn, 60)).rejects.toThrow('Database error');
      expect(cacheStats.errors).toBe(0); // Query error, not cache error
    });

    it('should handle cache write errors gracefully', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.setex.mockRejectedValue(new Error('Redis write error'));

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const queryFn = vi.fn(async () => ({ data: 'result' }));
      const result = await getCachedQuery('test:key', queryFn, 60);

      // Should return query result despite cache write failure
      expect(result).toEqual({ data: 'result' });
      expect(cacheStats.errors).toBe(1);
    });

    it('should bypass cache when Redis unavailable', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      // Mock connection failure
      mockRedisInstance.connect.mockRejectedValue(new Error('Connection refused'));

      const queryFn = vi.fn(async () => ({ data: 'result' }));
      const result = await getCachedQuery('test:key', queryFn, 60);

      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: 'result' });
      expect(cacheStats.misses).toBe(1);
    });
  });

  describe('invalidateCache()', () => {
    it('should delete single cache key successfully', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.del.mockResolvedValue(1);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await invalidateCache('horse:1');

      expect(deleted).toBe(1);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('horse:1');
      expect(cacheStats.invalidations).toBe(1);
    });

    it('should return 0 when Redis unavailable', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockRejectedValue(new Error('Connection refused'));

      const deleted = await invalidateCache('horse:1');

      expect(deleted).toBe(0);
      expect(cacheStats.invalidations).toBe(0);
    });

    it('should handle invalidation errors gracefully', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.del.mockRejectedValue(new Error('Redis delete error'));

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await invalidateCache('horse:1');

      expect(deleted).toBe(0);
      expect(cacheStats.errors).toBe(1);
    });
  });

  describe('invalidateCachePattern()', () => {
    it('should delete all keys matching pattern', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.keys.mockResolvedValue(['horse:1', 'horse:2', 'horse:3']);
      mockRedisInstance.del.mockResolvedValue(3);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await invalidateCachePattern('horse:*');

      expect(deleted).toBe(3);
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('horse:*');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('horse:1', 'horse:2', 'horse:3');
      expect(cacheStats.invalidations).toBe(3);
    });

    it('should return 0 when no keys match pattern', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.keys.mockResolvedValue([]);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await invalidateCachePattern('nonexistent:*');

      expect(deleted).toBe(0);
      expect(cacheStats.invalidations).toBe(0);
    });

    it('should handle pattern errors gracefully', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.keys.mockRejectedValue(new Error('Redis keys error'));

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await invalidateCachePattern('horse:*');

      expect(deleted).toBe(0);
      expect(cacheStats.errors).toBe(1);
    });
  });

  describe('invalidateCacheMultiple()', () => {
    it('should delete multiple keys at once', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.del.mockResolvedValue(3);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await invalidateCacheMultiple(['horse:1', 'horse:2', 'groom:1']);

      expect(deleted).toBe(3);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('horse:1', 'horse:2', 'groom:1');
      expect(cacheStats.invalidations).toBe(3);
    });

    it('should return 0 for empty array', async () => {
      const deleted = await invalidateCacheMultiple([]);
      expect(deleted).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.del.mockRejectedValue(new Error('Redis error'));

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await invalidateCacheMultiple(['horse:1', 'horse:2']);

      expect(deleted).toBe(0);
      expect(cacheStats.errors).toBe(1);
    });
  });

  describe('clearAllCache()', () => {
    it('should clear all cache keys successfully', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.flushdb.mockResolvedValue('OK');

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const success = await clearAllCache();

      expect(success).toBe(true);
      expect(mockRedisInstance.flushdb).toHaveBeenCalled();
      expect(cacheStats.invalidations).toBe(1);
    });

    it('should return false when Redis unavailable', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockRejectedValue(new Error('Connection refused'));

      const success = await clearAllCache();

      expect(success).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.flushdb.mockRejectedValue(new Error('Redis flushdb error'));

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const success = await clearAllCache();

      expect(success).toBe(false);
      expect(cacheStats.errors).toBe(1);
    });
  });

  describe('getCacheStatistics()', () => {
    it('should return cache statistics with hit rate', async () => {
      // Set up some stats
      cacheStats.hits = 7;
      cacheStats.misses = 3;
      cacheStats.errors = 1;
      cacheStats.invalidations = 2;

      const stats = await getCacheStatistics();

      expect(stats.hits).toBe(7);
      expect(stats.misses).toBe(3);
      expect(stats.errors).toBe(1);
      expect(stats.invalidations).toBe(2);
      expect(stats.hitRate).toBe(0.7); // 7 / (7 + 3)
    });

    it('should handle zero hits and misses', async () => {
      resetCacheStatistics();

      const stats = await getCacheStatistics();

      expect(stats.hitRate).toBe(0);
    });

    it('should include Redis statistics when available', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.dbsize.mockResolvedValue(42);
      mockRedisInstance.info.mockImplementation((section) => {
        if (section === 'memory') return 'used_memory_human:10M\nused_memory_peak_human:15M';
        if (section === 'stats') return 'total_connections_received:100\ntotal_commands_processed:1000\nevicted_keys:5\nkeyspace_hits:200\nkeyspace_misses:50';
        return '';
      });

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      // Trigger initialization
      const queryFn = vi.fn(async () => ({ data: 'result' }));
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.setex.mockResolvedValue('OK');
      await getCachedQuery('test:key', queryFn, 60);

      const stats = await getCacheStatistics();

      expect(stats.redis).toBeDefined();
      expect(stats.redis.totalKeys).toBe(42);
      expect(stats.redis.memoryUsed).toBe('10M');
    });
  });

  describe('resetCacheStatistics()', () => {
    it('should reset all cache counters', () => {
      // Set up some stats
      cacheStats.hits = 10;
      cacheStats.misses = 5;
      cacheStats.errors = 2;
      cacheStats.invalidations = 3;

      resetCacheStatistics();

      expect(cacheStats.hits).toBe(0);
      expect(cacheStats.misses).toBe(0);
      expect(cacheStats.errors).toBe(0);
      expect(cacheStats.invalidations).toBe(0);
    });
  });

  describe('closeRedisConnection()', () => {
    it('should close Redis connection gracefully', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      // Initialize Redis
      const queryFn = vi.fn(async () => ({ data: 'result' }));
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.setex.mockResolvedValue('OK');
      await getCachedQuery('test:key', queryFn, 60);

      // Close connection
      await closeRedisConnection();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('should be idempotent (safe to call multiple times)', async () => {
      await closeRedisConnection();
      await closeRedisConnection();
      await closeRedisConnection();

      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should handle close errors gracefully', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.quit.mockRejectedValue(new Error('Close error'));

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      // Initialize Redis
      const queryFn = vi.fn(async () => ({ data: 'result' }));
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.setex.mockResolvedValue('OK');
      await getCachedQuery('test:key', queryFn, 60);

      // Close connection (should not throw)
      await closeRedisConnection();

      expect(true).toBe(true);
    });
  });

  describe('Cache Invalidation Helpers', () => {
    beforeEach(() => {
      const Redis = vi.importActual('ioredis');
      const mockRedisInstance = new Redis.default();
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
    });

    it('should invalidate all horses caches', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.keys.mockResolvedValue(['horses:1', 'horses:2']);
      mockRedisInstance.del.mockResolvedValue(2);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await cacheInvalidation.horses();

      expect(deleted).toBe(2);
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('horses:*');
    });

    it('should invalidate specific horse cache', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.del.mockResolvedValue(1);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await cacheInvalidation.horse(123);

      expect(deleted).toBe(1);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('horse:123');
    });

    it('should invalidate all grooms caches', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.keys.mockResolvedValue(['grooms:1']);
      mockRedisInstance.del.mockResolvedValue(1);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await cacheInvalidation.grooms();

      expect(deleted).toBe(1);
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('grooms:*');
    });

    it('should invalidate specific groom cache', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.del.mockResolvedValue(1);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await cacheInvalidation.groom(456);

      expect(deleted).toBe(1);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('groom:456');
    });

    it('should invalidate all leaderboards caches', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.keys.mockResolvedValue(['leaderboard:global']);
      mockRedisInstance.del.mockResolvedValue(1);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await cacheInvalidation.leaderboards();

      expect(deleted).toBe(1);
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('leaderboard:*');
    });

    it('should invalidate all competitions caches', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.keys.mockResolvedValue(['competition:1']);
      mockRedisInstance.del.mockResolvedValue(1);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await cacheInvalidation.competitions();

      expect(deleted).toBe(1);
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('competition:*');
    });

    it('should invalidate specific competition cache', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.del.mockResolvedValue(1);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await cacheInvalidation.competition(789);

      expect(deleted).toBe(1);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('competition:789');
    });

    it('should invalidate all users caches', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.keys.mockResolvedValue(['user:1']);
      mockRedisInstance.del.mockResolvedValue(1);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await cacheInvalidation.users();

      expect(deleted).toBe(1);
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('user:*');
    });

    it('should invalidate specific user cache', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedisInstance = new Redis();

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.config.mockResolvedValue('OK');
      mockRedisInstance.del.mockResolvedValue(1);

      const onConnectCallback = mockRedisInstance.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnectCallback) onConnectCallback();

      const deleted = await cacheInvalidation.user(999);

      expect(deleted).toBe(1);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('user:999');
    });
  });
});
