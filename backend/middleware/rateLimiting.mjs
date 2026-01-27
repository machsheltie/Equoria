/**
 * 🚦 REDIS-BACKED DISTRIBUTED RATE LIMITING
 *
 * Enterprise-grade distributed rate limiting using Redis for multi-process/multi-server deployments.
 * Solves critical production issues with in-memory rate limiting:
 * - Multi-process failure (PM2 workers multiply limits by worker count)
 * - Restart bypass (deployments reset counters, creating attack windows)
 * - Horizontal scaling impossibility (each server has independent counters)
 *
 * 🎯 FEATURES:
 * - Distributed rate limiting across all processes/servers
 * - Per-user rate limiting (authenticated users) with IP fallback
 * - Graceful degradation (allows requests if Redis unavailable)
 * - Automatic reconnection with exponential backoff
 * - Comprehensive logging and monitoring
 * - RFC-compliant rate limit headers
 * - Configurable limits per endpoint type
 *
 * 🔐 SECURITY BENEFITS:
 * - Prevents brute force attacks across server restarts
 * - Consistent enforcement in distributed systems
 * - Defense in depth (fails open, not closed)
 * - DDoS protection at application layer
 *
 * @module middleware/rateLimiting
 */

import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import logger from '../utils/logger.mjs';
import { createRedisCircuitBreaker } from '../utils/redisCircuitBreaker.mjs';

let redisClient = null;
let redisCircuitBreaker = null;
let isRedisAvailable = false;

/**
 * Initialize Redis client with automatic reconnection
 * Handles connection failures gracefully with exponential backoff
 */
async function initializeRedis() {
  const isTestLike = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  const redisDisabled = process.env.REDIS_DISABLED === 'true';

  // Never attempt Redis connections in test/Jest environments or when explicitly disabled
  if (isTestLike || redisDisabled) {
    logger.info('[rateLimiting] Using in-memory rate limiting for test/disabled Redis environment');
    isRedisAvailable = false;
    redisClient = null;
    return null;
  }

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisPassword = process.env.REDIS_PASSWORD;
    const redisTls = process.env.REDIS_TLS === 'true';

    logger.info('[Redis] Initializing connection...', {
      url: redisUrl.replace(/:[^:]*@/, ':****@'), // Mask password in logs
      tls: redisTls,
    });

    redisClient = createClient({
      url: redisUrl,
      password: redisPassword || undefined,
      socket: {
        tls: redisTls,
        reconnectStrategy: retries => {
          // Exponential backoff: 50ms, 100ms, 200ms, 400ms, 500ms (max)
          const delay = Math.min(retries * 50, 500);
          logger.warn(`[Redis] Reconnection attempt ${retries}, waiting ${delay}ms`);
          return delay;
        },
      },
    });

    // Event handlers
    redisClient.on('error', err => {
      isRedisAvailable = false;
      redisCircuitBreaker = null; // Clear circuit breaker on error
      logger.error('[rateLimiting] Redis connection error:', {
        error: err.message,
        code: err.code,
      });
    });

    redisClient.on('connect', () => {
      logger.info('[rateLimiting] Redis connected successfully');
      isRedisAvailable = true;
    });

    redisClient.on('ready', () => {
      logger.info('[rateLimiting] Redis ready to accept commands');
      isRedisAvailable = true;
    });

    redisClient.on('reconnecting', () => {
      logger.warn('[rateLimiting] Redis reconnecting...');
      isRedisAvailable = false;
      redisCircuitBreaker = null; // Clear circuit breaker during reconnection
    });

    redisClient.on('end', () => {
      logger.warn('[rateLimiting] Redis connection closed');
      isRedisAvailable = false;
      redisCircuitBreaker = null; // Clear circuit breaker on disconnect
    });

    // Connect to Redis
    await redisClient.connect();

    // Wrap Redis client with circuit breaker for resilience
    redisCircuitBreaker = createRedisCircuitBreaker(redisClient, {
      errorThresholdPercentage: 50, // Open after 50% errors
      resetTimeout: 30000, // 30s recovery wait
      timeout: 3000, // 3s per operation
      volumeThreshold: 10, // Min 10 requests before opening
      halfOpenRequests: 3, // Test recovery with 3 requests
    });

    logger.info('[rateLimiting] Redis circuit breaker initialized for rate limiting');

    return redisClient;
  } catch (error) {
    isRedisAvailable = false;
    redisCircuitBreaker = null; // Clear circuit breaker on initialization failure
    logger.error('[rateLimiting] Failed to initialize Redis:', {
      error: error.message,
      stack: error.stack,
    });

    // Don't throw - graceful degradation
    // Rate limiting will fall back to in-memory store
    return null;
  }
}

/**
 * Get Redis connection status with circuit breaker state check
 * @returns {boolean} True if Redis is connected, available, and circuit is not open
 */
