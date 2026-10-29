/**
 * Ping Controller
 * Handles ping requests for health checks
 */
import logger from '../../../utils/logger.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { getCacheStatistics } from '../../../utils/cacheHelper.mjs';

export const handlePing = (req, res) => {
  const { name } = req.query;
  const message = name ? `pong, ${name}!` : 'pong';

  res.json({
    success: true,
    message,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Health Check Controller
 * Health check including database connectivity, on the public router.
 *
 * Anonymous callers get statuses only: no environment, version, error text or
 * cache internals (Equoria-xxu52, owner ruling 2026-10-22; same contract as
 * /health and /ready in Equoria-ht7qz). Detail stays in the server log. The DB
 * client is a parameter so the unreachable branch is tested with a real client.
 */
export const createHealthCheckHandler =
  ({ db }) =>
  async (req, res) => {
    const startTime = Date.now();
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {},
    };

    try {
      // Test database connectivity
      const dbStart = Date.now();
      await db.$queryRaw`SELECT 1`;
      const dbDuration = Math.max(1, Date.now() - dbStart);

      health.services.database = {
        status: 'healthy',
        responseTime: `${dbDuration}ms`,
      };

      // Include Redis circuit breaker status
      const cacheStats = await getCacheStatistics();
      health.services.redis = {
        available: cacheStats.redisAvailable,
        status: cacheStats.redisAvailable ? 'healthy' : 'unavailable',
      };

      // If Redis circuit is open, mark overall health as degraded but still return 200
      if (cacheStats.circuitBreaker?.circuitState === 'open') {
        health.status = 'degraded';
        health.services.redis.status = 'degraded';
      }

      logger.info('[health] Health check passed', {
        duration: `${Date.now() - startTime}ms`,
        dbResponseTime: `${dbDuration}ms`,
        redisAvailable: cacheStats.redisAvailable,
        circuitState: cacheStats.circuitBreaker?.circuitState || 'N/A',
      });

      res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      health.status = 'unhealthy';
      // The driver message can name host:port — log it, never send it.
      health.services.database = { status: 'unhealthy' };

      logger.error('[health] Health check failed', {
        error: error.message,
        duration: `${Date.now() - startTime}ms`,
      });

      res.status(503).json({
        success: false,
        data: health,
        message: 'Service unhealthy',
      });
    }
  };

export const handleHealthCheck = createHealthCheckHandler({ db: prisma });

/**
 * Redis Health Check Controller
 * Redis availability and circuit-derived status, on the public router.
 *
 * Anonymous callers get `{ status, timestamp, redis: { available, connected } }`
 * only: circuit-breaker metrics, cache hit/miss/error counters, Redis server
 * info and error text stay in the server log (Equoria-xxu52, owner ruling
 * 2026-10-22).
 */
export const handleRedisHealthCheck = async (req, res) => {
  try {
    const cacheStats = await getCacheStatistics();

    // Determine overall Redis health status
    let status = 'healthy';
    let httpStatus = 200;

    if (!cacheStats.redisAvailable) {
      status = 'unavailable';
      httpStatus = 503;
    } else if (cacheStats.circuitBreaker?.circuitState === 'open') {
      status = 'degraded';
      httpStatus = 503;
    } else if (cacheStats.circuitBreaker?.circuitState === 'halfOpen') {
      status = 'recovering';
      httpStatus = 200;
    }

    logger.info('[health] Redis health check', {
      status,
      circuitState: cacheStats.circuitBreaker?.circuitState || 'N/A',
      redisAvailable: cacheStats.redisAvailable,
      cache: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        errors: cacheStats.errors,
      },
    });

    res.status(httpStatus).json({
      success: status === 'healthy' || status === 'recovering',
      data: {
        status,
        timestamp: new Date().toISOString(),
        redis: {
          available: cacheStats.redisAvailable,
          connected: cacheStats.redisConnected,
        },
      },
    });
  } catch (error) {
    logger.error('[health] Redis health check failed', {
      error: error.message,
    });

    res.status(503).json({
      success: false,
      data: {
        status: 'error',
        timestamp: new Date().toISOString(),
      },
      message: 'Redis health check failed',
    });
  }
};
