/**
 * 🚀 Cache Helper Utilities
 *
 * Generic caching utilities for controller-level query caching
 * Features:
 * - Easy-to-use getCachedQuery() for controllers
 * - Automatic cache key generation
 * - Cache invalidation patterns
 * - Cache statistics tracking
 * - Graceful Redis failures
 *
 * Usage in controllers:
 * ```javascript
 * import { getCachedQuery, invalidateCache } from '../utils/cacheHelper.mjs';
 *
 * const horses = await getCachedQuery(
 *   'horses:forSale:page1',
 *   () => prisma.horse.findMany({ where: { forSale: true } }),
 *   120 // 2min TTL
 * );
 * ```
 */

import Redis from 'ioredis';
import logger from './logger.mjs';
import { createRedisCircuitBreaker } from './redisCircuitBreaker.mjs';

// Redis client singleton
let redisClient = null;
let redisCircuitBreaker = null; // Circuit breaker wrapper
let isRedisAvailable = false;

// In-memory fallback cache
const localCache = new Map();
const LOCAL_CACHE_MAX_ITEMS = 1000;

// ─── CACHE_REQUIRE_REDIS observability gate (Equoria-1tu03) ───────────────────
//
// Unlike the rate limiter (Equoria-4kfbh) where a silent in-memory fallback is a
// SECURITY fail-open (per-process counters multiply caps across nodes and neuter
// brute-force protection), the query cache fallback is a PERFORMANCE/COHERENCY
// degradation: on a multi-node deploy each node keeps its own in-memory Map, so
// the same query can return stale or divergent results across nodes and a write
// on node A is not invalidated on node B. That is a correctness-of-reads risk,
// not a security hole — so the correct posture here is NOT to refuse to boot
// (a missing CACHE should never brick a node), but to emit a LOUD, one-time
// operator warning so the degradation is observable instead of silent.
//
// Deployable environments where the silent fallback matters. Kept as a literal
// set (mirrors DEPLOYABLE_ENVS_FOR_REDIS in rateLimiting.mjs) to avoid a
// cross-module import.
const CACHE_DEPLOYABLE_ENVS = new Set(['production', 'beta']);

// One-time latch so the operator warning is emitted at most once per process —
// the cache init path can run on every getCachedQuery call (lazy singleton), and
// an unthrottled warn would spam logs on every cache miss during a Redis outage.
let cacheRedisDegradationWarned = false;

/**
 * Pure helper: is Redis intentionally disabled for the cache in this process?
 * True in test/jest (initializeRedis short-circuits to null) or when the
 * operator sets REDIS_DISABLED=true. In those cases the in-memory cache is the
 * by-design behavior, NOT a degradation — so no warning. Exported for unit
 * testing.
 *
 * @returns {boolean}
 */
export function cacheRedisIntentionallyDisabled() {
  const isTestLike = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  const redisDisabledFlag = process.env.REDIS_DISABLED === 'true';
  return isTestLike || redisDisabledFlag;
}

/**
 * Pure helper: has the operator opted into the CACHE_REQUIRE_REDIS observability
 * gate? Defaults to FALSE so an existing single-node deploy (where in-memory
 * caching is perfectly fine) sees no new warnings. Exported for unit testing.
 *
 * @returns {boolean}
 */
export function cacheRequiresRedis() {
  return process.env.CACHE_REQUIRE_REDIS === 'true';
}

/**
 * Pure decision: should a LOUD one-time degradation warning be emitted because
 * the operator declared Redis required for the cache but it is unreachable?
 * Returns TRUE iff ALL of:
 *   - requireRedis === true                 (operator opted in)
 *   - nodeEnv is deployable (production|beta)
 *   - redisIntentionallyDisabled === false  (not test/REDIS_DISABLED)
 *   - redisConnected === false              (Redis did not connect)
 *
 * Deliberately a WARN decision, NOT a throw decision: a query-cache outage must
 * never crash a node (contrast shouldFailStartupWithoutRedis in rateLimiting.mjs,
 * which DOES throw because rate limiting is a security control). All inputs are
 * injected (no env reads) so the full matrix is unit-testable without a live
 * Redis. Exported for unit testing.
 *
 * @param {Object} params
 * @param {string}  params.nodeEnv
 * @param {boolean} params.requireRedis
 * @param {boolean} params.redisConnected
 * @param {boolean} params.redisIntentionallyDisabled
 * @returns {boolean}
 */