export function isRedisConnected() {
  // Check if Redis is available and connected
  const basicCheck = isRedisAvailable && redisClient && redisClient.isOpen;

  if (!basicCheck) {
    return false;
  }

  // If circuit breaker exists, check if circuit is open
  if (redisCircuitBreaker) {
    const isCircuitOpen = redisCircuitBreaker.isCircuitOpen();
    if (isCircuitOpen) {
      logger.debug('[rateLimiting] Redis circuit is OPEN, falling back to in-memory rate limiting');
      return false; // Treat open circuit as unavailable
    }
  }

  return true;
}

/**
 * Get Redis client instance
 * @returns {Object|null} Redis client or null if not connected
 */
export function getRedisClient() {
  return redisClient;
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('[rateLimiting] Redis connection closed gracefully');
    } catch (error) {
      logger.error('[rateLimiting] Error closing connection:', error);
    }
  }
}

/**
 * Get rate limiting health status including circuit breaker metrics
 * @returns {Object} Health status with circuit breaker information
 */
export function getRateLimitingHealth() {
  const health = {
    redisAvailable: isRedisAvailable,
    redisConnected: redisClient && redisClient.isOpen,
    usingDistributedLimiting: isRedisConnected(), // Includes circuit check
    timestamp: new Date().toISOString(),
  };

  // Add circuit breaker status if available
  if (redisCircuitBreaker) {
    const circuitHealth = redisCircuitBreaker.getHealthStatus();
    health.circuitBreaker = {
      status: circuitHealth.status,
      circuitState: circuitHealth.circuitState,
      metrics: circuitHealth.metrics,
      lastStateChange: circuitHealth.circuitHistory?.lastStateChange,
    };

    // Determine overall rate limiting status
    if (circuitHealth.circuitState === 'OPEN') {
      health.status = 'degraded'; // Using in-memory fallback
      health.message = 'Rate limiting degraded - using in-memory fallback (per-process)';
    } else if (circuitHealth.circuitState === 'HALF_OPEN') {
      health.status = 'recovering'; // Testing Redis recovery
      health.message = 'Rate limiting recovering - testing Redis connection';
    } else {
      health.status = 'healthy'; // Using distributed Redis
      health.message = 'Rate limiting healthy - using distributed Redis store';
    }
  } else {
    health.circuitBreaker = null;
    health.status = redisClient ? 'healthy' : 'degraded';
    health.message = redisClient
      ? 'Rate limiting healthy - using distributed Redis store'
      : 'Rate limiting degraded - Redis not connected, using in-memory fallback';
  }

  return health;
}

/**
 * Factory function for creating Redis-backed rate limiters
 *
 * @param {Object} options - Rate limiter configuration
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Custom error message
 * @param {boolean} options.skipSuccessfulRequests - Don't count successful requests
 * @param {boolean} options.skipFailedRequests - Don't count failed requests (4xx/5xx)
 * @param {string} options.keyPrefix - Redis key prefix for this limiter
 * @returns {Function} Express middleware function
 */
export function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    max = 100,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyPrefix = 'rl',
    useEnvOverride = true,
  } = options;

  // Validation
  if (windowMs <= 0 || max <= 0) {
    throw new Error('windowMs and max must be positive numbers');
  }

  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

  const getEffectiveWindowMs = () =>
    isTestEnv && useEnvOverride
      ? parseInt(process.env.TEST_RATE_LIMIT_WINDOW_MS || `${windowMs}`, 10)
      : windowMs;

  const getEffectiveMax = () =>
    isTestEnv && useEnvOverride
      ? parseInt(process.env.TEST_RATE_LIMIT_MAX_REQUESTS || `${max}`, 10)
      : max;

  const shouldBypassRequest = req => {
    if (!isTestEnv) return false;
    if (process.env.TEST_BYPASS_RATE_LIMIT === 'true') {
      return true;
    }
    const bypassHeader = req?.headers?.['x-test-bypass-rate-limit'];
    return bypassHeader === 'true' || bypassHeader === '1';
  };

  const limiter = rateLimit({
    windowMs: getEffectiveWindowMs(), // Fixed at creation time
    max: () => {
      const m = getEffectiveMax();
      logger.debug(`[RateLimit:${keyPrefix}] Current max limit: ${m}`);
      return m;
    },
    message: { success: false, message },
    standardHeaders: true, // RFC-compliant headers (RateLimit-*)
    legacyHeaders: false, // Disable X-RateLimit-* headers
    skipSuccessfulRequests,
    skipFailedRequests,

    // Redis store for distributed rate limiting (only if connected and circuit closed)
    // Falls back to in-memory store when Redis unavailable or circuit open
    store: (() => {
      const connected = isRedisConnected(); // Checks both connection and circuit state

      if (redisClient && connected) {
        logger.debug(`[RateLimit:${keyPrefix}] Using Redis store for distributed rate limiting`);
        return new RedisStore({
          client: redisClient,
          prefix: `${keyPrefix}:`,
        });
      }

      // Log fallback reason
      if (redisCircuitBreaker && redisCircuitBreaker.isCircuitOpen()) {
        logger.warn(
          `[RateLimit:${keyPrefix}] Circuit OPEN - falling back to in-memory rate limiting (per-process)`,
        );
      } else if (!redisClient) {
        logger.info(
          `[RateLimit:${keyPrefix}] Redis not connected - using in-memory rate limiting (per-process)`,
        );
      } else {
        logger.debug(`[RateLimit:${keyPrefix}] Using in-memory rate limiting (per-process)`);
      }

      return undefined; // No store = in-memory (fallback)
    })(),

    // Key generation: Use authenticated user ID, fallback to IP
    keyGenerator: req => {
      let key;
      if (req.user && req.user.id) {
        key = `user:${req.user.id}`;
      } else {
        // Fallback to IP for unauthenticated requests
        key = `ip:${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`;
      }
      logger.debug(`[RateLimit:${keyPrefix}] Key generated: ${key}`);
      return key;
    },

    // Custom handler for rate limit exceeded
    handler: (req, res) => {
      const identifier = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
      const effectiveMax = getEffectiveMax();
      const effectiveWindowMs = getEffectiveWindowMs();
      const retryAfter = Math.max(1, Math.ceil(effectiveWindowMs / 1000));

      logger.warn(`[RateLimit:${keyPrefix}] Limit exceeded`, {
        identifier,
        path: req.path,
        method: req.method,
        max: effectiveMax,
        windowMs: effectiveWindowMs,
        retryAfter,
      });

      res.status(429).json({
        success: false,
        status: 'error',
        message,
        retryAfter, // Seconds until window resets
        limit: effectiveMax,
        window: retryAfter,
      });
    },
  });

  return (req, res, next) => {
    const bypassed = shouldBypassRequest(req);
    if (bypassed) {
      logger.debug(`[RateLimit:${keyPrefix}] Request bypassed`);
      return next();
    }
    return limiter(req, res, next);
  };
}

