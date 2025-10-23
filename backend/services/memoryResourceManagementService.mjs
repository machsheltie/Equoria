/**
 * 🧠 Memory and Resource Management Service
 *
 * Comprehensive memory monitoring and resource management system for Node.js applications:
 * - Memory leak detection and monitoring
 * - Resource cleanup and lifecycle management
 * - Garbage collection optimization
 * - Performance monitoring and alerting
 * - Database connection pool management
 * - Event listener cleanup
 * - Timer and interval management
 *
 * Features:
 * - Real-time memory usage tracking
 * - Automatic resource cleanup
 * - Memory leak detection algorithms
 * - Performance threshold monitoring
 * - Resource usage analytics
 * - Automated garbage collection optimization
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import logger from '../utils/logger.mjs';

class MemoryResourceManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      memoryThreshold: options.memoryThreshold || 500 * 1024 * 1024, // 500MB default
      gcInterval: options.gcInterval || 30000, // 30 seconds
      monitoringInterval: options.monitoringInterval || 5000, // 5 seconds
      alertThreshold: options.alertThreshold || 0.8, // 80% of threshold
      maxEventListeners: options.maxEventListeners || 100,
      enableGCOptimization: options.enableGCOptimization !== false,
      enableMemoryProfiling: options.enableMemoryProfiling !== false,
      ...options,
    };

    this.metrics = {
      memoryUsage: [],
      gcEvents: [],
      resourceCounts: {},
      performanceMarks: new Map(),
      alerts: [],
    };

    this.resources = {
      timers: new Set(),
      intervals: new Set(),
      eventListeners: new Map(),
      streams: new Set(),
      connections: new Set(),
    };

    this.isMonitoring = false;
    this.monitoringTimer = null;
    this.gcTimer = null;

    this.setupEventListeners();
  }

  /**
   * Start memory and resource monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('[MemoryManager] Monitoring already started');
      return;
    }

    logger.info('[MemoryManager] Starting memory and resource monitoring');
    this.isMonitoring = true;

    // Start memory monitoring
    this.monitoringTimer = setInterval(() => {
      this.collectMemoryMetrics();
      this.checkMemoryThresholds();
      this.detectMemoryLeaks();
    }, this.options.monitoringInterval);

    // Start garbage collection optimization
    if (this.options.enableGCOptimization) {
      this.gcTimer = setInterval(() => {
        this.optimizeGarbageCollection();
      }, this.options.gcInterval);
    }

    this.trackResource('interval', this.monitoringTimer);
    if (this.gcTimer) {
      this.trackResource('interval', this.gcTimer);
    }

    this.emit('monitoring:started');
  }

  /**
   * Stop monitoring and cleanup resources
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('[MemoryManager] Stopping memory and resource monitoring');
    this.isMonitoring = false;

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }

    this.emit('monitoring:stopped');
  }

  /**
   * Collect current memory metrics
   */
  collectMemoryMetrics() {
    const memUsage = process.memoryUsage();
    const timestamp = Date.now();

    const metrics = {
      timestamp,
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      heapUtilization: memUsage.heapUsed / memUsage.heapTotal,
      resourceCounts: this.getResourceCounts(),
    };

    this.metrics.memoryUsage.push(metrics);

    // Keep only last 1000 entries
    if (this.metrics.memoryUsage.length > 1000) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-1000);
    }

    this.emit('metrics:collected', metrics);
    return metrics;
  }

  /**
   * Check memory thresholds and trigger alerts
   */
  checkMemoryThresholds() {
    const current = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    if (!current) { return; }

    const alertThreshold = this.options.memoryThreshold * this.options.alertThreshold;

    if (current.heapUsed > alertThreshold) {
      const alert = {
        type: 'memory_threshold',
        severity: current.heapUsed > this.options.memoryThreshold ? 'critical' : 'warning',
        timestamp: Date.now(),
        data: {
          heapUsed: current.heapUsed,
          threshold: this.options.memoryThreshold,
          utilization: current.heapUtilization,
        },
      };

      this.metrics.alerts.push(alert);
      this.emit('alert', alert);

      logger.warn(`[MemoryManager] Memory threshold alert: ${Math.round(current.heapUsed / 1024 / 1024)}MB used`);
    }
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks() {
    if (this.metrics.memoryUsage.length < 10) { return; }

    const recent = this.metrics.memoryUsage.slice(-10);
    const trend = this.calculateMemoryTrend(recent);

    // Check for consistent memory growth
    if (trend.slope > 1024 * 1024 && trend.correlation > 0.8) { // 1MB/sample with high correlation
      const alert = {
        type: 'memory_leak_detected',
        severity: 'warning',
        timestamp: Date.now(),
        data: {
          trend: trend.slope,
          correlation: trend.correlation,
          growthRate: `${Math.round(trend.slope / 1024 / 1024 * 100) / 100}MB per sample`,
        },
      };

      this.metrics.alerts.push(alert);
      this.emit('alert', alert);

      logger.warn(`[MemoryManager] Potential memory leak detected: ${alert.data.growthRate}`);
    }
  }

  /**
   * Calculate memory usage trend
   */
  calculateMemoryTrend(samples) {
    const n = samples.length;
    const x = samples.map((_, i) => i);
    const y = samples.map(s => s.heapUsed);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Calculate correlation coefficient
    const meanX = sumX / n;
    const meanY = sumY / n;
    const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
    const denomX = Math.sqrt(x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0));
    const denomY = Math.sqrt(y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0));
    const correlation = numerator / (denomX * denomY);

    return { slope, correlation };
  }

  /**
   * Optimize garbage collection
   */
  optimizeGarbageCollection() {
    if (!global.gc) {
      logger.debug('[MemoryManager] Garbage collection not exposed, skipping optimization');
      return;
    }

    const beforeGC = process.memoryUsage();
    const startTime = performance.now();

    try {
      global.gc();

      const afterGC = process.memoryUsage();
      const duration = performance.now() - startTime;

      const gcEvent = {
        timestamp: Date.now(),
        duration,
        memoryBefore: beforeGC,
        memoryAfter: afterGC,
        memoryFreed: beforeGC.heapUsed - afterGC.heapUsed,
      };

      this.metrics.gcEvents.push(gcEvent);

      // Keep only last 100 GC events
      if (this.metrics.gcEvents.length > 100) {
        this.metrics.gcEvents = this.metrics.gcEvents.slice(-100);
      }

      logger.debug(`[MemoryManager] GC completed: freed ${Math.round(gcEvent.memoryFreed / 1024 / 1024)}MB in ${Math.round(duration)}ms`);
      this.emit('gc:completed', gcEvent);

    } catch (error) {
      logger.error(`[MemoryManager] GC optimization failed: ${error.message}`);
    }
  }

  /**
   * Track a resource for cleanup
   */
  trackResource(type, resource, metadata = {}) {
    if (!this.resources[type]) {
      this.resources[type] = new Set();
    }

    this.resources[type].add(resource);

    // Store metadata for complex resources
    if (metadata && Object.keys(metadata).length > 0) {
      if (!this.resources.metadata) {
        this.resources.metadata = new Map();
      }
      this.resources.metadata.set(resource, { type, ...metadata });
    }

    logger.debug(`[MemoryManager] Tracking ${type} resource`);
  }

  /**
   * Untrack and cleanup a resource
   */
  untrackResource(type, resource) {
    if (this.resources[type]) {
      this.resources[type].delete(resource);
    }

    if (this.resources.metadata) {
      this.resources.metadata.delete(resource);
    }

    logger.debug(`[MemoryManager] Untracked ${type} resource`);
  }

  /**
   * Get current resource counts
   */
  getResourceCounts() {
    const counts = {};

    for (const [type, resources] of Object.entries(this.resources)) {
      if (type !== 'metadata') {
        counts[type] = resources.size;
      }
    }

    // Add process-level metrics
    counts.eventListeners = process.listenerCount ? Object.keys(process._events || {}).length : 0;
    counts.handles = process._getActiveHandles ? process._getActiveHandles().length : 0;
    counts.requests = process._getActiveRequests ? process._getActiveRequests().length : 0;

    return counts;
  }

  /**
   * Cleanup all tracked resources
   */
  cleanupAllResources() {
    logger.info('[MemoryManager] Starting resource cleanup');
    let cleanedCount = 0;

    // Cleanup timers
    for (const timer of this.resources.timers) {
      try {
        clearTimeout(timer);
        cleanedCount++;
      } catch (error) {
        logger.warn(`[MemoryManager] Failed to clear timer: ${error.message}`);
      }
    }
    this.resources.timers.clear();

    // Cleanup intervals
    for (const interval of this.resources.intervals) {
      try {
        clearInterval(interval);
        cleanedCount++;
      } catch (error) {
        logger.warn(`[MemoryManager] Failed to clear interval: ${error.message}`);
      }
    }
    this.resources.intervals.clear();

    // Cleanup event listeners
    for (const [emitter, listeners] of this.resources.eventListeners) {
      try {
        for (const { event, listener } of listeners) {
          emitter.removeListener(event, listener);
          cleanedCount++;
        }
      } catch (error) {
        logger.warn(`[MemoryManager] Failed to remove event listener: ${error.message}`);
      }
    }
    this.resources.eventListeners.clear();

    // Cleanup streams
    for (const stream of this.resources.streams) {
      try {
        if (stream.destroy && typeof stream.destroy === 'function') {
          stream.destroy();
          cleanedCount++;
        }
      } catch (error) {
        logger.warn(`[MemoryManager] Failed to destroy stream: ${error.message}`);
      }
    }
    this.resources.streams.clear();

    // Cleanup connections
    for (const connection of this.resources.connections) {
      try {
        if (connection.close && typeof connection.close === 'function') {
          connection.close();
          cleanedCount++;
        } else if (connection.end && typeof connection.end === 'function') {
          connection.end();
          cleanedCount++;
        }
      } catch (error) {
        logger.warn(`[MemoryManager] Failed to close connection: ${error.message}`);
      }
    }
    this.resources.connections.clear();

    logger.info(`[MemoryManager] Resource cleanup completed: ${cleanedCount} resources cleaned`);
    this.emit('cleanup:completed', { cleanedCount });
  }

  /**
   * Setup event listeners for process events
   */
  setupEventListeners() {
    // Handle process exit
    process.on('exit', () => {
      this.stopMonitoring();
      this.cleanupAllResources();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error(`[MemoryManager] Uncaught exception: ${error.message}`);
      this.emit('error', error);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error(`[MemoryManager] Unhandled promise rejection: ${reason}`);
      this.emit('error', { reason, promise });
    });

    // Handle SIGTERM and SIGINT for graceful shutdown
    ['SIGTERM', 'SIGINT'].forEach(signal => {
      process.on(signal, () => {
        logger.info(`[MemoryManager] Received ${signal}, initiating graceful shutdown`);
        this.stopMonitoring();
        this.cleanupAllResources();
        process.exit(0);
      });
    });
  }

  /**
   * Get comprehensive memory and resource report
   */
  getReport() {
    const currentMetrics = this.collectMemoryMetrics();
    const resourceCounts = this.getResourceCounts();

    return {
      timestamp: Date.now(),
      memory: {
        current: currentMetrics,
        trend: this.metrics.memoryUsage.length > 1 ?
          this.calculateMemoryTrend(this.metrics.memoryUsage.slice(-10)) : null,
        alerts: this.metrics.alerts.slice(-10),
      },
      resources: {
        counts: resourceCounts,
        tracked: Object.fromEntries(
          Object.entries(this.resources)
            .filter(([key]) => key !== 'metadata')
            .map(([key, value]) => [key, value.size]),
        ),
      },
      gc: {
        recent: this.metrics.gcEvents.slice(-5),
        totalEvents: this.metrics.gcEvents.length,
      },
      monitoring: {
        isActive: this.isMonitoring,
        uptime: process.uptime(),
        options: this.options,
      },
    };
  }
}