export function shouldWarnCacheWithoutRedis({
  nodeEnv,
  requireRedis,
  redisConnected,
  redisIntentionallyDisabled,
}) {
  return (
    requireRedis === true &&
    CACHE_DEPLOYABLE_ENVS.has(nodeEnv) &&
    redisIntentionallyDisabled === false &&
    redisConnected === false
  );
}

/**
 * Emit the one-time loud cache-degradation warning if the CACHE_REQUIRE_REDIS
 * gate decides one is warranted. Reads live env/state, delegates the decision to
 * the pure shouldWarnCacheWithoutRedis(). Latched so it fires at most once per
 * process. Returns true if a warning was emitted this call (for testing).
 *
 * @param {boolean} redisConnected - Is Redis currently connected?
 * @returns {boolean} whether a warning was emitted on this invocation
 */
export function maybeWarnCacheWithoutRedis(redisConnected) {
  if (cacheRedisDegradationWarned) {
    return false;
  }
  const warranted = shouldWarnCacheWithoutRedis({
    nodeEnv: process.env.NODE_ENV,
    requireRedis: cacheRequiresRedis(),
    redisConnected,
    redisIntentionallyDisabled: cacheRedisIntentionallyDisabled(),
  });
  if (!warranted) {
    return false;
  }
  cacheRedisDegradationWarned = true;
  logger.warn(
    '[cacheHelper] CACHE_REQUIRE_REDIS=true but Redis is unreachable in ' +
      `${process.env.NODE_ENV}. Query cache is running on the per-process in-memory ` +
      'fallback. In a multi-node deployment this means cache reads can be STALE or ' +
      'DIVERGENT across nodes and a write on one node does NOT invalidate the cache ' +
      'on others — a cache-coherency risk (not a security hole, so the node still ' +
      'boots). Fix REDIS_HOST/REDIS_URL availability, or unset CACHE_REQUIRE_REDIS ' +
      'to silence this warning and accept per-process caching.',
    { gate: 'CACHE_REQUIRE_REDIS', alertType: 'cache_redis_degradation' },
  );
  return true;
}

/**
 * TEST-ONLY: reset the one-time warning latch so a test can drive the warn path
 * repeatedly. Not part of the production cache API; production never re-arms.
 */
export function _resetCacheDegradationWarning() {
  cacheRedisDegradationWarned = false;
}

// Cache statistics
export const cacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  invalidations: 0,
  totalKeys: 0,
  lastUpdate: new Date(),
  localHits: 0,
  localMisses: 0,
};

/**
 * Initialize Redis client with optimized configuration
 */
async function initializeRedis() {
  if (redisClient) {
    return redisClient;
  }

  // Skip Redis in test environment
  if (process.env.NODE_ENV === 'test') {
    // logger.info('[cacheHelper] Redis disabled in test environment'); // Reduce log noise
    // Equoria-1tu03: cacheRedisIntentionallyDisabled() is true here, so the
    // gate decides NO warn — but route through the gate anyway so there is a
    // single canonical warn site rather than scattered conditionals.
    maybeWarnCacheWithoutRedis(false);
    return null;
  }

  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
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
    });

    // Event handlers
    redisClient.on('error', error => {
      logger.warn('[cacheHelper] Redis connection error (caching degraded):', error.message);
      isRedisAvailable = false;
      cacheStats.errors++;
    });

    redisClient.on('connect', () => {
      logger.info('[cacheHelper] Redis connected successfully');
      isRedisAvailable = true;
    });

    redisClient.on('close', () => {
      logger.warn('[cacheHelper] Redis connection closed');
      isRedisAvailable = false;
    });

    // Attempt connection
    await redisClient.connect();

    // Configure Redis maxmemory policy for LRU eviction
    try {
      await redisClient.config('SET', 'maxmemory-policy', 'allkeys-lru');
      logger.info('[cacheHelper] Redis maxmemory policy set to allkeys-lru');
    } catch (configError) {
      logger.warn('[cacheHelper] Could not set Redis maxmemory policy:', configError.message);
    }

    isRedisAvailable = true;

    // Wrap Redis client with circuit breaker for resilience
    redisCircuitBreaker = createRedisCircuitBreaker(redisClient, {
      errorThresholdPercentage: 50,
      resetTimeout: 30000, // 30 seconds
      timeout: 3000, // 3 seconds per operation
      volumeThreshold: 10,
      halfOpenRequests: 3,
    });

    logger.info('[cacheHelper] Redis circuit breaker initialized');
    return redisClient;
  } catch (error) {
    logger.warn(
      '[cacheHelper] Redis initialization failed, using in-memory fallback:',
      error.message,
    );
    isRedisAvailable = false;
    redisClient = null;
    redisCircuitBreaker = null;
    // Equoria-1tu03: Redis was EXPECTED (real deploy) but failed to init. If the
    // operator opted into CACHE_REQUIRE_REDIS and we're in a deployable env, emit
    // the loud one-time cache-coherency warning. Does NOT throw — a cache outage
    // must not crash the node.
    maybeWarnCacheWithoutRedis(false);
    return null;
  }
}