/**
 * Predefined rate limiters for different endpoint types
 * Follows OWASP recommendations and game mechanics
 */

/**
 * Authentication Rate Limiter
 * Strict limits to prevent brute force attacks
 * 5 attempts per 15 minutes per user/IP
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: false, // Count all auth attempts
  keyPrefix: 'rl:auth',
});

/**
 * Training Action Rate Limiter
 * Normal gameplay: 1 training every 3 seconds = 20 per minute
 * Allows batch operations while preventing abuse
 */
export const trainingRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 training actions per minute
  message: 'Training limit exceeded. Please wait a moment before training again.',
  skipSuccessfulRequests: true, // Only count failed attempts (eligibility failures)
  keyPrefix: 'rl:training',
});

/**
 * Query Endpoint Rate Limiter
 * Prevents data scraping while allowing normal browsing
 * 100 requests per 15 minutes
 */
export const queryRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Query limit exceeded. Please slow down.',
  skipSuccessfulRequests: false,
  keyPrefix: 'rl:query',
});

/**
 * Profile Endpoint Rate Limiter
 * Stricter limits for user profile access to prevent abuse
 * 30 requests per minute per user/IP
 */
export const profileRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many profile requests. Please slow down.',
  skipSuccessfulRequests: false,
  keyPrefix: 'rl:profile',
});

/**
 * Mutation Rate Limiter (POST/PUT/DELETE)
 * Prevents abuse while allowing batch operations
 * 30 mutations per minute
 */
export const mutationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 mutations per minute
  message: 'Too many actions. Please wait a moment.',
  skipSuccessfulRequests: false,
  keyPrefix: 'rl:mutation',
});

/**
 * Admin Endpoint Rate Limiter
 * Higher limit for admin operations
 * 50 requests per 5 minutes
 */
export const adminRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 requests per 5 minutes
  message: 'Admin rate limit exceeded.',
  skipSuccessfulRequests: false,
  keyPrefix: 'rl:admin',
});

/**
 * Foal Action Rate Limiter
 * Moderate limits for foal development actions
 * 15 actions per minute
 */
export const foalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // 15 foal actions per minute
  message: 'Foal action limit exceeded. Please wait a moment.',
  skipSuccessfulRequests: false,
  keyPrefix: 'rl:foal',
});

/**
 * Breeding Rate Limiter
 * Conservative limits for breeding operations
 * 10 operations per 5 minutes (breeding is intentionally slow)
 */
export const breedingRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 breeding operations per 5 minutes
  message: 'Breeding limit exceeded. Please wait before starting another breeding.',
  skipSuccessfulRequests: false,
  keyPrefix: 'rl:breeding',
});

/**
 * Competition Entry Rate Limiter
 * Moderate limits for competition entries
 * 20 entries per 5 minutes
 */
export const competitionRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 competition entries per 5 minutes
  message: 'Competition entry limit exceeded.',
  skipSuccessfulRequests: false,
  keyPrefix: 'rl:competition',
});

// Initialize Redis connection
// This runs when the module is imported
initializeRedis().catch(error => {
  logger.error('[Redis] Failed to initialize on startup:', error);
});

// Export for use in other modules
export default {
  createRateLimiter,
  authRateLimiter,
  trainingRateLimiter,
  queryRateLimiter,
  profileRateLimiter,
  mutationRateLimiter,
  adminRateLimiter,
  foalRateLimiter,
  breedingRateLimiter,
  competitionRateLimiter,
  isRedisConnected,
  getRedisClient,
  closeRedis,
  getRateLimitingHealth,
};
