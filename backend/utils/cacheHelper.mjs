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
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

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
};
