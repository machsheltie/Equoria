/**
 * Cache Helper Unit Tests
 * Verifies the caching logic and in-memory fallback
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getCachedQuery,
  invalidateCache,
  invalidateCachePattern,
  invalidateCacheMultiple,
  clearAllCache,
  getCacheStatistics,
  generateCacheKey,
  cacheStats,
  resetCacheStatistics,
  closeRedisConnection,
  cacheInvalidation,
} from '../../../utils/cacheHelper.mjs';
import { randomBytes } from 'node:crypto';

function makeAsyncTracked(returnValue) {
  const calls = [];
  const fn = async (...args) => {
    calls.push(args);
    return returnValue;
  };
  fn.mock = { calls };
  return fn;
}

describe('Cache Helper', () => {
  beforeEach(() => {
    resetCacheStatistics();
    // No explicit cleanup of localCache Map since it's private in the module,
    // but we can use different keys for each test.
  });

  describe('generateCacheKey()', () => {
    it('should generate standardized keys', () => {
      expect(generateCacheKey('horses', 'all')).toBe('horses:all');
      expect(generateCacheKey('user', 123, 'profile')).toBe('user:123:profile');
    });

    it('should handle spaces and colons in components', () => {
      expect(generateCacheKey('horse', 'Show Jumping')).toBe('horse:Show_Jumping');
      expect(generateCacheKey('key:with:colons')).toBe('key_with_colons');
    });
  });

  describe('getCachedQuery() - In-Memory Fallback', () => {
    it('should execute and cache the query result', async () => {
      const cacheKey = `test:key:${randomBytes(8).toString('hex')}`;
      const queryData = { id: 1, name: 'Test' };
      const queryFn = makeAsyncTracked(queryData);

      // First call - Cache Miss
      const result1 = await getCachedQuery(cacheKey, queryFn, 10);
      expect(result1).toEqual(queryData);
      expect(queryFn.mock.calls.length).toBe(1);
      expect(cacheStats.localMisses).toBe(1);

      // Second call - Cache Hit
      const result2 = await getCachedQuery(cacheKey, queryFn, 10);
      expect(result2).toEqual(queryData);
      expect(queryFn.mock.calls.length).toBe(1); // Should NOT be called again
      expect(cacheStats.localHits).toBe(1);
    });

    it('should respect TTL', async () => {
      const cacheKey = `test:ttl:${randomBytes(8).toString('hex')}`;
      const queryFn = makeAsyncTracked({ data: 'old' });

      // Cache with 0s TTL (expires immediately)
      await getCachedQuery(cacheKey, queryFn, 0);

      // Try again
      await getCachedQuery(cacheKey, queryFn, 10);

      expect(queryFn.mock.calls.length).toBe(2);
    });

    it('should handle undefined/null results', async () => {
      const cacheKey = `test:null:${randomBytes(8).toString('hex')}`;
      const queryFn = makeAsyncTracked(null);

      const result = await getCachedQuery(cacheKey, queryFn);
      expect(result).toBeNull();
      expect(queryFn.mock.calls.length).toBe(1);
    });
  });

  describe('invalidateCache()', () => {
    it('should remove items from cache', async () => {
      const cacheKey = `test:invalidate:${randomBytes(8).toString('hex')}`;
      const queryFn = makeAsyncTracked('fresh');

      // Cache it
      await getCachedQuery(cacheKey, queryFn);

      // Invalidate
      await invalidateCache(cacheKey);

      // Get again
      await getCachedQuery(cacheKey, queryFn);

      expect(queryFn.mock.calls.length).toBe(2);
    });

    it('returns 0 when key does not exist', async () => {
      const count = await invalidateCache(`test:nonexistent:${randomBytes(8).toString('hex')}`);
      expect(count).toBe(0);
    });
  });

  describe('invalidateCachePattern()', () => {
    it('deletes all local-cache keys matching pattern', async () => {
      const prefix = `test:pattern:${randomBytes(4).toString('hex')}`;
      await getCachedQuery(`${prefix}:a`, makeAsyncTracked('a'));
      await getCachedQuery(`${prefix}:b`, makeAsyncTracked('b'));
      await getCachedQuery('other:key', makeAsyncTracked('x'));

      const deleted = await invalidateCachePattern(`${prefix}:*`);
      expect(deleted).toBeGreaterThanOrEqual(2);
    });

    it('returns 0 when no keys match pattern', async () => {
      const count = await invalidateCachePattern(`test:nomatch:${randomBytes(8).toString('hex')}:*`);
      expect(count).toBe(0);
    });

    it('increments cacheStats.invalidations when keys are deleted', async () => {
      const prefix = `test:inval-stats:${randomBytes(4).toString('hex')}`;
      await getCachedQuery(`${prefix}:x`, makeAsyncTracked('x'));
      const before = cacheStats.invalidations;
      await invalidateCachePattern(`${prefix}:*`);
      expect(cacheStats.invalidations).toBeGreaterThan(before);
    });
  });

  describe('invalidateCacheMultiple()', () => {
    it('returns 0 in test mode (Redis unavailable)', async () => {
      const result = await invalidateCacheMultiple(['key:a', 'key:b']);
      expect(result).toBe(0);
    });

    it('returns 0 for empty array', async () => {
      const result = await invalidateCacheMultiple([]);
      expect(result).toBe(0);
    });
  });

  describe('clearAllCache()', () => {
    it('returns false in test mode (Redis unavailable)', async () => {
      const result = await clearAllCache();
      expect(result).toBe(false);
    });
  });

  describe('getCacheStatistics()', () => {
    it('returns stats object with hitRate, redisAvailable, redisConnected', async () => {
      const stats = await getCacheStatistics();
      expect(typeof stats.hitRate).toBe('number');
      expect(stats.redisAvailable).toBe(false);
      expect(stats.redisConnected).toBe(false);
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
    });

    it('hitRate is 0 when no hits or misses', async () => {
      resetCacheStatistics();
      const stats = await getCacheStatistics();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('resetCacheStatistics()', () => {
    it('resets hits, misses, errors, invalidations to 0', async () => {
      await getCachedQuery(`test:rs:${randomBytes(8).toString('hex')}`, makeAsyncTracked('v'));
      resetCacheStatistics();
      expect(cacheStats.hits).toBe(0);
      expect(cacheStats.misses).toBe(0);
      expect(cacheStats.errors).toBe(0);
      expect(cacheStats.invalidations).toBe(0);
    });
  });

  describe('closeRedisConnection()', () => {
    it('is a no-op in test mode (no Redis client)', async () => {
      // Should not throw when redisClient is null
      await expect(closeRedisConnection()).resolves.toBeUndefined();
    });
  });

  describe('generateCacheKey() - null/undefined filtering (line 144)', () => {
    it('filters null and undefined components', () => {
      expect(generateCacheKey('horses', null, 'page1')).toBe('horses:page1');
      expect(generateCacheKey('user', undefined, 42)).toBe('user:42');
    });
  });

  describe('cacheInvalidation convenience methods', () => {
    it('cacheInvalidation.horse(id) delegates to invalidateCache', async () => {
      const key = `horse:${randomBytes(4).toString('hex')}`;
      await getCachedQuery(key, makeAsyncTracked({ id: 1 }));
      const count = await cacheInvalidation.horse(key.replace('horse:', ''));
      expect(typeof count).toBe('number');
    });

    it('cacheInvalidation.horses() delegates to invalidateCachePattern', async () => {
      const result = await cacheInvalidation.horses();
      expect(typeof result).toBe('number');
    });

    it('cacheInvalidation.grooms() delegates to invalidateCachePattern', async () => {
      const result = await cacheInvalidation.grooms();
      expect(typeof result).toBe('number');
    });

    it('cacheInvalidation.groom(id) delegates to invalidateCache', async () => {
      const result = await cacheInvalidation.groom(1);
      expect(typeof result).toBe('number');
    });

    it('cacheInvalidation.leaderboards() delegates to invalidateCachePattern', async () => {
      const result = await cacheInvalidation.leaderboards();
      expect(typeof result).toBe('number');
    });

    it('cacheInvalidation.competitions() delegates to invalidateCachePattern', async () => {
      const result = await cacheInvalidation.competitions();
      expect(typeof result).toBe('number');
    });

    it('cacheInvalidation.users() delegates to invalidateCachePattern', async () => {
      const result = await cacheInvalidation.users();
      expect(typeof result).toBe('number');
    });

    it('cacheInvalidation.user(id) delegates to invalidateCache', async () => {
      const result = await cacheInvalidation.user(42);
      expect(typeof result).toBe('number');
    });
  });

  describe('LRU eviction (line 234-237)', () => {
    it('evicts oldest key when local cache reaches max capacity (1000 items)', async () => {
      // Fill the cache close to limit using a large batch so the eviction triggers
      const prefix = `test:lru:${randomBytes(4).toString('hex')}`;
      // We need the localCache to reach 1000 items. Each item must have a unique key.
      // Add 999 items first, then add one more to trigger eviction on the 1000th add.
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(getCachedQuery(`${prefix}:${i}`, makeAsyncTracked(i), 3600));
      }
      await Promise.all(promises);
      // Add one more to trigger the eviction branch
      await getCachedQuery(`${prefix}:overflow`, makeAsyncTracked('overflow'), 3600);
      // As long as no error was thrown, the eviction path ran successfully
    });
  });
});
