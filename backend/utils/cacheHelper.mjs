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

// Redis client singleton
let redisClient = null;
let isRedisAvailable = false;

// Cache statistics
export const cacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  invalidations: 0,
  totalKeys: 0,
  lastUpdate: new Date(),
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
    logger.info('[cacheHelper] Redis disabled in test environment');
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
    redisClient.on('error', (error) => {
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
    return redisClient;
  } catch (error) {
    logger.warn('[cacheHelper] Redis initialization failed, caching disabled:', error.message);
    isRedisAvailable = false;
    redisClient = null;
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
 *
 * @param {string} cacheKey - Cache key
 * @param {Function} queryFn - Async function that executes the query
 * @param {number} ttl - Time to live in seconds (default: 60)
 * @returns {Promise<any>} Query result (from cache or fresh)
 *
 * @example
 * const horses = await getCachedQuery(
 *   'horses:marketplace:page1:limit20',
 *   () => prisma.horse.findMany({ where: { forSale: true }, take: 20 }),
 *   120 // 2 minutes
 * );
 */
export async function getCachedQuery(cacheKey, queryFn, ttl = 60) {
  const redis = await initializeRedis();

  // If Redis unavailable, just execute query
  if (!redis || !isRedisAvailable) {
    cacheStats.misses++;
    logger.debug(`[cacheHelper] Cache bypassed (Redis unavailable): ${cacheKey}`);
    return await queryFn();
  }

  // Try to get from cache
  try {
    const cached = await redis.get(cacheKey);

    if (cached) {
      cacheStats.hits++;
      cacheStats.lastUpdate = new Date();
      logger.debug(`[cacheHelper] Cache HIT: ${cacheKey}`);

      try {
        return JSON.parse(cached);
      } catch (parseError) {
        logger.warn(`[cacheHelper] Cache parse error for key ${cacheKey}:`, parseError.message);
        // Fall through to re-fetch
      }
    }
  } catch (error) {
    logger.error(`[cacheHelper] Cache read failed for ${cacheKey}:`, error.message);
    cacheStats.errors++;
    return await queryFn();
  }

  // Cache miss - execute query
  cacheStats.misses++;
  logger.debug(`[cacheHelper] Cache MISS: ${cacheKey}`);

  const result = await queryFn();

  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(result));
    logger.debug(`[cacheHelper] Cached result for ${cacheKey} (TTL: ${ttl}s)`);
  } catch (cacheError) {
    logger.warn(`[cacheHelper] Failed to cache result for ${cacheKey}:`, cacheError.message);
    cacheStats.errors++;
  }

  return result;
}

/**
 * Invalidate cache by exact key
 * @param {string} cacheKey - Cache key to invalidate
 * @returns {Promise<number>} Number of keys deleted
 */
export async function invalidateCache(cacheKey) {
  const redis = await initializeRedis();

  if (!redis || !isRedisAvailable) {
    logger.debug(`[cacheHelper] Cache invalidation skipped (Redis unavailable): ${cacheKey}`);
    return 0;
  }

  try {
    const deleted = await redis.del(cacheKey);
    cacheStats.invalidations++;
    logger.debug(`[cacheHelper] Invalidated cache: ${cacheKey} (${deleted} keys)`);
    return deleted;
  } catch (error) {
    logger.error(`[cacheHelper] Cache invalidation failed for ${cacheKey}:`, error.message);
    cacheStats.errors++;
    return 0;
  }
}

/**
 * Invalidate cache by pattern (e.g., 'horses:*')
 * @param {string} pattern - Key pattern with wildcards
 * @returns {Promise<number>} Number of keys deleted
 */
export async function invalidateCachePattern(pattern) {
  const redis = await initializeRedis();

  if (!redis || !isRedisAvailable) {
    logger.debug(`[cacheHelper] Pattern invalidation skipped (Redis unavailable): ${pattern}`);
    return 0;
  }

  try {
    // Find all keys matching pattern
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      logger.debug(`[cacheHelper] No keys found for pattern: ${pattern}`);
      return 0;
    }

    // Delete all matching keys
    const deleted = await redis.del(...keys);
    cacheStats.invalidations += deleted;
    logger.info(`[cacheHelper] Invalidated ${deleted} cache keys matching pattern: ${pattern}`);
    return deleted;
  } catch (error) {
    logger.error(`[cacheHelper] Pattern invalidation failed for ${pattern}:`, error.message);
    cacheStats.errors++;
    return 0;
  }
}

/**
 * Invalidate multiple specific cache keys at once
 * @param {string[]} cacheKeys - Array of cache keys to invalidate
 * @returns {Promise<number>} Number of keys deleted
 */
export async function invalidateCacheMultiple(cacheKeys) {
  const redis = await initializeRedis();

  if (!redis || !isRedisAvailable || cacheKeys.length === 0) {
    return 0;
  }

  try {
    const deleted = await redis.del(...cacheKeys);
    cacheStats.invalidations += deleted;
    logger.debug(`[cacheHelper] Invalidated ${deleted} cache keys`);
    return deleted;
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

  if (!redis || !isRedisAvailable) {
    logger.warn('[cacheHelper] Clear all cache skipped (Redis unavailable)');
    return false;
  }

  try {
    await redis.flushdb();
    cacheStats.invalidations++;
    logger.warn('[cacheHelper] Cleared ALL cache keys');
    return true;
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

  if (redis && isRedisAvailable) {
    try {
      const info = await redis.info('stats');
      const memory = await redis.info('memory');
      const keyspace = await redis.info('keyspace');

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
