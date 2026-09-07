/**
 * Horse-list cache invalidation actually matches its own cache key
 * (Equoria-6p398.2, surfaced while migrating the E2E horse fixtures).
 *
 * THE DEFECT: `GET /api/v1/horses` caches its result under
 *   generateCacheKey('horses:list', userId, breedId, limit, offset)
 * and `generateCacheKey` sanitizes `:` INSIDE each component:
 *   `String(c).replace(/[:\s]/g, '_')`
 * so the literal first component `'horses:list'` becomes `horses_list` and the
 * real key is `horses_list:<userId>:<breedId>:<limit>:<offset>`.
 *
 * Every writer then invalidated with the pattern `'horses:list:*'`, which
 * `invalidateCachePattern` turns into the regex `^horses:list:.*$`. That regex
 * can never match `horses_list:…`, so the invalidation was a silent no-op:
 *   - `PUT /api/v1/horses/:id` — a player renamed a horse and their stable kept
 *     showing the old name for the 120s TTL;
 *   - `deleteHorseService` — a deleted horse kept appearing in the list;
 *   - `createHorseService` — a newly created horse stayed invisible.
 * It failed silently because the call site is `.catch(() => {})` and a no-op
 * returns 0 deleted keys rather than throwing.
 *
 * The fix is the pattern `'horses_list:*'` at all three writers. These tests
 * are written against the REAL cacheHelper (no mocks): the first proves the old
 * pattern genuinely fails to evict — so this file would have caught the defect —
 * and the second proves the shipped pattern evicts and forces a fresh query. A
 * source sentinel then stops the literal drifting back.
 *
 * The in-memory cache path is exercised deliberately: under Jest,
 * `redisIntentionallyDisabled()` is true, so `getCachedQuery` uses the local
 * Map — the same code path a Redis-less runtime uses.
 *
 * @module modules/horses/__tests__/horseListCacheInvalidation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { generateCacheKey, getCachedQuery, invalidateCachePattern } from '../../../utils/cacheHelper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The exact key shape `GET /horses` builds (horseRoutes.mjs). */
function horseListKeyFor(userId) {
  return generateCacheKey('horses:list', userId, 'all', 200, 0);
}

/** Cache one list result under the real key and return a hit/miss counter. */
async function primeCache(userId, payload) {
  const calls = { count: 0 };
  const queryFn = async () => {
    calls.count += 1;
    return payload;
  };
  const key = horseListKeyFor(userId);
  await getCachedQuery(key, queryFn, 120);
  expect(calls.count).toBe(1); // first read populated the cache
  await getCachedQuery(key, queryFn, 120);
  expect(calls.count).toBe(1); // second read served from cache
  return { key, calls, queryFn };
}

describe('horse-list cache invalidation (Equoria-6p398.2)', () => {
  let userId;

  beforeEach(() => {
    // Unique per test so parallel/serial suites never share a cache entry.
    userId = `hlci-${randomBytes(8).toString('hex')}`;
  });

  it('the OLD pattern horses:list:* does NOT evict the key the route writes', async () => {
    const { calls, key, queryFn } = await primeCache(userId, [{ id: 1, name: 'Stale' }]);

    // Reproduces the defect: the sanitized key cannot match the unsanitized pattern.
    expect(key.startsWith('horses_list:')).toBe(true);
    const evicted = await invalidateCachePattern('horses:list:*');
    expect(evicted).toBe(0);

    // Still served from the stale cache — the query never re-ran.
    const after = await getCachedQuery(key, queryFn, 120);
    expect(calls.count).toBe(1);
    expect(after).toEqual([{ id: 1, name: 'Stale' }]);
  });

  it('the shipped pattern horses_list:* evicts the key and forces a fresh query', async () => {
    const { calls, key } = await primeCache(userId, [{ id: 1, name: 'Stale' }]);

    const evicted = await invalidateCachePattern('horses_list:*');
    expect(evicted).toBeGreaterThanOrEqual(1);

    // The next read misses and re-runs the query, returning current data.
    const fresh = await getCachedQuery(
      key,
      async () => {
        calls.count += 1;
        return [
          { id: 1, name: 'Renamed' },
          { id: 2, name: 'Newly seeded' },
        ];
      },
      120,
    );
    expect(calls.count).toBe(2);
    expect(fresh).toEqual([
      { id: 1, name: 'Renamed' },
      { id: 2, name: 'Newly seeded' },
    ]);
  });

  it('SOURCE SENTINEL: no horse writer reintroduces the unsanitized pattern', () => {
    const writers = [
      resolve(__dirname, '..', 'routes', 'horseRoutes.mjs'),
      resolve(__dirname, '..', 'services', 'deleteHorseService.mjs'),
      resolve(__dirname, '..', 'services', 'createHorseService.mjs'),
    ];

    for (const file of writers) {
      const source = readFileSync(file, 'utf8');
      expect({ file, uses: source.includes("invalidateCachePattern('horses:list:*')") }).toEqual({
        file,
        uses: false,
      });
      expect({ file, uses: source.includes("invalidateCachePattern('horses_list:*')") }).toEqual({
        file,
        uses: true,
      });
    }
  });
});
