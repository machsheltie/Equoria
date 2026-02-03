/**
 * Cache Helper Unit Tests
 * Verifies the caching logic and in-memory fallback
 */

import { describe, it, expect, jest, beforeEach, afterEach as _afterEach } from '@jest/globals';
import {
  getCachedQuery,
  invalidateCache,
  generateCacheKey,
  cacheStats,
  resetCacheStatistics,
} from '../../utils/cacheHelper.mjs';

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
      const cacheKey = `test:key:${Date.now()}`;
      const queryData = { id: 1, name: 'Test' };
      const queryFn = jest.fn(async () => queryData);

      // First call - Cache Miss
      const result1 = await getCachedQuery(cacheKey, queryFn, 10);
      expect(result1).toEqual(queryData);
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(cacheStats.localMisses).toBe(1);

      // Second call - Cache Hit
      const result2 = await getCachedQuery(cacheKey, queryFn, 10);
      expect(result2).toEqual(queryData);
      expect(queryFn).toHaveBeenCalledTimes(1); // Should NOT be called again
      expect(cacheStats.localHits).toBe(1);
    });

    it('should respect TTL', async () => {
      const cacheKey = `test:ttl:${Date.now()}`;
      const queryFn = jest.fn(async () => ({ data: 'old' }));

      // Cache with 0s TTL (expires immediately)
      await getCachedQuery(cacheKey, queryFn, 0);

      // Try again
      await getCachedQuery(cacheKey, queryFn, 10);

      expect(queryFn).toHaveBeenCalledTimes(2);
    });

    it('should handle undefined/null results', async () => {
      const cacheKey = `test:null:${Date.now()}`;
      const queryFn = jest.fn(async () => null);

      const result = await getCachedQuery(cacheKey, queryFn);
      expect(result).toBeNull();
      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidateCache()', () => {
    it('should remove items from cache', async () => {
      const cacheKey = `test:invalidate:${Date.now()}`;
      const queryFn = jest.fn(async () => 'fresh');

      // Cache it
      await getCachedQuery(cacheKey, queryFn);

      // Invalidate
      await invalidateCache(cacheKey);

      // Get again
      await getCachedQuery(cacheKey, queryFn);

      expect(queryFn).toHaveBeenCalledTimes(2);
    });
  });
});