/**
 * Generate standardized cache key from components
 * @param {...string} components - Key components (e.g., 'horses', 'forSale', 'page1')
 * @returns {string} Cache key (e.g., 'horses:forSale:page1')
 */
export function generateCacheKey(...components) {
  return components
    .filter(c => c !== null && c !== undefined)
    .map(c => String(c).replace(/[:\s]/g, '_'))
    .join(':');
}

/**
 * Get cached query result or execute query and cache it
 * Supports Redis with fallback to in-memory cache
 *
 * @param {string} cacheKey - Cache key
 * @param {Function} queryFn - Async function that executes the query
 * @param {number} ttl - Time to live in seconds (default: 60)
 * @returns {Promise<any>} Query result (from cache or fresh)
 */
export async function getCachedQuery(cacheKey, queryFn, ttl = 60) {
  const redis = await initializeRedis();

  // Try Redis first if available (using circuit breaker)
  if (redis && isRedisAvailable && redisCircuitBreaker) {
    try {
      // Check if circuit is open - if so, skip Redis and use local cache
      if (redisCircuitBreaker.isCircuitOpen()) {
        logger.debug(`[cacheHelper] Circuit OPEN, skipping Redis for: ${cacheKey}`);
      } else {
        const cached = await redisCircuitBreaker.operations.get.fire(cacheKey);

        if (cached) {
          cacheStats.hits++;
          cacheStats.lastUpdate = new Date();
          logger.debug(`[cacheHelper] Redis Cache HIT: ${cacheKey}`);

          try {
            return JSON.parse(cached);
          } catch (parseError) {
            logger.warn(`[cacheHelper] Cache parse error for key ${cacheKey}:`, parseError.message);
            // Fall through to re-fetch
          }
        }
      }
    } catch (error) {
      logger.error(`[cacheHelper] Redis read failed for ${cacheKey}:`, error.message);
      cacheStats.errors++;
      // Fall through to query execution (circuit breaker will handle failure tracking)
    }
  } else {
    // Check in-memory cache
    const localItem = localCache.get(cacheKey);
    if (localItem) {
      const now = Date.now();
      if (localItem.expires > now) {
        cacheStats.localHits++;
        cacheStats.lastUpdate = new Date();
        logger.debug(`[cacheHelper] Local Cache HIT: ${cacheKey}`);
        return localItem.data; // Already parsed/object
      } else {
        localCache.delete(cacheKey); // Expired
      }
    } else {
      cacheStats.localMisses++;
    }
  }

  // Cache miss - execute query
  if (isRedisAvailable) {
    cacheStats.misses++;
    logger.debug(`[cacheHelper] Redis Cache MISS: ${cacheKey}`);
  }

  const result = await queryFn();

  // Cache the result
  if (result !== undefined && result !== null) {
    // 1. Save to Redis if available (using circuit breaker)
    if (redis && isRedisAvailable && redisCircuitBreaker) {
      try {
        // Only attempt Redis write if circuit is not open
        if (!redisCircuitBreaker.isCircuitOpen()) {
          await redisCircuitBreaker.operations.setex.fire(cacheKey, ttl, JSON.stringify(result));
          logger.debug(`[cacheHelper] Cached to Redis: ${cacheKey} (TTL: ${ttl}s)`);
        } else {
          logger.debug(`[cacheHelper] Circuit OPEN, skipping Redis write for: ${cacheKey}`);
        }
      } catch (cacheError) {
        logger.warn(`[cacheHelper] Failed to cache to Redis for ${cacheKey}:`, cacheError.message);
        cacheStats.errors++;
      }
    }

    // 2. Save to local cache (as backup or primary if Redis down)
    // Enforce size limit
    if (localCache.size >= LOCAL_CACHE_MAX_ITEMS) {
      // Simple eviction: delete first item (FIFO-ish since Maps preserve insertion order)
      const firstKey = localCache.keys().next().value;
      localCache.delete(firstKey);
    }

    localCache.set(cacheKey, {
      data: result,
      expires: Date.now() + ttl * 1000,
    });
  }

  return result;
}

