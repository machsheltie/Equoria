/**
 * Authentication Rate Limiter Middleware
 *
 * Implements brute force protection for authentication endpoints
 * - 5 failed attempts per 15 minutes per IP
 * - Rate limit headers in all responses (RFC standard)
 * - Reset on successful authentication
 *
 * Phase 1, Day 3: Rate Limiting Implementation
 */

import { RateLimitStore } from '../utils/rateLimitStore.mjs';
import logger from '../utils/logger.mjs';

// Create store instance for auth rate limiting
const store = new RateLimitStore({
  maxSize: 10000,
  cleanupInterval: 60000, // 1 minute
});

/**
 * Create authentication rate limiter middleware
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.max - Maximum requests per window (default: 5)
 * @returns {Function} - Express middleware function
 */
export function createAuthRateLimiter(options = {}) {
  // Configuration with defaults
  const windowMs = options.windowMs !== undefined ? options.windowMs : 15 * 60 * 1000; // 15 minutes
  const max = options.max !== undefined ? options.max : 5;

  // Validate configuration
  if (windowMs <= 0) {
    throw new Error('windowMs must be positive');
  }

  if (max <= 0) {
    throw new Error('max must be greater than 0');
  }

  // Return middleware function
  const middleware = function(req, res, next) {
    // Get IP address (support X-Forwarded-For for proxies)
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';

    // Increment request count
    const result = store.increment(ip, windowMs);
    const { current, resetTime } = result;

    // Calculate remaining requests
    const remaining = Math.max(0, max - current);
    const resetTimestamp = Math.floor(resetTime / 1000);

    // Set rate limit headers (RFC standard, not legacy X-RateLimit-*)
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetTimestamp));

    // Check if rate limit exceeded
    if (current > max) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

      logger.warn(`[Rate Limit] IP ${ip} exceeded auth rate limit`, {
        ip,
        current,
        max,
        retryAfter,
        url: req.originalUrl,
      });

      res.setHeader('Retry-After', String(retryAfter));

      return res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later.',
        retryAfter,
      });
    }

    // Within limit, proceed
    next();
  };

  // Attach configuration to middleware for testing
  middleware.windowMs = windowMs;
  middleware.max = max;

  // Attach helper methods for testing
  middleware.getRequestCount = (ip) => store.getRequestCount(ip);
  middleware.resetForIp = (ip) => store.reset(ip);
  middleware.getStorageSize = () => store.getStorageSize();
  middleware.cleanup = () => store.cleanup();

  return middleware;
}

/**
 * Reset rate limit for a specific IP
 * @param {string} ip - IP address to reset
 */
export function resetAuthRateLimit(ip) {
  if (!ip) {
    logger.warn('[Rate Limit] Attempted to reset rate limit with no IP address');
    return;
  }

  store.reset(ip);
  logger.debug(`[Rate Limit] Reset rate limit for IP: ${ip}`);
}

/**
 * Reset all rate limits (for testing)
 */
export function resetAllAuthRateLimits() {
  store.resetAll();
  logger.debug('[Rate Limit] Reset all auth rate limits');
}

/**
 * Get store instance (for testing)
 */
export function getAuthRateLimitStore() {
  return store;
}

// Default auth rate limiter instance
// Test environment uses shorter window for faster tests, but same max (5 attempts)
const isTestEnv = process.env.NODE_ENV === 'test';
const testWindowMs = 2000; // 2 seconds for tests (faster reset)

export const authRateLimiter = createAuthRateLimiter({
  windowMs: isTestEnv ? testWindowMs : 15 * 60 * 1000, // 15 minutes in production, 2s in test
  max: 5, // Always 5 attempts for auth endpoints (brute force protection)
});
