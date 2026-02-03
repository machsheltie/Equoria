/**
 * 🚀 API Optimization Routes
 *
 * REST API endpoints for managing and monitoring API response optimization:
 * - Performance metrics and monitoring
 * - Compression statistics
 * - Cache hit rates and efficiency
 * - Response size analytics
 * - Optimization configuration
 *
 * Features:
 * - Real-time performance metrics
 * - Optimization configuration management
 * - Response analytics and insights
 * - Performance benchmarking tools
 * - Cache management utilities
 */

import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import { getOptimizationMetrics } from '../middleware/responseOptimization.mjs';
import {
  getPerformanceMetrics,
  PaginationService,
  SerializationService,
  ResponseCacheService as _ResponseCacheService,
} from '../services/apiResponseOptimizationService.mjs';
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
 * GET /api/optimization/metrics
 * Get comprehensive API optimization metrics
 */
router.get('/metrics',
  authenticateToken,
  getOptimizationMetrics,
);

/**
 * GET /api/optimization/performance
 * Get detailed performance analytics
 */
router.get('/performance',
  authenticateToken,
  query('timeframe').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid timeframe'),
  validateRequest,
  async (req, res) => {
    try {
      const timeframe = req.query.timeframe || '24h';

      logger.info(`[ApiOptimization] Getting performance metrics for timeframe: ${timeframe}`);

      const metrics = getPerformanceMetrics();

      // Calculate performance insights
      const insights = {
        averageResponseTime: calculateAverageResponseTime(metrics.serializationTime),
        compressionEfficiency: calculateCompressionEfficiency(metrics.compressionRatio),
        cacheEffectiveness: metrics.cacheHitRate,
        responseOptimization: analyzeResponseOptimization(metrics),
      };

      res.json({
        success: true,
        message: 'Performance metrics retrieved successfully',
        data: {
          metrics,
          insights,
          timeframe,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error(`[ApiOptimization] Error getting performance metrics: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve performance metrics',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/optimization/compression-stats
 * Get compression statistics and efficiency metrics
 */
router.get('/compression-stats',
  authenticateToken,
  async (req, res) => {
    try {
      logger.info('[ApiOptimization] Getting compression statistics');

      const metrics = getPerformanceMetrics();

      const compressionStats = {
        averageCompressionRatio: calculateAverageCompressionRatio(metrics.compressionRatio),
        totalBytesSaved: calculateTotalBytesSaved(metrics.responseSize, metrics.compressionRatio),
        compressionEfficiency: calculateCompressionEfficiency(metrics.compressionRatio),
        recommendedSettings: generateCompressionRecommendations(metrics),
      };

      res.json({
        success: true,
        message: 'Compression statistics retrieved successfully',
        data: compressionStats,
      });
    } catch (error) {
      logger.error(`[ApiOptimization] Error getting compression stats: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve compression statistics',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/optimization/cache-analytics
 * Get cache performance analytics
 */
router.get('/cache-analytics',
  authenticateToken,
  async (req, res) => {
    try {
      logger.info('[ApiOptimization] Getting cache analytics');

      const metrics = getPerformanceMetrics();

      const cacheAnalytics = {
        hitRate: metrics.cacheHitRate,
        totalRequests: metrics.totalRequests,
        cacheEfficiency: analyzeCacheEfficiency(metrics),
        recommendations: generateCacheRecommendations(metrics),
      };

      res.json({
        success: true,
        message: 'Cache analytics retrieved successfully',
        data: cacheAnalytics,
      });
    } catch (error) {
      logger.error(`[ApiOptimization] Error getting cache analytics: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cache analytics',
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/optimization/test-compression
 * Test compression efficiency on sample data
 */
router.post('/test-compression',
  authenticateToken,
  body('data').notEmpty().withMessage('Test data is required'),
  body('algorithm').optional().isIn(['gzip', 'brotli', 'deflate']).withMessage('Invalid compression algorithm'),
  validateRequest,
  async (req, res) => {
    try {
      const { data, algorithm = 'gzip' } = req.body;

      logger.info(`[ApiOptimization] Testing compression with algorithm: ${algorithm}`);

      const originalSize = JSON.stringify(data).length;
      const optimizedData = SerializationService.optimizeResponse(data, { compress: true });
      const optimizedSize = JSON.stringify(optimizedData).length;

      const compressionRatio = (originalSize - optimizedSize) / originalSize;
      const bytesSaved = originalSize - optimizedSize;

      res.json({
        success: true,
        message: 'Compression test completed successfully',
        data: {
          originalSize,
          optimizedSize,
          compressionRatio: Math.round(compressionRatio * 100) / 100,
          bytesSaved,
          percentageSaved: Math.round(compressionRatio * 10000) / 100,
          algorithm,
          recommendation: generateCompressionRecommendation(compressionRatio),
        },
      });
    } catch (error) {
      logger.error(`[ApiOptimization] Error testing compression: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to test compression',
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/optimization/test-pagination
 * Test pagination performance with sample dataset
 */
router.post('/test-pagination',
  authenticateToken,
  body('dataSize').isInt({ min: 1, max: 10000 }).withMessage('Data size must be between 1 and 10000'),
  body('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('Page size must be between 1 and 100'),
  body('paginationType').optional().isIn(['offset', 'cursor']).withMessage('Invalid pagination type'),
  validateRequest,
  async (req, res) => {
    try {
      const { dataSize, pageSize = 20, paginationType = 'offset' } = req.body;

      logger.info(`[ApiOptimization] Testing ${paginationType} pagination with ${dataSize} items`);

      // Generate test data
      const testData = Array.from({ length: dataSize }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        value: Math.random() * 100,
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      }));

      const startTime = Date.now();

      let paginationResult;
      if (paginationType === 'cursor') {
        paginationResult = PaginationService.createCursorPagination({
          data: testData.slice(0, pageSize),
          limit: pageSize,
          totalCount: dataSize,
        });
      } else {
        paginationResult = PaginationService.createOffsetPagination({
          data: testData.slice(0, pageSize),
          page: 1,
          limit: pageSize,
          totalCount: dataSize,
        });
      }

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        message: 'Pagination test completed successfully',
        data: {
          paginationType,
          dataSize,
          pageSize,
          processingTime: `${processingTime}ms`,
          result: paginationResult,
          performance: {
            itemsPerMs: processingTime > 0 ? Math.round(dataSize / processingTime) : dataSize,
            efficiency: processingTime < 10 ? 'excellent' : processingTime < 50 ? 'good' : 'needs optimization',
          },
        },
      });
    } catch (error) {
      logger.error(`[ApiOptimization] Error testing pagination: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to test pagination',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/optimization/recommendations
 * Get optimization recommendations based on current metrics
 */
router.get('/recommendations',
  authenticateToken,
  async (req, res) => {
    try {
      logger.info('[ApiOptimization] Generating optimization recommendations');

      const metrics = getPerformanceMetrics();
      const recommendations = generateOptimizationRecommendations(metrics);

      res.json({
        success: true,
        message: 'Optimization recommendations generated successfully',
        data: {
          recommendations,
          priority: categorizePriority(recommendations),
          estimatedImpact: estimateImpact(recommendations),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error(`[ApiOptimization] Error generating recommendations: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to generate optimization recommendations',
        error: error.message,
      });
    }
  },
);

// Helper functions
function calculateAverageResponseTime(serializationTimes) {
  const times = Object.values(serializationTimes);
  return times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
}

function calculateCompressionEfficiency(compressionRatios) {
  const ratios = Object.values(compressionRatios);
  return ratios.length > 0 ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length : 0;
}

function calculateAverageCompressionRatio(compressionRatios) {
  return calculateCompressionEfficiency(compressionRatios);
}

function calculateTotalBytesSaved(responseSizes, compressionRatios) {
  let totalSaved = 0;
  for (const [timestamp, size] of Object.entries(responseSizes)) {
    const ratio = compressionRatios[timestamp] || 0;
    totalSaved += size * ratio;
  }
  return totalSaved;
}

function analyzeResponseOptimization(metrics) {
  return {
    serializationEfficiency: metrics.serializationTime ? 'good' : 'unknown',
    compressionUtilization: metrics.compressionRatio ? 'active' : 'inactive',
    cacheUtilization: metrics.cacheHitRate > 0.5 ? 'good' : 'needs improvement',
  };
}

function analyzeCacheEfficiency(metrics) {
  if (metrics.cacheHitRate > 0.8) { return 'excellent'; }
  if (metrics.cacheHitRate > 0.6) { return 'good'; }
  if (metrics.cacheHitRate > 0.3) { return 'fair'; }
  return 'poor';
}

function generateCompressionRecommendations(metrics) {
  const recommendations = [];

  if (calculateCompressionEfficiency(metrics.compressionRatio) < 0.3) {
    recommendations.push('Consider enabling Brotli compression for better efficiency');
  }

  if (Object.keys(metrics.compressionRatio).length === 0) {
    recommendations.push('Enable response compression to reduce bandwidth usage');
  }

  return recommendations;
}

function generateCacheRecommendations(metrics) {
  const recommendations = [];

  if (metrics.cacheHitRate < 0.5) {
    recommendations.push('Increase cache TTL for frequently accessed data');
    recommendations.push('Implement more aggressive caching strategies');
  }

  if (metrics.totalRequests > 1000 && metrics.cacheHitRate === 0) {
    recommendations.push('Enable response caching to improve performance');
  }

  return recommendations;
}

function generateCompressionRecommendation(ratio) {
  if (ratio > 0.7) { return 'Excellent compression ratio'; }
  if (ratio > 0.5) { return 'Good compression ratio'; }
  if (ratio > 0.3) { return 'Moderate compression ratio'; }
  return 'Poor compression ratio - consider data structure optimization';
}

function generateOptimizationRecommendations(metrics) {
  const recommendations = [];

  // Compression recommendations
  recommendations.push(...generateCompressionRecommendations(metrics));

  // Cache recommendations
  recommendations.push(...generateCacheRecommendations(metrics));

  // Performance recommendations
  const avgResponseTime = calculateAverageResponseTime(metrics.serializationTime);
  if (avgResponseTime > 100) {
    recommendations.push('Optimize data serialization to reduce response times');
  }

  return recommendations;
}

function categorizePriority(recommendations) {
  return {
    high: recommendations.filter(r => r.includes('Enable') || r.includes('Implement')),
    medium: recommendations.filter(r => r.includes('Increase') || r.includes('Consider')),
    low: recommendations.filter(r => r.includes('Optimize')),
  };
}

function estimateImpact(recommendations) {
  return {
    performance: recommendations.length > 3 ? 'high' : recommendations.length > 1 ? 'medium' : 'low',
    bandwidth: recommendations.some(r => r.includes('compression')) ? 'high' : 'low',
    userExperience: recommendations.some(r => r.includes('cache') || r.includes('response')) ? 'high' : 'medium',
  };
}

export default router;
