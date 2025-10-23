/**
 * 🔧 Resource Management Middleware
 *
 * Express middleware for automatic resource tracking and cleanup:
 * - Request-scoped resource tracking
 * - Automatic cleanup on request completion
 * - Memory usage monitoring per request
 * - Resource leak detection
 * - Performance monitoring
 *
 * Features:
 * - Track database connections, timers, and event listeners per request
 * - Automatic cleanup on response finish
 * - Memory usage tracking and reporting
 * - Request performance metrics
 * - Resource usage analytics
 */

import { performance } from 'perf_hooks';
import { getMemoryManager } from '../services/memoryResourceManagementService.mjs';
import logger from '../utils/logger.mjs';

/**
 * Create resource management middleware
 */
export function createResourceManagementMiddleware(options = {}) {
  const config = {
    trackMemoryUsage: options.trackMemoryUsage !== false,
    trackPerformance: options.trackPerformance !== false,
    enableCleanup: options.enableCleanup !== false,
    logResourceUsage: options.logResourceUsage || false,
    memoryThreshold: options.memoryThreshold || 100 * 1024 * 1024, // 100MB
    performanceThreshold: options.performanceThreshold || 5000, // 5 seconds
    ...options,
  };

  return (req, res, next) => {
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    const startMemory = config.trackMemoryUsage ? process.memoryUsage() : null;

    // Initialize request-scoped resource tracking
    req.resources = {
      id: requestId,
      timers: new Set(),
      intervals: new Set(),
      eventListeners: new Map(),
      streams: new Set(),
      connections: new Set(),
      startTime,
      startMemory,
    };

    // Add resource tracking helpers to request
    req.trackResource = (type, resource, _metadata = {}) => {
      if (req.resources[type]) {
        req.resources[type].add(resource);

        if (config.logResourceUsage) {
          logger.debug(`[ResourceManagement] Request ${requestId}: Tracking ${type} resource`);
        }
      }
    };

    req.untrackResource = (type, resource) => {
      if (req.resources[type]) {
        req.resources[type].delete(resource);

        if (config.logResourceUsage) {
          logger.debug(`[ResourceManagement] Request ${requestId}: Untracked ${type} resource`);
        }
      }
    };

    // Override setTimeout to track timers
    const originalSetTimeout = global.setTimeout;
    req.setTimeout = (callback, delay, ...args) => {
      const timer = originalSetTimeout((...callbackArgs) => {
        req.untrackResource('timers', timer);
        callback(...callbackArgs);
      }, delay, ...args);

      req.trackResource('timers', timer);
      return timer;
    };

    // Override setInterval to track intervals
    const originalSetInterval = global.setInterval;
    req.setInterval = (callback, delay, ...args) => {
      const interval = originalSetInterval(callback, delay, ...args);
      req.trackResource('intervals', interval);
      return interval;
    };

    // Add cleanup function
    req.cleanupResources = () => {
      let cleanedCount = 0;

      // Cleanup timers
      for (const timer of req.resources.timers) {
        try {
          clearTimeout(timer);
          cleanedCount++;
        } catch (error) {
          logger.warn(`[ResourceManagement] Failed to clear timer: ${error.message}`);
        }
      }
      req.resources.timers.clear();

      // Cleanup intervals
      for (const interval of req.resources.intervals) {
        try {
          clearInterval(interval);
          cleanedCount++;
        } catch (error) {
          logger.warn(`[ResourceManagement] Failed to clear interval: ${error.message}`);
        }
      }
      req.resources.intervals.clear();

      // Cleanup event listeners
      for (const [emitter, listeners] of req.resources.eventListeners) {
        try {
          for (const { event, listener } of listeners) {
            emitter.removeListener(event, listener);
            cleanedCount++;
          }
        } catch (error) {
          logger.warn(`[ResourceManagement] Failed to remove event listener: ${error.message}`);
        }
      }
      req.resources.eventListeners.clear();

      // Cleanup streams
      for (const stream of req.resources.streams) {
        try {
          if (stream.destroy && typeof stream.destroy === 'function') {
            stream.destroy();
            cleanedCount++;
          }
        } catch (error) {
          logger.warn(`[ResourceManagement] Failed to destroy stream: ${error.message}`);
        }
      }
      req.resources.streams.clear();

      // Cleanup connections
      for (const connection of req.resources.connections) {
        try {
          if (connection.close && typeof connection.close === 'function') {
            connection.close();
            cleanedCount++;
          } else if (connection.end && typeof connection.end === 'function') {
            connection.end();
            cleanedCount++;
          }
        } catch (error) {
          logger.warn(`[ResourceManagement] Failed to close connection: ${error.message}`);
        }
      }
      req.resources.connections.clear();

      if (config.logResourceUsage && cleanedCount > 0) {
        logger.debug(`[ResourceManagement] Request ${requestId}: Cleaned ${cleanedCount} resources`);
      }

      return cleanedCount;
    };

    // Override res.end to add headers before response is sent
    const originalEnd = res.end;
    res.end = function (...args) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const endMemory = config.trackMemoryUsage ? process.memoryUsage() : null;

      // Calculate memory usage
      let memoryDelta = null;
      if (startMemory && endMemory) {
        memoryDelta = {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
        };
      }

      // Add performance headers before response is sent
      if (config.trackPerformance && !res.headersSent) {
        try {
          res.setHeader('X-Response-Time', `${Math.round(duration)}ms`);
          res.setHeader('X-Memory-Delta', memoryDelta ? `${Math.round(memoryDelta.heapUsed / 1024)}KB` : 'unknown');
          res.setHeader('X-Resources-Cleaned', '0'); // Will be updated in finish event
        } catch (error) {
          logger.debug(`[ResourceManagement] Could not set headers: ${error.message}`);
        }
      }

      // Call original end method
      originalEnd.apply(this, args);
    };

    // Setup cleanup on response finish
    if (config.enableCleanup) {
      res.on('finish', () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        const endMemory = config.trackMemoryUsage ? process.memoryUsage() : null;

        // Cleanup resources
        const cleanedCount = req.cleanupResources();

        // Calculate memory usage
        let memoryDelta = null;
        if (startMemory && endMemory) {
          memoryDelta = {
            rss: endMemory.rss - startMemory.rss,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            external: endMemory.external - startMemory.external,
          };
        }

        // Log performance metrics
        if (config.trackPerformance) {
          const metrics = {
            requestId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: Math.round(duration * 100) / 100,
            memoryDelta,
            resourcesCleaned: cleanedCount,
          };

          // Check for performance issues
          if (duration > config.performanceThreshold) {
            logger.warn(`[ResourceManagement] Slow request detected: ${req.method} ${req.url} took ${Math.round(duration)}ms`);
          }

          if (memoryDelta && memoryDelta.heapUsed > config.memoryThreshold) {
            logger.warn(`[ResourceManagement] High memory usage: ${req.method} ${req.url} used ${Math.round(memoryDelta.heapUsed / 1024 / 1024)}MB`);
          }

          if (config.logResourceUsage) {
            logger.debug(`[ResourceManagement] Request completed: ${JSON.stringify(metrics)}`);
          }
        }
      });

      // Setup cleanup on request close/error
      req.on('close', () => {
        req.cleanupResources();
      });

      req.on('error', (error) => {
        logger.error(`[ResourceManagement] Request error: ${error.message}`);
        req.cleanupResources();
      });
    }

    next();
  };
}

