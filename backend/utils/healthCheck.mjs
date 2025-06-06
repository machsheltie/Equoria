import prisma from '../db/index.mjs';
import logger from './logger.mjs';

/**
 * Health Check Utility
 * Provides endpoints and utilities for monitoring system health
 */

export class HealthCheck {
  static async checkDatabase() {
    try {
      // Simple query to test database connectivity
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        message: 'Database connection successful',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  static async checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const totalMemMB = Math.round(memUsage.rss / 1024 / 1024);
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    const isHealthy = totalMemMB < 512; // Alert if using more than 512MB

    return {
      status: isHealthy ? 'healthy' : 'warning',
      message: isHealthy ? 'Memory usage normal' : 'High memory usage detected',
      data: {
        rss: `${totalMemMB}MB`,
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  static getUptime() {
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    return {
      status: 'healthy',
      message: 'Server uptime',
      data: {
        uptime: `${days}d ${hours}h ${minutes}m ${seconds}s`,
        uptimeSeconds: Math.floor(uptimeSeconds),
      },
      timestamp: new Date().toISOString(),
    };
  }

  static async getSystemInfo() {
    return {
      status: 'healthy',
      message: 'System information',
      data: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid,
      },
      timestamp: new Date().toISOString(),
    };
  }

  static async performFullHealthCheck() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkMemoryUsage(),
      Promise.resolve(this.getUptime()),
      Promise.resolve(this.getSystemInfo()),
    ]);

    const results = {
      database:
        checks[0].status === 'fulfilled'
          ? checks[0].value
          : { status: 'error', message: 'Health check failed' },
      memory:
        checks[1].status === 'fulfilled'
          ? checks[1].value
          : { status: 'error', message: 'Memory check failed' },
      uptime:
        checks[2].status === 'fulfilled'
          ? checks[2].value
          : { status: 'error', message: 'Uptime check failed' },
      system:
        checks[3].status === 'fulfilled'
          ? checks[3].value
          : { status: 'error', message: 'System check failed' },
    };

    // Determine overall health
    const hasUnhealthy = Object.values(results).some(
      check => check.status === 'unhealthy' || check.status === 'error',
    );
    const hasWarnings = Object.values(results).some(check => check.status === 'warning');

    let overallStatus = 'healthy';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasWarnings) {
      overallStatus = 'warning';
    }

    return {
      status: overallStatus,
      message: `System health check completed - ${overallStatus}`,
      timestamp: new Date().toISOString(),
      checks: results,
    };
  }
}

/**
 * Express route handler for health checks
 */
export const healthCheckHandler = async (req, res) => {
  try {
    const healthData = await HealthCheck.performFullHealthCheck();

    // Set appropriate HTTP status based on health
    let statusCode = 200;
    if (healthData.status === 'warning') {
      statusCode = 200; // Still OK, but with warnings
    } else if (healthData.status === 'unhealthy') {
      statusCode = 503; // Service Unavailable
    }

    res.status(statusCode).json(healthData);
  } catch (error) {
    logger.error('Health check handler error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Simple liveness probe (for Kubernetes/Docker)
 */
export const livenessHandler = (req, res) => {
  res.status(200).json({
    status: 'alive',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Readiness probe (for Kubernetes/Docker)
 */
export const readinessHandler = async (req, res) => {
  try {
    const dbCheck = await HealthCheck.checkDatabase();

    if (dbCheck.status === 'healthy') {
      res.status(200).json({
        status: 'ready',
        message: 'Server is ready to accept requests',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        message: 'Server is not ready - database unavailable',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not_ready',
      message: 'Server is not ready',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

export default HealthCheck;
