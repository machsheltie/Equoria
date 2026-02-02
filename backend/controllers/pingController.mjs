/**
 * Ping Controller
 * Handles ping requests for health checks
 */
import logger from '../utils/logger.mjs';
import prisma from '../db/index.mjs';
import { getCacheStatistics } from '../utils/cacheHelper.mjs';

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
 * Comprehensive health check including database connectivity
 */
export const handleHealthCheck = async (req, res) => {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    services: {},
  };

  try {
    // Test database connectivity
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
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
      circuitState: cacheStats.circuitBreaker?.circuitState || 'N/A',
    };

    // If Redis circuit is open, mark overall health as degraded but still return 200
    if (cacheStats.circuitBreaker?.circuitState === 'OPEN') {
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
    health.services.database = {
      status: 'unhealthy',
      error: error.message,
    };

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

/**
 * Redis Health Check Controller
 * Detailed health check for Redis cache and circuit breaker
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
    } else if (cacheStats.circuitBreaker?.circuitState === 'OPEN') {
      status = 'degraded';
      httpStatus = 503;
    } else if (cacheStats.circuitBreaker?.circuitState === 'HALF_OPEN') {
      status = 'recovering';
      httpStatus = 200;
    }

    logger.info('[health] Redis health check', {
      status,
      circuitState: cacheStats.circuitBreaker?.circuitState || 'N/A',
      redisAvailable: cacheStats.redisAvailable,
    });

    res.status(httpStatus).json({
      success: status === 'healthy' || status === 'recovering',
      data: {
        status,
        timestamp: new Date().toISOString(),
        redis: {
          available: cacheStats.redisAvailable,
          connected: cacheStats.redisConnected,
          circuitBreaker: cacheStats.circuitBreaker || {
            status: 'not_initialized',
            message: 'Circuit breaker not available (likely test environment)',
          },
        },
        cache: {
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          hitRate: `${(cacheStats.hitRate * 100).toFixed(2)}%`,
          errors: cacheStats.errors,
          invalidations: cacheStats.invalidations,
          localHits: cacheStats.localHits,
          localMisses: cacheStats.localMisses,
        },
        redisInfo: cacheStats.redis || null,
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
        error: error.message,
      },
      message: 'Redis health check failed',
    });
  }
};
