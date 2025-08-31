/**
 * 🚀 Response Optimization Middleware
 * 
 * Express middleware for optimizing API responses including:
 * - Automatic response compression
 * - ETag generation and validation
 * - Response size monitoring
 * - Field selection support
 * - Lazy loading integration
 * - Performance metrics collection
 * 
 * Features:
 * - Intelligent compression based on content type and size
 * - Automatic ETag generation for cacheable responses
 * - Query parameter support for field selection (?fields=name,age)
 * - Response size tracking and optimization warnings
 * - Integration with existing ApiResponse class
 */

import {
  SerializationService,
  ResponseCacheService,
  getPerformanceMetrics,
} from '../services/apiResponseOptimizationService.mjs';
import logger from '../utils/logger.mjs';

/**
 * Response optimization middleware
 */
export function responseOptimization(options = {}) {
  const {
    enableFieldSelection = true,
    enableETag = true,
    enableSizeMonitoring = true,
    maxResponseSize = 10 * 1024 * 1024, // 10MB
    warningSizeThreshold = 1024 * 1024, // 1MB
  } = options;

  return (req, res, next) => {
    const originalJson = res.json;
    const startTime = Date.now();

    res.json = function (data) {
      try {
        let optimizedData = data;

        // Apply field selection if requested
        if (enableFieldSelection && req.query.fields) {
          const fields = req.query.fields.split(',').map(f => f.trim());
          if (data && data.data) {
            optimizedData = {
              ...data,
              data: SerializationService.selectFields(data.data, fields),
            };
          }
        }

        // Apply field exclusion if requested
        if (enableFieldSelection && req.query.exclude) {
          const excludeFields = req.query.exclude.split(',').map(f => f.trim());
          if (data && data.data) {
            optimizedData = {
              ...data,
              data: SerializationService.excludeFields(data.data, excludeFields),
            };
          }
        }

        // Apply data compression optimizations
        if (req.query.compress !== 'false') {
          optimizedData = SerializationService.optimizeResponse(optimizedData, {
            compress: true,
          });
        }

        // Generate ETag for cacheable responses
        if (enableETag && ResponseCacheService.shouldCache(req, res)) {
          const etag = ResponseCacheService.generateETag(optimizedData);
          
          // Check if client has cached version
          if (req.headers['if-none-match'] === etag) {
            return res.status(304).end();
          }
          
          res.setHeader('ETag', etag);
          ResponseCacheService.setCacheHeaders(res, {
            maxAge: 300, // 5 minutes
            staleWhileRevalidate: 60, // 1 minute
            etag,
          });
        }

        // Monitor response size
        if (enableSizeMonitoring) {
          const responseSize = JSON.stringify(optimizedData).length;
          
          if (responseSize > maxResponseSize) {
            logger.error(`[ResponseOptimization] Response size exceeds limit: ${responseSize} bytes for ${req.method} ${req.path}`);
            return res.status(413).json({
              success: false,
              message: 'Response payload too large',
              meta: { responseSize, maxSize: maxResponseSize },
            });
          }
          
          if (responseSize > warningSizeThreshold) {
            logger.warn(`[ResponseOptimization] Large response detected: ${responseSize} bytes for ${req.method} ${req.path}`);
          }

          // Add response size to headers for debugging
          res.setHeader('X-Response-Size', responseSize);
        }

        // Add performance metrics to response headers
        const processingTime = Date.now() - startTime;
        res.setHeader('X-Processing-Time', `${processingTime}ms`);

        // Add optimization info to response
        if (req.query.debug === 'true') {
          optimizedData.meta = {
            ...optimizedData.meta,
            optimization: {
              processingTime: `${processingTime}ms`,
              fieldsSelected: !!req.query.fields,
              fieldsExcluded: !!req.query.exclude,
              compressed: req.query.compress !== 'false',
              cached: !!res.getHeader('ETag'),
            },
          };
        }

        return originalJson.call(this, optimizedData);
      } catch (error) {
        logger.error(`[ResponseOptimization] Error optimizing response: ${error.message}`);
        return originalJson.call(this, data);
      }
    };

    next();
  };
}

/**
 * Pagination middleware for automatic pagination support
 */
export function paginationMiddleware(options = {}) {
  const {
    defaultLimit = 20,
    maxLimit = 100,
    enableCursor = true,
  } = options;

  return (req, res, next) => {
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || defaultLimit, maxLimit);
    const cursor = req.query.cursor;
    const orderBy = req.query.orderBy || 'id';
    const orderDirection = req.query.orderDirection || 'asc';

    // Validate parameters
    if (page < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be a positive integer',
      });
    }

    if (limit < 1) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be a positive integer',
      });
    }

    // Add pagination info to request
    req.pagination = {
      page,
      limit,
      cursor,
      orderBy,
      orderDirection,
      offset: (page - 1) * limit,
      useCursor: enableCursor && !!cursor,
    };

    next();
  };
}

/**
 * Lazy loading middleware for related data
 */
export function lazyLoadingMiddleware(options = {}) {
  const {
    enableLazyLoading = true,
    defaultIncludes = [],
  } = options;

  return (req, res, next) => {
    if (!enableLazyLoading) {
      return next();
    }

    // Parse include parameters
    const includes = req.query.include ? req.query.include.split(',').map(i => i.trim()) : defaultIncludes;
    const excludeIncludes = req.query.excludeInclude ? req.query.excludeInclude.split(',').map(i => i.trim()) : [];

    // Filter includes
    const filteredIncludes = includes.filter(include => !excludeIncludes.includes(include));

    req.lazyLoading = {
      includes: filteredIncludes,
      excludes: excludeIncludes,
      enabled: true,
    };

    next();
  };
}

/**
 * Response compression middleware wrapper
 */
export function compressionMiddleware(options = {}) {
  const {
    threshold = 1024,
    level = 6,
    enableBrotli = true,
  } = options;

  return (req, res, next) => {
    // Set compression preferences
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    if (enableBrotli && acceptEncoding.includes('br')) {
      res.setHeader('Content-Encoding', 'br');
    } else if (acceptEncoding.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
    }

    next();
  };
}

/**
 * Performance monitoring middleware
 */
export function performanceMonitoring(options = {}) {
  const {
    enableMetrics = true,
    logSlowRequests = true,
    slowRequestThreshold = 1000, // 1 second
  } = options;

  return (req, res, next) => {
    if (!enableMetrics) {
      return next();
    }

    const startTime = Date.now();
    const originalEnd = res.end;

    res.end = function (...args) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log slow requests
      if (logSlowRequests && duration > slowRequestThreshold) {
        logger.warn(`[Performance] Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
      }

      // Add performance headers
      res.setHeader('X-Response-Time', `${duration}ms`);
      res.setHeader('X-Timestamp', new Date().toISOString());

      return originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Get optimization metrics endpoint
 */
export function getOptimizationMetrics(req, res) {
  try {
    const metrics = getPerformanceMetrics();
    
    res.json({
      success: true,
      message: 'API optimization metrics retrieved',
      data: {
        performance: metrics,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    });
  } catch (error) {
    logger.error(`[OptimizationMetrics] Error retrieving metrics: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve optimization metrics',
      error: error.message,
    });
  }
}

export default {
  responseOptimization,
  paginationMiddleware,
  lazyLoadingMiddleware,
  compressionMiddleware,
  performanceMonitoring,
  getOptimizationMetrics,
};