/**
 * Memory monitoring middleware
 */
export function memoryMonitoringMiddleware(options = {}) {
  const config = {
    interval: options.interval || 10000, // 10 seconds
    threshold: options.threshold || 500 * 1024 * 1024, // 500MB
    enableGC: options.enableGC || false,
    ...options,
  };

  const _memoryManager = getMemoryManager();

  return (req, res, next) => {
    // Add memory info to response headers
    const memUsage = process.memoryUsage();
    res.setHeader('X-Memory-RSS', `${Math.round(memUsage.rss / 1024 / 1024)}MB`);
    res.setHeader('X-Memory-Heap-Used', `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    res.setHeader('X-Memory-Heap-Total', `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);

    // Check memory threshold
    if (memUsage.heapUsed > config.threshold) {
      logger.warn(`[MemoryMonitoring] Memory threshold exceeded: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);

      if (config.enableGC && global.gc) {
        try {
          global.gc();
          logger.info('[MemoryMonitoring] Triggered garbage collection');
        } catch (error) {
          logger.error(`[MemoryMonitoring] GC failed: ${error.message}`);
        }
      }
    }

    next();
  };
}

/**
 * Database connection monitoring middleware
 */
export function databaseConnectionMiddleware(prisma) {
  return (req, res, next) => {
    const originalQuery = prisma.$queryRaw;
    const originalExecute = prisma.$executeRaw;

    let queryCount = 0;
    const startTime = Date.now();

    // Track database queries
    prisma.$queryRaw = (...args) => {
      queryCount++;
      return originalQuery.apply(prisma, args);
    };

    prisma.$executeRaw = (...args) => {
      queryCount++;
      return originalExecute.apply(prisma, args);
    };

    // Override res.end to add DB headers before response is sent
    const originalEnd = res.end;
    res.end = function (...args) {
      const duration = Date.now() - startTime;

      if (queryCount > 0 && !res.headersSent) {
        try {
          res.setHeader('X-DB-Queries', queryCount.toString());
          res.setHeader('X-DB-Time', `${duration}ms`);
        } catch (error) {
          logger.debug(`[DatabaseMonitoring] Could not set headers: ${error.message}`);
        }
      }

      // Call original end method
      originalEnd.apply(this, args);
    };

    // Restore original methods and log stats on response
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (queryCount > 10) {
        logger.warn(`[DatabaseMonitoring] High query count: ${queryCount} queries in ${duration}ms for ${req.method} ${req.url}`);
      }

      // Restore original methods
      prisma.$queryRaw = originalQuery;
      prisma.$executeRaw = originalExecute;
    });

    next();
  };
}

/**
 * Request timeout middleware with resource cleanup
 */
export function requestTimeoutMiddleware(timeout = 30000) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(`[ResourceManagement] Request timeout: ${req.method} ${req.url}`);

        // Cleanup resources before timeout
        if (req.cleanupResources) {
          req.cleanupResources();
        }

        res.status(408).json({
          success: false,
          message: 'Request timeout',
          error: 'The request took too long to complete',
        });
      }
    }, timeout);

    // Track the timeout timer
    if (req.trackResource) {
      req.trackResource('timers', timer);
    }

    // Clear timeout on response
    res.on('finish', () => {
      clearTimeout(timer);
      if (req.untrackResource) {
        req.untrackResource('timers', timer);
      }
    });

    next();
  };
}

export default {
  createResourceManagementMiddleware,
  memoryMonitoringMiddleware,
  databaseConnectionMiddleware,
  requestTimeoutMiddleware,
};
