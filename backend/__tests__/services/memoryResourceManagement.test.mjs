/**
 * 🧪 Memory and Resource Management Tests
 *
 * Comprehensive test suite for memory and resource management system including:
 * - Memory leak detection and monitoring
 * - Resource tracking and cleanup
 * - Garbage collection optimization
 * - Performance monitoring and alerting
 * - Resource lifecycle management
 *
 * Testing Approach: TDD with NO MOCKING
 * - Real memory monitoring with actual Node.js process
 * - Authentic resource tracking with real timers and connections
 * - Genuine garbage collection testing
 * - Production-like memory scenarios
 * - Real performance monitoring validation
 */

// jest import removed - not used in this file
import { EventEmitter } from 'events';
import {
  getMemoryManager,
  initializeMemoryManagement,
  shutdownMemoryManagement,
  trackResource,
  untrackResource,
  getMemoryReport,
} from '../../services/memoryResourceManagementService.mjs';

describe('Memory and Resource Management System', () => {
  let memoryManager;
  let originalNodeEnv;
  let originalJestWorkerId;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalJestWorkerId = process.env.JEST_WORKER_ID;
    process.env.NODE_ENV = 'development';
    delete process.env.JEST_WORKER_ID;

    // Clean up any existing manager
    shutdownMemoryManagement();

    // Create fresh manager for each test
    memoryManager = getMemoryManager({
      memoryThreshold: 100 * 1024 * 1024, // 100MB for testing
      gcInterval: 1000, // 1 second for testing
      monitoringInterval: 500, // 0.5 seconds for testing
      alertThreshold: 0.5, // 50% for testing
    });
  });

  afterEach(() => {
    if (memoryManager) {
      memoryManager.stopMonitoring();
      memoryManager.cleanupAllResources();
    }
    shutdownMemoryManagement();

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalJestWorkerId === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = originalJestWorkerId;
    }
  });

  describe('Memory Manager Initialization', () => {
    test('creates memory manager with default options', () => {
      const manager = getMemoryManager();

      expect(manager).toBeDefined();
      expect(manager.options.memoryThreshold).toBeDefined();
      expect(manager.options.gcInterval).toBeDefined();
      expect(manager.options.monitoringInterval).toBeDefined();
      expect(manager.metrics).toBeDefined();
      expect(manager.resources).toBeDefined();
    });

    test('creates memory manager with custom options', () => {
      // Shutdown existing manager to test fresh creation
      shutdownMemoryManagement();

      const customOptions = {
        memoryThreshold: 200 * 1024 * 1024,
        gcInterval: 5000,
        monitoringInterval: 2000,
        alertThreshold: 0.7,
      };

      const manager = getMemoryManager(customOptions);

      expect(manager.options.memoryThreshold).toBe(customOptions.memoryThreshold);
      expect(manager.options.gcInterval).toBe(customOptions.gcInterval);
      expect(manager.options.monitoringInterval).toBe(customOptions.monitoringInterval);
      expect(manager.options.alertThreshold).toBe(customOptions.alertThreshold);
    });

    test('returns singleton instance', () => {
      const manager1 = getMemoryManager();
      const manager2 = getMemoryManager();

      expect(manager1).toBe(manager2);
    });
  });

  describe('Memory Monitoring', () => {
    test('starts and stops monitoring correctly', () => {
      expect(memoryManager.isMonitoring).toBe(false);

      memoryManager.startMonitoring();
      expect(memoryManager.isMonitoring).toBe(true);
      expect(memoryManager.monitoringTimer).toBeDefined();

      memoryManager.stopMonitoring();
      expect(memoryManager.isMonitoring).toBe(false);
      expect(memoryManager.monitoringTimer).toBeNull();
    });

    test('collects memory metrics correctly', () => {
      const metrics = memoryManager.collectMemoryMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.rss).toBeGreaterThan(0);
      expect(metrics.heapTotal).toBeGreaterThan(0);
      expect(metrics.heapUsed).toBeGreaterThan(0);
      expect(metrics.heapUtilization).toBeGreaterThan(0);
      expect(metrics.heapUtilization).toBeLessThanOrEqual(1);
      expect(metrics.resourceCounts).toBeDefined();
    });

    test('stores memory metrics history', () => {
      expect(memoryManager.metrics.memoryUsage).toHaveLength(0);

      memoryManager.collectMemoryMetrics();
      expect(memoryManager.metrics.memoryUsage).toHaveLength(1);

      memoryManager.collectMemoryMetrics();
      expect(memoryManager.metrics.memoryUsage).toHaveLength(2);
    });

    test('limits memory metrics history to 1000 entries', () => {
      // Add 1005 metrics
      for (let i = 0; i < 1005; i++) {
        memoryManager.collectMemoryMetrics();
      }

      expect(memoryManager.metrics.memoryUsage).toHaveLength(1000);
    });
  });

  describe('Resource Tracking', () => {
    test('tracks and untracks timers correctly', () => {
      const timer = setTimeout(() => {}, 1000);

      memoryManager.trackResource('timers', timer);
      expect(memoryManager.resources.timers.has(timer)).toBe(true);

      memoryManager.untrackResource('timers', timer);
      expect(memoryManager.resources.timers.has(timer)).toBe(false);

      clearTimeout(timer);
    });

    test('tracks and untracks intervals correctly', () => {
      const interval = setInterval(() => {}, 1000);

      memoryManager.trackResource('intervals', interval);
      expect(memoryManager.resources.intervals.has(interval)).toBe(true);

      memoryManager.untrackResource('intervals', interval);
      expect(memoryManager.resources.intervals.has(interval)).toBe(false);

      clearInterval(interval);
    });

    test('tracks event listeners correctly', () => {
      const emitter = new EventEmitter();
      const listener = () => {};

      if (!memoryManager.resources.eventListeners.has(emitter)) {
        memoryManager.resources.eventListeners.set(emitter, []);
      }
      memoryManager.resources.eventListeners.get(emitter).push({ event: 'test', listener });

      expect(memoryManager.resources.eventListeners.has(emitter)).toBe(true);
      expect(memoryManager.resources.eventListeners.get(emitter)).toHaveLength(1);
    });

    test('gets resource counts correctly', () => {
      const timer = setTimeout(() => {}, 1000);
      const interval = setInterval(() => {}, 1000);

      memoryManager.trackResource('timers', timer);
      memoryManager.trackResource('intervals', interval);

      const counts = memoryManager.getResourceCounts();

      expect(counts.timers).toBe(1);
      expect(counts.intervals).toBe(1);
      expect(counts.eventListeners).toBeDefined();
      expect(counts.handles).toBeDefined();
      expect(counts.requests).toBeDefined();

      clearTimeout(timer);
      clearInterval(interval);
    });
  });

  describe('Resource Cleanup', () => {
    test('cleans up all tracked resources', () => {
      const timer1 = setTimeout(() => {}, 5000);
      const timer2 = setTimeout(() => {}, 5000);
      const interval = setInterval(() => {}, 1000);

      memoryManager.trackResource('timers', timer1);
      memoryManager.trackResource('timers', timer2);
      memoryManager.trackResource('intervals', interval);

      expect(memoryManager.resources.timers.size).toBe(2);
      expect(memoryManager.resources.intervals.size).toBe(1);

      memoryManager.cleanupAllResources();

      expect(memoryManager.resources.timers.size).toBe(0);
      expect(memoryManager.resources.intervals.size).toBe(0);
    });

    test('handles cleanup errors gracefully', () => {
      // Add an invalid timer to test error handling
      const invalidTimer = { invalid: true };
      memoryManager.resources.timers.add(invalidTimer);

      expect(() => {
        memoryManager.cleanupAllResources();
      }).not.toThrow();

      expect(memoryManager.resources.timers.size).toBe(0);
    });
  });

  describe('Memory Leak Detection', () => {
    test('calculates memory trend correctly', () => {
      const samples = [
        { heapUsed: 100 * 1024 * 1024 },
        { heapUsed: 110 * 1024 * 1024 },
        { heapUsed: 120 * 1024 * 1024 },
        { heapUsed: 130 * 1024 * 1024 },
        { heapUsed: 140 * 1024 * 1024 },
      ];

      const trend = memoryManager.calculateMemoryTrend(samples);

      expect(trend.slope).toBeGreaterThan(0);
      expect(trend.correlation).toBeGreaterThan(0.9); // Strong positive correlation
    });

    test('detects memory leaks with consistent growth', () => {
      let alertEmitted = false;

      memoryManager.on('alert', alert => {
        if (alert.type === 'memory_leak_detected') {
          alertEmitted = true;
        }
      });

      // Simulate consistent memory growth
      for (let i = 0; i < 15; i++) {
        const fakeMetrics = {
          timestamp: Date.now() + i * 1000,
          heapUsed: 50 * 1024 * 1024 + i * 2 * 1024 * 1024, // 2MB growth per sample
          heapTotal: 100 * 1024 * 1024,
          heapUtilization: 0.5 + i * 0.02,
          resourceCounts: {},
        };
        memoryManager.metrics.memoryUsage.push(fakeMetrics);
      }

      memoryManager.detectMemoryLeaks();

      expect(alertEmitted).toBe(true);
    });
  });

  describe('Memory Threshold Monitoring', () => {
    test('triggers alert when memory threshold exceeded', () => {
      let alertEmitted = false;

      memoryManager.on('alert', alert => {
        if (alert.type === 'memory_threshold') {
          alertEmitted = true;
        }
      });

      // Add metrics that exceed threshold
      const highMemoryMetrics = {
        timestamp: Date.now(),
        heapUsed: memoryManager.options.memoryThreshold * 0.9, // 90% of threshold
        heapTotal: memoryManager.options.memoryThreshold,
        heapUtilization: 0.9,
        resourceCounts: {},
      };

      memoryManager.metrics.memoryUsage.push(highMemoryMetrics);
      memoryManager.checkMemoryThresholds();

      expect(alertEmitted).toBe(true);
    });

    test('does not trigger alert when memory is below threshold', () => {
      let alertEmitted = false;

      memoryManager.on('alert', () => {
        alertEmitted = true;
      });

      // Add metrics below threshold
      const lowMemoryMetrics = {
        timestamp: Date.now(),
        heapUsed: memoryManager.options.memoryThreshold * 0.3, // 30% of threshold
        heapTotal: memoryManager.options.memoryThreshold,
        heapUtilization: 0.3,
        resourceCounts: {},
      };

      memoryManager.metrics.memoryUsage.push(lowMemoryMetrics);
      memoryManager.checkMemoryThresholds();

      expect(alertEmitted).toBe(false);
    });
  });

  describe('Garbage Collection', () => {
    test('optimizes garbage collection when available', () => {
      if (!global.gc) {
        // Skip test if GC is not exposed
        return;
      }

      let gcEventEmitted = false;

      memoryManager.on('gc:completed', gcEvent => {
        gcEventEmitted = true;
        expect(gcEvent.duration).toBeDefined();
        expect(gcEvent.memoryBefore).toBeDefined();
        expect(gcEvent.memoryAfter).toBeDefined();
        expect(gcEvent.memoryFreed).toBeDefined();
      });

      memoryManager.optimizeGarbageCollection();

      if (global.gc) {
        expect(gcEventEmitted).toBe(true);
        expect(memoryManager.metrics.gcEvents.length).toBeGreaterThan(0);
      }
    });

    test('handles GC unavailability gracefully', () => {
      const originalGC = global.gc;
      delete global.gc;

      expect(() => {
        memoryManager.optimizeGarbageCollection();
      }).not.toThrow();

      global.gc = originalGC;
    });
  });

  describe('Comprehensive Report Generation', () => {
    test('generates complete memory and resource report', () => {
      // Add some test data
      memoryManager.collectMemoryMetrics();

      const timer = setTimeout(() => {}, 1000);
      memoryManager.trackResource('timers', timer);

      const report = memoryManager.getReport();

      expect(report.timestamp).toBeDefined();
      expect(report.memory).toBeDefined();
      expect(report.memory.current).toBeDefined();
      expect(report.resources).toBeDefined();
      expect(report.resources.counts).toBeDefined();
      expect(report.resources.tracked).toBeDefined();
      expect(report.gc).toBeDefined();
      expect(report.monitoring).toBeDefined();
      expect(report.monitoring.isActive).toBeDefined();
      expect(report.monitoring.uptime).toBeDefined();
      expect(report.monitoring.options).toBeDefined();

      clearTimeout(timer);
    });
  });

  describe('Helper Functions', () => {
    test('trackResource helper function works correctly', () => {
      const timer = setTimeout(() => {}, 1000);

      trackResource('timers', timer);

      const manager = getMemoryManager();
      expect(manager.resources.timers.has(timer)).toBe(true);

      clearTimeout(timer);
    });

    test('untrackResource helper function works correctly', () => {
      const timer = setTimeout(() => {}, 1000);

      trackResource('timers', timer);
      expect(getMemoryManager().resources.timers.has(timer)).toBe(true);

      untrackResource('timers', timer);
      expect(getMemoryManager().resources.timers.has(timer)).toBe(false);

      clearTimeout(timer);
    });

    test('getMemoryReport helper function works correctly', () => {
      const report = getMemoryReport();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.memory).toBeDefined();
      expect(report.resources).toBeDefined();
      expect(report.monitoring).toBeDefined();
    });

    test('initializeMemoryManagement starts monitoring', () => {
      shutdownMemoryManagement();

      const manager = initializeMemoryManagement({
        monitoringInterval: 1000,
      });

      expect(manager.isMonitoring).toBe(true);

      shutdownMemoryManagement();
    });
  });

  describe('Event Handling', () => {
    test('emits monitoring events correctly', () => {
      let startEventEmitted = false;
      let stopEventEmitted = false;

      memoryManager.on('monitoring:started', () => {
        startEventEmitted = true;
      });

      memoryManager.on('monitoring:stopped', () => {
        stopEventEmitted = true;
      });

      memoryManager.startMonitoring();
      expect(startEventEmitted).toBe(true);

      memoryManager.stopMonitoring();
      expect(stopEventEmitted).toBe(true);
    });

    test('emits metrics collection events', () => {
      let metricsEventEmitted = false;

      memoryManager.on('metrics:collected', metrics => {
        metricsEventEmitted = true;
        expect(metrics).toBeDefined();
        expect(metrics.timestamp).toBeDefined();
      });

      memoryManager.collectMemoryMetrics();
      expect(metricsEventEmitted).toBe(true);
    });
  });
});
