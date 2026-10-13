/**
 * The player horse-list cache behind GET /api/v1/horses — Equoria-gf4kd,
 * Equoria-3427a.
 *
 * One owner for the cache key and its invalidation, so the two cannot drift.
 * They did: the list was cached under generateCacheKey('horses:list', …), which
 * turns the ':' inside that component into '_' (real key 'horses_list:…'),
 * while every writer cleared the hand-written pattern 'horses:list:*', which
 * never matched — a renamed horse kept its old name in the stable for the
 * whole TTL. Both the key and the pattern are now built by generateCacheKey
 * from the same name.
 *
 * Call invalidateHorseListCache() after any committed change that alters what
 * a player's list shows (a horse added, renamed, or leaving the stable).
 */

import { generateCacheKey, invalidateCachePattern } from '../../../utils/cacheHelper.mjs';
import logger from '../../../utils/logger.mjs';

const HORSE_LIST = 'horses_list';

/** Seconds a player's list stays cached. */
export const HORSE_LIST_TTL = 120;

/** The cache key for one player's list query. */
export function horseListCacheKey(userId, breedId, limit, offset) {
  return generateCacheKey(HORSE_LIST, userId, breedId, limit, offset);
}

/**
 * Drop every cached horse list. Never throws: a failed invalidation is logged
 * and the list refreshes when its TTL runs out, so the change that triggered it
 * is never rolled back or failed over a cache.
 */
export async function invalidateHorseListCache() {
  try {
    await invalidateCachePattern(generateCacheKey(HORSE_LIST, '*'));
  } catch (error) {
    logger.warn(`[horseListCache] Horse-list cache invalidation failed: ${error.message}`);
  }
}
