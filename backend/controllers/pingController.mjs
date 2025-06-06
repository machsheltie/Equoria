/**
 * Ping Controller
 * Handles ping requests for health checks
 */
import logger from '../utils/logger.mjs';
import prisma from '../db/index.mjs';

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
    const dbDuration = Date.now() - dbStart;

    health.services.database = {
      status: 'healthy',
      responseTime: `${dbDuration}ms`,
    };

    logger.info('[health] Health check passed', {
      duration: `${Date.now() - startTime}ms`,
      dbResponseTime: `${dbDuration}ms`,
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
