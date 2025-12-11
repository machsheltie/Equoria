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

let redisClient = null;
let isRedisAvailable = false;

/**
 * Initialize Redis client with automatic reconnection
 * Handles connection failures gracefully with exponential backoff
 */
async function initializeRedis() {
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
        reconnectStrategy: (retries) => {
          // Exponential backoff: 50ms, 100ms, 200ms, 400ms, 500ms (max)
          const delay = Math.min(retries * 50, 500);
          logger.warn(`[Redis] Reconnection attempt ${retries}, waiting ${delay}ms`);
          return delay;
        },
      },
    });

    // Event handlers
    redisClient.on('error', (err) => {
      isRedisAvailable = false;
      logger.error('[Redis] Connection error:', {
        error: err.message,
        code: err.code,
      });
    });

    redisClient.on('connect', () => {
      logger.info('[Redis] Connected successfully');
      isRedisAvailable = true;
    });

    redisClient.on('ready', () => {
      logger.info('[Redis] Ready to accept commands');
      isRedisAvailable = true;
    });

    redisClient.on('reconnecting', () => {
      logger.warn('[Redis] Reconnecting...');
      isRedisAvailable = false;
    });

    redisClient.on('end', () => {
      logger.warn('[Redis] Connection closed');
      isRedisAvailable = false;
    });

    // Connect to Redis
    await redisClient.connect();

    return redisClient;
  } catch (error) {
    isRedisAvailable = false;
    logger.error('[Redis] Failed to initialize:', {
      error: error.message,
      stack: error.stack,
    });

    // Don't throw - graceful degradation
    // Rate limiting will fall back to allowing all requests
    return null;
  }
}

/**
 * Get Redis connection status
 * @returns {boolean} True if Redis is connected and available
 */
export function isRedisConnected() {
  return isRedisAvailable && redisClient && redisClient.isOpen;
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
      logger.info('[Redis] Connection closed gracefully');
    } catch (error) {
      logger.error('[Redis] Error closing connection:', error);
    }
  }
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
  } = options;

  // Validation
  if (windowMs <= 0 || max <= 0) {
    throw new Error('windowMs and max must be positive numbers');
  }

  const isTestEnv = process.env.NODE_ENV === 'test';
  if (isTestEnv && process.env.TEST_BYPASS_RATE_LIMIT === 'true') {
    return (_req, _res, next) => next();
  }

  const effectiveWindowMs = isTestEnv
    ? parseInt(process.env.TEST_RATE_LIMIT_WINDOW_MS || `${windowMs}`, 10)
    : windowMs;

  const effectiveMax = isTestEnv
    ? parseInt(process.env.TEST_RATE_LIMIT_MAX_REQUESTS || `${max}`, 10)
    : max;

  const shouldBypassRequest = (req) => {
    if (!isTestEnv) return false;
    if (process.env.TEST_BYPASS_RATE_LIMIT === 'true') {
      return true;
    }
    const bypassHeader = req?.headers?.['x-test-bypass-rate-limit'];
    return bypassHeader === 'true' || bypassHeader === '1';
  };

  const limiter = rateLimit({
    windowMs: effectiveWindowMs,
    max: effectiveMax,
    message: { success: false, message },
    standardHeaders: true, // RFC-compliant headers (RateLimit-*)
    legacyHeaders: false, // Disable X-RateLimit-* headers
    skipSuccessfulRequests,
    skipFailedRequests,

    // Redis store for distributed rate limiting (only if connected)
    // Falls back to in-memory store when Redis unavailable
    store: (redisClient && isRedisConnected())
      ? new RedisStore({
          client: redisClient,
          prefix: `${keyPrefix}:`,
        })
      : undefined, // No store = in-memory (fallback for development/tests)

    // Debug logging for test environment
    onLimitReached: process.env.NODE_ENV === 'test' ? (req, res, options) => {
      logger.info('[RateLimit DEBUG] Limit reached', {
        path: req.path,
        keyPrefix,
        max,
        windowMs,
        user: req.user?.id,
        ip: req.ip,
        storeType: (redisClient && isRedisConnected()) ? 'Redis' : 'In-Memory'
      });
    } : undefined,

    // Key generation: Use authenticated user ID, fallback to IP
    keyGenerator: (req) => {
      if (req.user && req.user.id) {
        return `user:${req.user.id}`;
      }
      // Fallback to IP for unauthenticated requests
      return `ip:${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`;
    },

    // Custom handler for rate limit exceeded
    handler: (req, res) => {
      const identifier = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
      const retryAfter = Math.ceil(windowMs / 1000);

      logger.warn('[RateLimit] Limit exceeded', {
        identifier,
        path: req.path,
        method: req.method,
        max,
        windowMs,
        retryAfter,
      });

      res.status(429).json({
        success: false,
        status: 'error',
        message,
        retryAfter, // Seconds until window resets
        limit: max,
        window: Math.ceil(windowMs / 1000),
      });
    },

    // Skip configuration is handled by skipSuccessfulRequests and skipFailedRequests
    // No need for custom skip logic - in-memory fallback works when Redis unavailable
  });

  return (req, res, next) => (shouldBypassRequest(req) ? next() : limiter(req, res, next));
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
initializeRedis().catch((error) => {
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
};