// Singleton instance
let memoryManager = null;

/**
 * Get or create the memory manager instance
 */
export function getMemoryManager(options = {}) {
  if (!memoryManager) {
    memoryManager = new MemoryResourceManager(options);
  }
  return memoryManager;
}

/**
 * Initialize memory management with default options
 */
export function initializeMemoryManagement(options = {}) {
  const manager = getMemoryManager(options);
  manager.startMonitoring();
  return manager;
}

/**
 * Cleanup and shutdown memory management
 */
export function shutdownMemoryManagement() {
  if (memoryManager) {
    memoryManager.stopMonitoring();
    memoryManager.cleanupAllResources();
    memoryManager.removeAllListeners();
    memoryManager = null;
  }
}

/**
 * Helper function to track a resource
 */
export function trackResource(type, resource, metadata = {}) {
  const manager = getMemoryManager();
  return manager.trackResource(type, resource, metadata);
}

/**
 * Helper function to untrack a resource
 */
export function untrackResource(type, resource) {
  const manager = getMemoryManager();
  return manager.untrackResource(type, resource);
}

/**
 * Get current memory and resource report
 */
export function getMemoryReport() {
  const manager = getMemoryManager();
  return manager.getReport();
}

export default {
  getMemoryManager,
  initializeMemoryManagement,
  shutdownMemoryManagement,
  trackResource,
  untrackResource,
  getMemoryReport,
};
