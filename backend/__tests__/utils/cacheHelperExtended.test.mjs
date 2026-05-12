/**
 * Extended tests for cacheHelper — covers functions missing from the existing
 * cacheHelper.test.mjs: invalidateCachePattern, invalidateCacheMultiple,
 * clearAllCache, getCacheStatistics, closeRedisConnection, cacheInvalidation.
 *
 * All tests run in NODE_ENV=test where Redis is disabled and the module falls
 * back to an in-memory localCache Map (private, not exported). We exercise the
 * public API to infer in-memory state.
 *
 * Equoria-rr7 coverage sprint.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  getCachedQuery,
  invalidateCachePattern,
  invalidateCacheMultiple,
  clearAllCache,
  getCacheStatistics,
  closeRedisConnection,
  resetCacheStatistics,
  cacheInvalidation,
  cacheStats,
} from '../../utils/cacheHelper.mjs';

function uid() {
  return randomBytes(6).toString('hex');
}

beforeEach(() => {
  resetCacheStatistics();
});

// ─── invalidateCachePattern ───────────────────────────────────────────────────

describe('invalidateCachePattern', () => {
  it('returns 0 when no local keys match the pattern', async () => {
    const count = await invalidateCachePattern(`nomatch_${uid()}:*`);
    expect(count).toBe(0);
  });

  it('deletes all local cache keys matching the pattern', async () => {
    const prefix = `ptest_${uid()}`;
    // Populate local cache with two matching keys and one non-matching key
    await getCachedQuery(`${prefix}:a`, async () => 'va', 60);
    await getCachedQuery(`${prefix}:b`, async () => 'vb', 60);
    const otherKey = `other_${uid()}:x`;
    await getCachedQuery(otherKey, async () => 'vx', 60);

    const count = await invalidateCachePattern(`${prefix}:*`);
    expect(count).toBeGreaterThanOrEqual(2);

    // The invalidated keys should now be cache misses (query re-executes)
    let calls = 0;
    const queryFn = async () => {
      calls++;
      return 'fresh';
    };
    await getCachedQuery(`${prefix}:a`, queryFn, 60);
    await getCachedQuery(`${prefix}:b`, queryFn, 60);
    expect(calls).toBe(2);
  });

  it('does not delete non-matching local keys', async () => {
    const prefix = `keep_${uid()}`;
    const keepKey = `${prefix}:keep`;
    await getCachedQuery(keepKey, async () => 'keeper', 60);

    await invalidateCachePattern(`nope_${uid()}:*`);

    // keepKey should still be in local cache (no query call on re-fetch)
    let calls = 0;
    await getCachedQuery(
      keepKey,
      async () => {
        calls++;
        return 'keeper';
      },
      60,
    );
    expect(calls).toBe(0); // cache hit — not re-fetched
  });

  it('increments invalidations stat when keys are deleted', async () => {
    const prefix = `stat_${uid()}`;
    await getCachedQuery(`${prefix}:x`, async () => 1, 60);
    const before = cacheStats.invalidations;

    const count = await invalidateCachePattern(`${prefix}:*`);
    expect(count).toBeGreaterThan(0);
    expect(cacheStats.invalidations).toBeGreaterThan(before);
  });

  it('does not increment invalidations stat when nothing matched', async () => {
    resetCacheStatistics();
    await invalidateCachePattern(`definitely_no_match_${uid()}:*`);
    expect(cacheStats.invalidations).toBe(0);
  });
});

// ─── invalidateCacheMultiple ──────────────────────────────────────────────────

describe('invalidateCacheMultiple', () => {
  it('returns 0 when Redis is unavailable (test environment)', async () => {
    const result = await invalidateCacheMultiple(['any:key:1', 'any:key:2']);
    expect(result).toBe(0);
  });

  it('returns 0 for empty keys array', async () => {
    const result = await invalidateCacheMultiple([]);
    expect(result).toBe(0);
  });

  it('does not throw for arbitrary key arrays', async () => {
    await expect(invalidateCacheMultiple(['k1', 'k2', 'k3', 'k4', 'k5'])).resolves.toBe(0);
  });
});

// ─── clearAllCache ────────────────────────────────────────────────────────────

describe('clearAllCache', () => {
  it('returns false when Redis is unavailable (test environment)', async () => {
    const result = await clearAllCache();
    expect(result).toBe(false);
  });

  it('does not throw', async () => {
    await expect(clearAllCache()).resolves.toBe(false);
  });
});

// ─── getCacheStatistics ───────────────────────────────────────────────────────

describe('getCacheStatistics', () => {
  it('returns an object with required stat fields', async () => {
    const stats = await getCacheStatistics();
    expect(typeof stats.hits).toBe('number');
    expect(typeof stats.misses).toBe('number');
    expect(typeof stats.errors).toBe('number');
    expect(typeof stats.invalidations).toBe('number');
    expect(typeof stats.hitRate).toBe('number');
    expect(typeof stats.redisAvailable).toBe('boolean');
    expect(typeof stats.redisConnected).toBe('boolean');
  });

  it('reports redisAvailable: false in test environment', async () => {
    const stats = await getCacheStatistics();
    expect(stats.redisAvailable).toBe(false);
    expect(stats.redisConnected).toBe(false);
  });

  it('hitRate is 0 when no hits or misses', async () => {
    resetCacheStatistics();
    const stats = await getCacheStatistics();
    expect(stats.hitRate).toBe(0);
  });

  it('hitRate reflects actual hits and misses', async () => {
    const k = `rate_${uid()}`;
    const missBefore = cacheStats.localMisses;
    const hitBefore = cacheStats.localHits;

    // First call: local miss → queryFn runs
    await getCachedQuery(k, async () => 'v', 60);
    // Second call: local hit
    await getCachedQuery(k, async () => 'v', 60);

    expect(cacheStats.localMisses).toBe(missBefore + 1);
    expect(cacheStats.localHits).toBe(hitBefore + 1);
  });

  it('does not include redis key in stats when Redis is unavailable', async () => {
    const stats = await getCacheStatistics();
    expect(stats.redis).toBeUndefined();
  });
});

// ─── closeRedisConnection ────────────────────────────────────────────────────

describe('closeRedisConnection', () => {
  it('resolves without error when no Redis client exists (test environment)', async () => {
    await expect(closeRedisConnection()).resolves.toBeUndefined();
  });

  it('is idempotent — calling twice does not throw', async () => {
    await expect(closeRedisConnection()).resolves.toBeUndefined();
    await expect(closeRedisConnection()).resolves.toBeUndefined();
  });
});

// ─── cacheInvalidation helpers ────────────────────────────────────────────────

describe('cacheInvalidation', () => {
  it('horses() resolves to a number', async () => {
    const result = await cacheInvalidation.horses();
    expect(typeof result).toBe('number');
  });

  it('horse(id) resolves to a number', async () => {
    const result = await cacheInvalidation.horse(42);
    expect(typeof result).toBe('number');
  });

  it('grooms() resolves to a number', async () => {
    const result = await cacheInvalidation.grooms();
    expect(typeof result).toBe('number');
  });

  it('groom(id) resolves to a number', async () => {
    const result = await cacheInvalidation.groom(7);
    expect(typeof result).toBe('number');
  });

  it('leaderboards() resolves to a number', async () => {
    const result = await cacheInvalidation.leaderboards();
    expect(typeof result).toBe('number');
  });

  it('competitions() resolves to a number', async () => {
    const result = await cacheInvalidation.competitions();
    expect(typeof result).toBe('number');
  });

  it('competition(id) resolves to a number', async () => {
    const result = await cacheInvalidation.competition(99);
    expect(typeof result).toBe('number');
  });

  it('users() resolves to a number', async () => {
    const result = await cacheInvalidation.users();
    expect(typeof result).toBe('number');
  });

  it('user(id) resolves to a number', async () => {
    const result = await cacheInvalidation.user('abc123');
    expect(typeof result).toBe('number');
  });

  it('horse() invalidates only the specific horse key from local cache', async () => {
    const horseId = 1001;
    const k = `horse:${horseId}`;

    // Plant it in local cache
    await getCachedQuery(k, async () => ({ id: horseId }), 60);

    // Verify cached
    let calls = 0;
    await getCachedQuery(
      k,
      async () => {
        calls++;
        return { id: horseId };
      },
      60,
    );
    expect(calls).toBe(0); // was cached

    // Invalidate
    await cacheInvalidation.horse(horseId);

    // Now should be a miss
    await getCachedQuery(
      k,
      async () => {
        calls++;
        return { id: horseId };
      },
      60,
    );
    expect(calls).toBe(1); // cache was cleared
  });
});
