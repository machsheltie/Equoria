/**
 * Authentication Rate Limiter Middleware
 *
 * MIGRATED TO REDIS-BACKED DISTRIBUTED RATE LIMITING
 *
 * This file now re-exports the Redis-backed auth rate limiter from rateLimiting.mjs
 * for backward compatibility with existing imports.
 *
 * Benefits of Redis-backed rate limiting:
 * - Works correctly in multi-process environments (PM2 workers)
 * - Survives server restarts (no attack window during deployments)
 * - Scales horizontally (multiple servers share same counters)
 * - Graceful degradation (allows requests if Redis unavailable)
 *
 * Configuration:
 * - 5 failed attempts per 15 minutes per IP/user
 * - Rate limit headers in all responses (RFC standard)
 * - Per-user rate limiting for authenticated requests
 * - IP-based rate limiting for unauthenticated requests
 *
 * @see backend/middleware/rateLimiting.mjs for implementation details
 */

import {
  authRateLimiter,
  isRedisConnected,
  getRedisClient,
} from './rateLimiting.mjs';
import logger from '../utils/logger.mjs';

/**
 * Redis-backed authentication rate limiter
 * Prevents brute force attacks with distributed enforcement
 */
export { authRateLimiter };

/**
 * Check Redis connection status
 * @returns {boolean} True if Redis is connected
 */
export { isRedisConnected };

/**
 * Get Redis client instance (for health checks)
 * @returns {Object|null} Redis client or null
 */
export { getRedisClient };

/**
 * Legacy function: Create authentication rate limiter
 * Now returns Redis-backed limiter instead of in-memory store
 *
 * @deprecated Use authRateLimiter directly from rateLimiting.mjs
 * @param {Object} options - Configuration options (ignored, uses Redis config)
 * @returns {Function} Redis-backed rate limiter middleware
 */
export function createAuthRateLimiter(options = {}) {
  logger.warn(
    '[AuthRateLimiter] createAuthRateLimiter() is deprecated, using Redis-backed limiter'
  );
  return authRateLimiter;
}

/**
 * Legacy function: Reset rate limit for specific IP
 * With Redis, this requires direct Redis commands
 *
 * @deprecated Not needed with Redis (automatic expiration)
 * @param {string} ip - IP address to reset
 */
export function resetAuthRateLimit(ip) {
  logger.warn(
    '[AuthRateLimiter] resetAuthRateLimit() is deprecated with Redis',
    { ip }
  );
  // Redis keys auto-expire, no manual reset needed
}

/**
 * Legacy function: Reset all rate limits
 * With Redis, use Redis FLUSHDB command or let keys expire naturally
 *
 * @deprecated Not needed with Redis (automatic expiration)
 */
export function resetAllAuthRateLimits() {
  logger.warn('[AuthRateLimiter] resetAllAuthRateLimits() is deprecated with Redis');
  // Redis keys auto-expire, no manual reset needed
}

/**
 * Legacy function: Get store instance
 * With Redis, use getRedisClient() instead
 *
 * @deprecated Use getRedisClient() from rateLimiting.mjs
 * @returns {null} Always returns null (no in-memory store)
 */
export function getAuthRateLimitStore() {
  logger.warn('[AuthRateLimiter] getAuthRateLimitStore() is deprecated, use getRedisClient()');
  return null;
}

// Default export for backward compatibility
export default authRateLimiter;
