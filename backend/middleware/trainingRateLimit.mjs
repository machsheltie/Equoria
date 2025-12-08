/**
 * Training Rate Limiter Middleware
 *
 * MIGRATED TO REDIS-BACKED DISTRIBUTED RATE LIMITING
 *
 * This file now re-exports the Redis-backed training rate limiter from rateLimiting.mjs
 * for backward compatibility with existing imports.
 *
 * Benefits of Redis-backed rate limiting:
 * - Works correctly in multi-process environments (PM2 workers)
 * - Survives server restarts (no attack window during deployments)
 * - Scales horizontally (multiple servers share same counters)
 * - Graceful degradation (allows requests if Redis unavailable)
 *
 * Configuration:
 * - 20 training actions per minute per user
 * - Only counts failed training attempts (skipSuccessfulRequests: true)
 * - Per-user rate limiting (not per-IP)
 * - Normal gameplay: 1 training every 3 seconds = 20 per minute
 *
 * @see backend/middleware/rateLimiting.mjs for implementation details
 */

import { trainingRateLimiter } from './rateLimiting.mjs';

/**
 * Redis-backed training rate limiter
 * Prevents training spam while allowing normal gameplay
 */
export { trainingRateLimiter };

// Default export for backward compatibility
// Many routes use: import trainingLimiter from './middleware/trainingRateLimit.mjs'
export const trainingLimiter = trainingRateLimiter;

export default trainingRateLimiter;