/**
 * Invalidate cache by exact key (both Redis and Local)
 * @param {string} cacheKey - Cache key to invalidate
 * @returns {Promise<number>} Number of keys deleted
 */
export async function invalidateCache(cacheKey) {
  let deletedCount = 0;

  // Invalidate local
  if (localCache.delete(cacheKey)) {
    deletedCount++;
  }

  // Invalidate Redis (using circuit breaker)
  const redis = await initializeRedis();
  if (redis && isRedisAvailable && redisCircuitBreaker) {
    try {
      if (!redisCircuitBreaker.isCircuitOpen()) {
        const deleted = await redisCircuitBreaker.operations.del.fire(cacheKey);
        deletedCount += deleted;
        logger.debug(`[cacheHelper] Invalidated Redis cache: ${cacheKey}`);
      } else {
        logger.debug(`[cacheHelper] Circuit OPEN, skipping Redis invalidation for: ${cacheKey}`);
      }
    } catch (error) {
      logger.error(`[cacheHelper] Redis invalidation failed for ${cacheKey}:`, error.message);
      cacheStats.errors++;
    }
  }

  if (deletedCount > 0) {
    cacheStats.invalidations++;
  }

  return deletedCount;
}

/**
 * Invalidate cache by pattern (Redis only for now, Local exact match only)
 * Note: Pattern matching on Map is O(N), so use sparingly for local cache
 * @param {string} pattern - Key pattern with wildcards (e.g., 'horses:*')
 * @returns {Promise<number>} Number of keys deleted
 */
export async function invalidateCachePattern(pattern) {
  let deletedCount = 0;

  // Local cache pattern matching (regex-like)
  // Convert Redis pattern 'horses:*' to Regex '^horses:.*'
  const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);

  for (const key of localCache.keys()) {
    if (regex.test(key)) {
      localCache.delete(key);
      deletedCount++;
    }
  }

  // Redis pattern matching (using circuit breaker)
  const redis = await initializeRedis();
  if (redis && isRedisAvailable && redisCircuitBreaker) {
    try {
      if (!redisCircuitBreaker.isCircuitOpen()) {
        const keys = await redisCircuitBreaker.operations.keys.fire(pattern);
        if (keys.length > 0) {
          const deleted = await redisCircuitBreaker.operations.del.fire(...keys);
          deletedCount += deleted;
          logger.debug(`[cacheHelper] Invalidated ${deleted} Redis keys for pattern: ${pattern}`);
        }
      } else {
        logger.debug(`[cacheHelper] Circuit OPEN, skipping pattern invalidation for: ${pattern}`);
      }
    } catch (error) {
      logger.error(`[cacheHelper] Pattern invalidation failed for ${pattern}:`, error.message);
      cacheStats.errors++;
    }
  }

  if (deletedCount > 0) {
    cacheStats.invalidations += deletedCount;
  }

  return deletedCount;
}

/**
 * Invalidate multiple specific cache keys at once
 * @param {string[]} cacheKeys - Array of cache keys to invalidate
 * @returns {Promise<number>} Number of keys deleted
 */
export async function invalidateCacheMultiple(cacheKeys) {
  const redis = await initializeRedis();

  if (!redis || !isRedisAvailable || !redisCircuitBreaker || cacheKeys.length === 0) {
    return 0;
  }

  try {
    if (!redisCircuitBreaker.isCircuitOpen()) {
      const deleted = await redisCircuitBreaker.operations.del.fire(...cacheKeys);
      cacheStats.invalidations += deleted;
      logger.debug(`[cacheHelper] Invalidated ${deleted} cache keys`);
      return deleted;
    } else {
      logger.debug('[cacheHelper] Circuit OPEN, skipping multi-key invalidation');
      return 0;
    }
  } catch (error) {
    logger.error('[cacheHelper] Multi-key invalidation failed:', error.message);
    cacheStats.errors++;
    return 0;
  }
}

/**
 * Clear all cache keys (use with caution!)
 * @returns {Promise<boolean>} Success status
 */
