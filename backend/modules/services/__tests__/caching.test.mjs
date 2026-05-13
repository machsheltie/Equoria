/**
 * Performance — Cache Hit/Miss Behavior Tests
 *
 * Tests the in-memory caching layer in cacheHelper using real function
 * calls (no mocks). Verifies that:
 * - A second call with the same key returns cached data without re-invoking queryFn
 * - Cache invalidation causes the next call to re-execute queryFn
 * - Different cache keys result in independent cache entries
 * - Cache statistics accurately reflect hit/miss counts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getCachedQuery,
  invalidateCache,
  resetCacheStatistics,
  getCacheStatistics,
  generateCacheKey,
} from '../../../utils/cacheHelper.mjs';

// Unique prefix to avoid cross-test interference when tests run concurrently
const KEY_PREFIX = `perf-cache-${Date.now()}`;

describe('Cache Hit/Miss Behavior', () => {
  beforeEach(() => {
    resetCacheStatistics();
  });

  it('returns cached result on second call (cache HIT)', async () => {
    const key = generateCacheKey(KEY_PREFIX, 'hit', Math.random());
    let callCount = 0;
    const queryFn = async () => ({ value: ++callCount });

    const first = await getCachedQuery(key, queryFn, 60);
    expect(first.value).toBe(1);

    const second = await getCachedQuery(key, queryFn, 60);
    expect(second.value).toBe(1); // same cached result
    expect(callCount).toBe(1); // queryFn called only once
  });

  it('re-executes queryFn after cache invalidation', async () => {
    const key = generateCacheKey(KEY_PREFIX, 'invalidate', Math.random());
    let callCount = 0;
    const queryFn = async () => ({ value: ++callCount });

    await getCachedQuery(key, queryFn, 60);
    expect(callCount).toBe(1);

    await invalidateCache(key);

    const afterInvalidation = await getCachedQuery(key, queryFn, 60);
    expect(afterInvalidation.value).toBe(2);
    expect(callCount).toBe(2); // queryFn re-executed after invalidation
  });

  it('different keys have independent cache entries', async () => {
    const keyA = generateCacheKey(KEY_PREFIX, 'keyA', Math.random());
    const keyB = generateCacheKey(KEY_PREFIX, 'keyB', Math.random());

    let countA = 0;
    let countB = 0;

    await getCachedQuery(keyA, async () => ({ from: 'A', n: ++countA }), 60);
    await getCachedQuery(keyB, async () => ({ from: 'B', n: ++countB }), 60);

    // Second calls hit cache — neither queryFn should be invoked again
    const a2 = await getCachedQuery(keyA, async () => ({ from: 'A', n: ++countA }), 60);
    const b2 = await getCachedQuery(keyB, async () => ({ from: 'B', n: ++countB }), 60);

    expect(a2.from).toBe('A');
    expect(b2.from).toBe('B');
    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });

  it('cache statistics reflect local hits and misses', async () => {
    resetCacheStatistics();

    const key = generateCacheKey(KEY_PREFIX, 'stats', Math.random());
    const queryFn = async () => ({ ok: true });

    // Miss
    await getCachedQuery(key, queryFn, 60);
    // Hit
    await getCachedQuery(key, queryFn, 60);

    const stats = await getCacheStatistics();
    expect(stats.localMisses).toBeGreaterThanOrEqual(1);
    expect(stats.localHits).toBeGreaterThanOrEqual(1);
  });

  it('null result from queryFn is NOT cached', async () => {
    const key = generateCacheKey(KEY_PREFIX, 'null', Math.random());
    let callCount = 0;
    const queryFn = async () => {
      callCount++;
      return null;
    };

    const r1 = await getCachedQuery(key, queryFn, 60);
    const r2 = await getCachedQuery(key, queryFn, 60);

    expect(r1).toBeNull();
    expect(r2).toBeNull();
    // null is not cached, so queryFn should be called each time
    expect(callCount).toBe(2);
  });
});
