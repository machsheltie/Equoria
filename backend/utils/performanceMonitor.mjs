/**
 * Performance Monitor Utility
 *
 * Provides a GET /api/performance/metrics endpoint that exposes:
 * - Cache statistics (from cacheHelper)
 * - System metrics (uptime, memory)
 * - Node.js process information
 *
 * This file is intentionally infrastructure-only — no game logic.
 */

import express from 'express';
import { getCacheStatistics } from './cacheHelper.mjs';
import logger from './logger.mjs';

const router = express.Router();

/**
 * GET /metrics
 * Returns cache stats, system uptime, and memory usage.
 * Mounted at /api/v1/performance so full path is /api/v1/performance/metrics.
 *
 * ADMIN-ONLY (Equoria-xfqy4): this payload (process uptime, node version,
 * platform, arch, PID, memory usage, cache stats) is operational/reconnaissance
 * data, not a player feature or a liveness probe. The mount in app.mjs gates
 * the whole router behind authenticateToken + requireRole('admin'). The router
 * itself does NOT re-check auth (the mount owns the gate) — when mounting this
 * router anywhere else, mount it behind the same gate. Public lightweight
 * health/readiness signals live separately at /health and /ready.
 */
router.get('/metrics', async (req, res) => {
  try {
    const cacheStats = await getCacheStatistics();

    const memUsage = process.memoryUsage();

    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      },
      memory: {
        heapUsedMb: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
        externalMb: Math.round((memUsage.external / 1024 / 1024) * 100) / 100,
      },
      cache: cacheStats,
    };

    logger.debug('[performanceMonitor] GET /metrics — metrics collected');

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error(`[performanceMonitor] GET /metrics error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to collect performance metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error',
    });
  }
});

export default router;