export async function clearAllCache() {
  const redis = await initializeRedis();

  if (!redis || !isRedisAvailable || !redisCircuitBreaker) {
    logger.warn('[cacheHelper] Clear all cache skipped (Redis unavailable)');
    return false;
  }

  try {
    if (!redisCircuitBreaker.isCircuitOpen()) {
      await redisCircuitBreaker.operations.flushdb.fire();
      cacheStats.invalidations++;
      logger.warn('[cacheHelper] Cleared ALL cache keys');
      return true;
    } else {
      logger.warn('[cacheHelper] Circuit OPEN, cannot clear all cache');
      return false;
    }
  } catch (error) {
    logger.error('[cacheHelper] Failed to clear all cache:', error.message);
    cacheStats.errors++;
    return false;
  }
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
export async function getCacheStatistics() {
  const redis = await initializeRedis();

  const stats = {
    ...cacheStats,
    hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0,
    redisAvailable: isRedisAvailable,
    redisConnected: !!redis,
  };

  // Add circuit breaker metrics if available
  if (redisCircuitBreaker) {
    stats.circuitBreaker = redisCircuitBreaker.getHealthStatus();
  }

  if (redis && isRedisAvailable) {
    try {
      const info = await redis.info('stats');
      const memory = await redis.info('memory');

      // Parse Redis info
      const totalKeys = await redis.dbsize();

      stats.redis = {
        totalKeys,
        memoryUsed: extractInfoValue(memory, 'used_memory_human'),
        peakMemoryUsed: extractInfoValue(memory, 'used_memory_peak_human'),
        totalConnectionsReceived: extractInfoValue(info, 'total_connections_received'),
        totalCommandsProcessed: extractInfoValue(info, 'total_commands_processed'),
        evictedKeys: extractInfoValue(info, 'evicted_keys'),
        keyspaceHits: extractInfoValue(info, 'keyspace_hits'),
        keyspaceMisses: extractInfoValue(info, 'keyspace_misses'),
      };
    } catch (error) {
      logger.warn('[cacheHelper] Failed to get Redis stats:', error.message);
    }
  }

  return stats;
}

/**
 * Reset cache statistics counters
 */
export function resetCacheStatistics() {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.errors = 0;
  cacheStats.invalidations = 0;
  cacheStats.lastUpdate = new Date();
  logger.info('[cacheHelper] Cache statistics reset');
}

/**
 * Helper to extract values from Redis INFO output
 */
function extractInfoValue(infoString, key) {
  const regex = new RegExp(`${key}:(.+)`);
  const match = infoString.match(regex);
  return match ? match[1].trim() : 'N/A';
}

/**
 * Gracefully close Redis connection (for app shutdown)
 */
export async function closeRedisConnection() {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('[cacheHelper] Redis connection closed gracefully');
    } catch (error) {
      logger.error('[cacheHelper] Error closing Redis connection:', error.message);
    }
    redisClient = null;
    isRedisAvailable = false;
  }
}

/**
 * Pre-defined cache invalidation helpers for common patterns
 */
export const cacheInvalidation = {
  /**
   * Invalidate all horse-related caches
   */
  async horses() {
    return await invalidateCachePattern('horses:*');
  },

  /**
   * Invalidate specific horse cache
   */
  async horse(horseId) {
    return await invalidateCache(`horse:${horseId}`);
  },

  /**
   * Invalidate all groom-related caches
   */
  async grooms() {
    return await invalidateCachePattern('grooms:*');
  },

  /**
   * Invalidate specific groom cache
   */
  async groom(groomId) {
    return await invalidateCache(`groom:${groomId}`);
  },

  /**
   * Invalidate all leaderboard caches
   */
  async leaderboards() {
    return await invalidateCachePattern('leaderboard:*');
  },

  /**
   * Invalidate all competition-related caches
   */
  async competitions() {
    return await invalidateCachePattern('competition:*');
  },

  /**
   * Invalidate specific competition cache
   */
  async competition(competitionId) {
    return await invalidateCache(`competition:${competitionId}`);
  },

  /**
   * Invalidate all user-related caches
   */
  async users() {
    return await invalidateCachePattern('user:*');
  },

  /**
   * Invalidate specific user cache
   */
  async user(userId) {
    return await invalidateCache(`user:${userId}`);
  },
};

// Default export
export default {
  generateCacheKey,
  getCachedQuery,
  invalidateCache,
  invalidateCachePattern,
  invalidateCacheMultiple,
  clearAllCache,
  getCacheStatistics,
  resetCacheStatistics,
  closeRedisConnection,
  cacheInvalidation,
  cacheStats,
  // Equoria-1tu03: CACHE_REQUIRE_REDIS observability gate (pure helpers + warn)
  cacheRedisIntentionallyDisabled,
  cacheRequiresRedis,
  shouldWarnCacheWithoutRedis,
  maybeWarnCacheWithoutRedis,
};
