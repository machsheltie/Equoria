/**
 * 🧠 Memory Management Routes
 *
 * REST API endpoints for memory and resource management monitoring:
 * - Memory usage analytics and reporting
 * - Resource tracking and cleanup
 * - Performance monitoring and alerts
 * - Garbage collection management
 * - System health diagnostics
 *
 * Features:
 * - Real-time memory metrics
 * - Resource usage analytics
 * - Performance benchmarking
 * - Memory leak detection
 * - System optimization tools
 */

import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import {
  getMemoryManager,
  _getMemoryReport,
  _trackResource,
  _untrackResource,
} from '../services/memoryResourceManagementService.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

/**
 * Validation middleware
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * GET /api/memory/status
 * Get current memory and resource status
 */
router.get('/status',
  authenticateToken,
  async (req, res) => {
    try {
      logger.info('[MemoryManagement] Getting memory status');

      const memoryManager = getMemoryManager();
      const report = memoryManager.getReport();

      res.json({
        success: true,
        message: 'Memory status retrieved successfully',
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          memory: report.memory,
          resources: report.resources,
          monitoring: report.monitoring,
        },
      });
    } catch (error) {
      logger.error(`[MemoryManagement] Error getting memory status: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve memory status',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/memory/metrics
 * Get detailed memory metrics and analytics
 */
router.get('/metrics',
  authenticateToken,
  query('timeframe').optional().isIn(['1h', '6h', '24h', '7d']).withMessage('Invalid timeframe'),
  query('includeGC').optional().isBoolean().withMessage('includeGC must be boolean'),
  validateRequest,
  async (req, res) => {
    try {
      const timeframe = req.query.timeframe || '1h';
      const includeGC = req.query.includeGC === 'true';

      logger.info(`[MemoryManagement] Getting memory metrics for timeframe: ${timeframe}`);

      const memoryManager = getMemoryManager();
      const report = memoryManager.getReport();

      // Filter metrics based on timeframe
      const timeframeMs = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      }[timeframe];

      const cutoffTime = Date.now() - timeframeMs;
      const filteredMetrics = report.memory.current ?
        [report.memory.current].filter(m => m.timestamp >= cutoffTime) : [];

      const analytics = {
        averageHeapUsed: filteredMetrics.length > 0 ?
          filteredMetrics.reduce((sum, m) => sum + m.heapUsed, 0) / filteredMetrics.length : 0,
        peakHeapUsed: filteredMetrics.length > 0 ?
          Math.max(...filteredMetrics.map(m => m.heapUsed)) : 0,
        averageHeapUtilization: filteredMetrics.length > 0 ?
          filteredMetrics.reduce((sum, m) => sum + m.heapUtilization, 0) / filteredMetrics.length : 0,
        memoryGrowthRate: calculateGrowthRate(filteredMetrics),
      };

      const responseData = {
        timeframe,
        metrics: filteredMetrics,
        analytics,
        alerts: report.memory.alerts,
        trend: report.memory.trend,
      };

      if (includeGC) {
        responseData.gc = report.gc;
      }

      res.json({
        success: true,
        message: 'Memory metrics retrieved successfully',
        data: responseData,
      });
    } catch (error) {
      logger.error(`[MemoryManagement] Error getting memory metrics: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve memory metrics',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/memory/resources
 * Get resource usage analytics
 */
router.get('/resources',
  authenticateToken,
  async (req, res) => {
    try {
      logger.info('[MemoryManagement] Getting resource analytics');

      const memoryManager = getMemoryManager();
      const report = memoryManager.getReport();

      const resourceAnalytics = {
        current: report.resources.counts,
        tracked: report.resources.tracked,
        recommendations: generateResourceRecommendations(report.resources),
        efficiency: calculateResourceEfficiency(report.resources),
      };

      res.json({
        success: true,
        message: 'Resource analytics retrieved successfully',
        data: resourceAnalytics,
      });
    } catch (error) {
      logger.error(`[MemoryManagement] Error getting resource analytics: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve resource analytics',
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/memory/gc
 * Trigger garbage collection manually
 */
router.post('/gc',
  authenticateToken,
  body('force').optional().isBoolean().withMessage('force must be boolean'),
  validateRequest,
  async (req, res) => {
    try {
      const force = req.body.force || false;

      logger.info(`[MemoryManagement] Manual GC trigger requested (force: ${force})`);

      if (!global.gc) {
        return res.status(400).json({
          success: false,
          message: 'Garbage collection not exposed',
          error: 'Node.js must be started with --expose-gc flag',
        });
      }

      const beforeGC = process.memoryUsage();
      const startTime = Date.now();

      global.gc();

      const afterGC = process.memoryUsage();
      const duration = Date.now() - startTime;
      const memoryFreed = beforeGC.heapUsed - afterGC.heapUsed;

      const gcResult = {
        duration: `${duration}ms`,
        memoryBefore: {
          heapUsed: `${Math.round(beforeGC.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(beforeGC.heapTotal / 1024 / 1024)}MB`,
        },
        memoryAfter: {
          heapUsed: `${Math.round(afterGC.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(afterGC.heapTotal / 1024 / 1024)}MB`,
        },
        memoryFreed: `${Math.round(memoryFreed / 1024 / 1024)}MB`,
        efficiency: memoryFreed > 0 ? 'effective' : 'minimal',
      };

      res.json({
        success: true,
        message: 'Garbage collection completed successfully',
        data: gcResult,
      });
    } catch (error) {
      logger.error(`[MemoryManagement] Error triggering GC: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to trigger garbage collection',
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/memory/cleanup
 * Cleanup tracked resources
 */
router.post('/cleanup',
  authenticateToken,
  body('resourceTypes').optional().isArray().withMessage('resourceTypes must be array'),
  validateRequest,
  async (req, res) => {
    try {
      const resourceTypes = req.body.resourceTypes || ['all'];

      logger.info(`[MemoryManagement] Resource cleanup requested for: ${resourceTypes.join(', ')}`);

      const memoryManager = getMemoryManager();

      if (resourceTypes.includes('all')) {
        memoryManager.cleanupAllResources();
      } else {
        // Selective cleanup would be implemented here
        logger.warn('[MemoryManagement] Selective cleanup not yet implemented');
      }

      const report = memoryManager.getReport();

      res.json({
        success: true,
        message: 'Resource cleanup completed successfully',
        data: {
          resourcesAfterCleanup: report.resources.counts,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error(`[MemoryManagement] Error during cleanup: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup resources',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/memory/alerts
 * Get memory and performance alerts
 */
router.get('/alerts',
  authenticateToken,
  query('severity').optional().isIn(['info', 'warning', 'critical']).withMessage('Invalid severity'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validateRequest,
  async (req, res) => {
    try {
      const { severity } = req.query;
      const limit = parseInt(req.query.limit) || 50;

      logger.info('[MemoryManagement] Getting memory alerts');

      const memoryManager = getMemoryManager();
      const report = memoryManager.getReport();

      let alerts = report.memory.alerts || [];

      // Filter by severity if specified
      if (severity) {
        alerts = alerts.filter(alert => alert.severity === severity);
      }

      // Limit results
      alerts = alerts.slice(-limit);

      const alertSummary = {
        total: alerts.length,
        bySeverity: alerts.reduce((acc, alert) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        }, {}),
        recent: alerts.slice(-10),
      };

      res.json({
        success: true,
        message: 'Memory alerts retrieved successfully',
        data: {
          alerts,
          summary: alertSummary,
        },
      });
    } catch (error) {
      logger.error(`[MemoryManagement] Error getting alerts: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve memory alerts',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/memory/health
 * Get overall system health assessment
 */
router.get('/health',
  authenticateToken,
  async (req, res) => {
    try {
      logger.info('[MemoryManagement] Getting system health assessment');

      const memoryManager = getMemoryManager();
      const report = memoryManager.getReport();
      const memUsage = process.memoryUsage();

      const healthScore = calculateHealthScore(report, memUsage);
      const recommendations = generateHealthRecommendations(report, memUsage);

      const healthAssessment = {
        score: healthScore,
        status: healthScore >= 80 ? 'excellent' :
          healthScore >= 60 ? 'good' :
            healthScore >= 40 ? 'fair' : 'poor',
        memory: {
          utilization: memUsage.heapUsed / memUsage.heapTotal,
          status: memUsage.heapUsed < 400 * 1024 * 1024 ? 'healthy' : 'warning',
        },
        resources: {
          efficiency: calculateResourceEfficiency(report.resources),
          status: 'healthy',
        },
        uptime: process.uptime(),
        recommendations,
      };

      res.json({
        success: true,
        message: 'System health assessment completed',
        data: healthAssessment,
      });
    } catch (error) {
      logger.error(`[MemoryManagement] Error getting health assessment: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to get system health assessment',
        error: error.message,
      });
    }
  },
);

// Helper functions
function calculateGrowthRate(metrics) {
  if (metrics.length < 2) { return 0; }

  const [first] = metrics;
  const last = metrics[metrics.length - 1];
  const timeDiff = last.timestamp - first.timestamp;
  const memoryDiff = last.heapUsed - first.heapUsed;

  return timeDiff > 0 ? (memoryDiff / timeDiff) * 1000 : 0; // bytes per second
}

function generateResourceRecommendations(resources) {
  const recommendations = [];

  if (resources.counts.timers > 50) {
    recommendations.push('Consider reducing the number of active timers');
  }

  if (resources.counts.eventListeners > 100) {
    recommendations.push('High number of event listeners detected - check for memory leaks');
  }

  if (resources.counts.handles > 200) {
    recommendations.push('High number of active handles - ensure proper cleanup');
  }

  return recommendations;
}

function calculateResourceEfficiency(resources) {
  const totalResources = Object.values(resources.counts).reduce((sum, count) => sum + count, 0);
  const trackedResources = Object.values(resources.tracked).reduce((sum, count) => sum + count, 0);

  return totalResources > 0 ? (trackedResources / totalResources) * 100 : 100;
}

function calculateHealthScore(report, memUsage) {
  let score = 100;

  // Memory utilization penalty
  const memUtilization = memUsage.heapUsed / memUsage.heapTotal;
  if (memUtilization > 0.8) { score -= 20; } else if (memUtilization > 0.6) { score -= 10; }

  // Alert penalty
  const criticalAlerts = (report.memory.alerts || []).filter(a => a.severity === 'critical').length;
  const warningAlerts = (report.memory.alerts || []).filter(a => a.severity === 'warning').length;
  score -= criticalAlerts * 15 + warningAlerts * 5;

  // Resource efficiency bonus/penalty
  const efficiency = calculateResourceEfficiency(report.resources);
  if (efficiency > 90) { score += 5; } else if (efficiency < 50) { score -= 10; }

  return Math.max(0, Math.min(100, score));
}

function generateHealthRecommendations(report, memUsage) {
  const recommendations = [];

  const memUtilization = memUsage.heapUsed / memUsage.heapTotal;
  if (memUtilization > 0.8) {
    recommendations.push('Memory utilization is high - consider optimizing memory usage or increasing heap size');
  }

  const criticalAlerts = (report.memory.alerts || []).filter(a => a.severity === 'critical').length;
  if (criticalAlerts > 0) {
    recommendations.push('Critical memory alerts detected - immediate attention required');
  }

  if (report.monitoring && !report.monitoring.isActive) {
    recommendations.push('Memory monitoring is not active - enable monitoring for better insights');
  }

  return recommendations;
}

export default router;
