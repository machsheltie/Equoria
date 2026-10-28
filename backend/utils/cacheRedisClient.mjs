/**
 * The query cache's Redis client factory (Equoria-5m00f), split out of cacheHelper.mjs
 * to keep that file under the size threshold. cacheHelper re-exports both functions.
 */

import Redis from 'ioredis';
import logger from './logger.mjs';

/**
 * Pure helper: is Redis intentionally disabled for the cache in this process?
 * True in test/jest (initializeRedis short-circuits to null) or when the
 * operator sets REDIS_DISABLED=true. In those cases the in-memory cache is the
 * by-design behavior, NOT a degradation — so no warning. Exported for unit
 * testing.
 *
 * @returns {boolean}
 */
export function cacheRedisIntentionallyDisabled(env = process.env) {
  const isTestLike = env.NODE_ENV === 'test' || env.JEST_WORKER_ID !== undefined;
  const redisDisabledFlag = env.REDIS_DISABLED === 'true';
  return isTestLike || redisDisabledFlag;
}

/**
 * Build the query cache's (not yet connected) Redis client from the environment,
 * or null when Redis is intentionally disabled (test/Jest or REDIS_DISABLED=true).
 *
 * Equoria-5m00f (ARCH-03): REDIS_URL wins, as it does for the rate limiter
 * (middleware/rateLimiting.mjs); REDIS_HOST/REDIS_PORT/REDIS_DB are the fallback.
 * REDIS_PASSWORD fills in a password the URL does not carry (a password inside
 * REDIS_URL wins, as ioredis merges URL fields first). The client is lazy, so
 * building it opens no connection. Exported for unit testing.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Redis | null}
 */
export function createCacheRedisClient(env = process.env) {
  if (cacheRedisIntentionallyDisabled(env)) {
    return null;
  }

  const options = {
    retryStrategy(times) {
      // Retry 3 times max, then give up
      if (times > 3) {
        logger.warn('[cacheHelper] Redis connection failed after 3 retries, caching disabled');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 100, 1000); // Max 1s delay
      return delay;
    },
    maxRetriesPerRequest: 1,
    connectTimeout: 2000, // 2 seconds
    lazyConnect: true,
    enableOfflineQueue: false, // Don't queue commands when offline
  };
  if (env.REDIS_PASSWORD) {
    options.password = env.REDIS_PASSWORD;
  }

  if (env.REDIS_URL) {
    return new Redis(env.REDIS_URL, options);
  }
  return new Redis({
    ...options,
    host: env.REDIS_HOST || 'localhost',
    port: parseInt(env.REDIS_PORT || '6379', 10),
    db: parseInt(env.REDIS_DB || '0', 10),
  });
}
