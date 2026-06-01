import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getMemoryManager,
  shutdownMemoryManagement,
  trackResource,
  untrackResource,
  getMemoryReport,
} from '../services/memoryResourceManagementService.mjs';

// Reset the singleton before and after each test
beforeEach(() => {
  shutdownMemoryManagement();
});

afterEach(() => {
  shutdownMemoryManagement();
});

describe('getMemoryManager (singleton)', () => {
  it('returns an object', () => {
    const mgr = getMemoryManager();
    expect(typeof mgr).toBe('object');
    expect(mgr).not.toBeNull();
  });

  it('returns the same instance on repeated calls', () => {
    const a = getMemoryManager();
    const b = getMemoryManager();
    expect(a).toBe(b);
  });

  it('instance is not monitoring by default', () => {
    const mgr = getMemoryManager();
    expect(mgr.isMonitoring).toBe(false);
  });

  it('instance has expected method signatures', () => {
    const mgr = getMemoryManager();
    expect(typeof mgr.startMonitoring).toBe('function');
    expect(typeof mgr.stopMonitoring).toBe('function');
    expect(typeof mgr.collectMemoryMetrics).toBe('function');
    expect(typeof mgr.getResourceCounts).toBe('function');
    expect(typeof mgr.trackResource).toBe('function');
    expect(typeof mgr.untrackResource).toBe('function');
    expect(typeof mgr.getReport).toBe('function');
    expect(typeof mgr.calculateMemoryTrend).toBe('function');
  });

  it('accepts configuration options', () => {
    shutdownMemoryManagement();
    const mgr = getMemoryManager({ memoryThreshold: 100 * 1024 * 1024 });
    expect(mgr.options.memoryThreshold).toBe(100 * 1024 * 1024);
  });
});

describe('shutdownMemoryManagement', () => {
  it('resets the singleton (getMemoryManager returns a new instance after shutdown)', () => {
    const a = getMemoryManager();
    shutdownMemoryManagement();
    const b = getMemoryManager();
    expect(a).not.toBe(b);
  });

  it('stops monitoring if active before shutdown', () => {
    const mgr = getMemoryManager();
    mgr.startMonitoring();
    expect(mgr.isMonitoring).toBe(true);
    shutdownMemoryManagement();
    // original instance should no longer be monitoring
    expect(mgr.isMonitoring).toBe(false);
  });

  it('does not throw when called on an already-null singleton', () => {
    shutdownMemoryManagement();
    expect(() => shutdownMemoryManagement()).not.toThrow();
  });
});

describe('collectMemoryMetrics', () => {
  it('returns an object with required fields', () => {
    const mgr = getMemoryManager();
    const metrics = mgr.collectMemoryMetrics();
    expect(metrics).toHaveProperty('timestamp');
    expect(metrics).toHaveProperty('rss');
    expect(metrics).toHaveProperty('heapTotal');
    expect(metrics).toHaveProperty('heapUsed');
    expect(metrics).toHaveProperty('heapUtilization');
    expect(metrics).toHaveProperty('resourceCounts');
  });

  it('heapUsed is a positive number', () => {
    const mgr = getMemoryManager();
    const { heapUsed } = mgr.collectMemoryMetrics();
    expect(typeof heapUsed).toBe('number');
    expect(heapUsed).toBeGreaterThan(0);
  });

  it('heapUtilization is between 0 and 1', () => {
    const mgr = getMemoryManager();
    const { heapUtilization } = mgr.collectMemoryMetrics();
    expect(heapUtilization).toBeGreaterThan(0);
    expect(heapUtilization).toBeLessThanOrEqual(1);
  });

  it('appends to metrics.memoryUsage', () => {
    const mgr = getMemoryManager();
    expect(mgr.metrics.memoryUsage.length).toBe(0);
    mgr.collectMemoryMetrics();
    expect(mgr.metrics.memoryUsage.length).toBe(1);
    mgr.collectMemoryMetrics();
    expect(mgr.metrics.memoryUsage.length).toBe(2);
  });
});

describe('getResourceCounts', () => {
  it('returns an object', () => {
    const mgr = getMemoryManager();
    const counts = mgr.getResourceCounts();
    expect(typeof counts).toBe('object');
    expect(counts).not.toBeNull();
  });

  it('includes timers and intervals fields', () => {
    const mgr = getMemoryManager();
    const counts = mgr.getResourceCounts();
    expect(counts).toHaveProperty('timers');
    expect(counts).toHaveProperty('intervals');
  });

  it('initial counts are zero for tracked resource types', () => {
    const mgr = getMemoryManager();
    const counts = mgr.getResourceCounts();
    expect(counts.timers).toBe(0);
    expect(counts.intervals).toBe(0);
  });
});

describe('trackResource / untrackResource', () => {
  it('trackResource increases the count for the resource type', () => {
    const mgr = getMemoryManager();
    const fakeTimer = {};
    mgr.trackResource('timers', fakeTimer);
    expect(mgr.resources.timers.has(fakeTimer)).toBe(true);
  });

  it('untrackResource removes the resource', () => {
    const mgr = getMemoryManager();
    const fakeTimer = {};
    mgr.trackResource('timers', fakeTimer);
    mgr.untrackResource('timers', fakeTimer);
    expect(mgr.resources.timers.has(fakeTimer)).toBe(false);
  });

  it('trackResource creates a new set for unknown resource type', () => {
    const mgr = getMemoryManager();
    const fakeResource = { id: 'custom' };
    mgr.trackResource('customType', fakeResource);
    expect(mgr.resources.customType.has(fakeResource)).toBe(true);
  });

  it('trackResource with metadata stores metadata', () => {
    const mgr = getMemoryManager();
    const fakeStream = {};
    mgr.trackResource('streams', fakeStream, { label: 'test-stream' });
    expect(mgr.resources.metadata.get(fakeStream)).toMatchObject({ label: 'test-stream' });
  });

  it('exported trackResource helper delegates to the singleton', () => {
    const fakeInterval = {};
    trackResource('intervals', fakeInterval);
    const mgr = getMemoryManager();
    expect(mgr.resources.intervals.has(fakeInterval)).toBe(true);
  });

  it('exported untrackResource helper delegates to the singleton', () => {
    const mgr = getMemoryManager();
    const fakeInterval = {};
    mgr.trackResource('intervals', fakeInterval);
    untrackResource('intervals', fakeInterval);
    expect(mgr.resources.intervals.has(fakeInterval)).toBe(false);
  });
});

describe('calculateMemoryTrend', () => {
  it('returns slope and correlation', () => {
    const mgr = getMemoryManager();
    const samples = [{ heapUsed: 100 }, { heapUsed: 200 }, { heapUsed: 300 }];
    const trend = mgr.calculateMemoryTrend(samples);
    expect(trend).toHaveProperty('slope');
    expect(trend).toHaveProperty('correlation');
  });

  it('slope is positive for monotonically increasing heap usage', () => {
    const mgr = getMemoryManager();
    const samples = [100, 200, 300, 400, 500].map(heapUsed => ({ heapUsed }));
    const { slope } = mgr.calculateMemoryTrend(samples);
    expect(slope).toBeGreaterThan(0);
  });

  it('slope is negative for monotonically decreasing heap usage', () => {
    const mgr = getMemoryManager();
    const samples = [500, 400, 300, 200, 100].map(heapUsed => ({ heapUsed }));
    const { slope } = mgr.calculateMemoryTrend(samples);
    expect(slope).toBeLessThan(0);
  });

  it('correlation is 1 for perfectly linear increasing data', () => {
    const mgr = getMemoryManager();
    const samples = [100, 200, 300, 400, 500].map(heapUsed => ({ heapUsed }));
    const { correlation } = mgr.calculateMemoryTrend(samples);
    expect(correlation).toBeCloseTo(1, 5);
  });

  it('correlation is -1 for perfectly linear decreasing data', () => {
    const mgr = getMemoryManager();
    const samples = [500, 400, 300, 200, 100].map(heapUsed => ({ heapUsed }));
    const { correlation } = mgr.calculateMemoryTrend(samples);
    expect(correlation).toBeCloseTo(-1, 5);
  });
});

describe('getReport', () => {
  it('returns an object with memory, resources, gc, and monitoring fields', () => {
    const mgr = getMemoryManager();
    const report = mgr.getReport();
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('memory');
    expect(report).toHaveProperty('resources');
    expect(report).toHaveProperty('gc');
    expect(report).toHaveProperty('monitoring');
  });

  it('monitoring.isActive is false for unstarted manager', () => {
    const mgr = getMemoryManager();
    const { monitoring } = mgr.getReport();
    expect(monitoring.isActive).toBe(false);
  });

  it('memory.trend is null when fewer than 2 samples', () => {
    const mgr = getMemoryManager();
    // First call populates exactly 1 sample (via collectMemoryMetrics inside getReport)
    // so trend should be null
    const { memory } = mgr.getReport();
    expect(memory.trend).toBeNull();
  });

  it('memory.trend is set after multiple samples', () => {
    const mgr = getMemoryManager();
    // Collect a few samples first, then call getReport
    for (let i = 0; i < 5; i++) {
      mgr.collectMemoryMetrics();
    }
    const { memory } = mgr.getReport();
    expect(memory.trend).not.toBeNull();
    expect(memory.trend).toHaveProperty('slope');
  });

  it('exported getMemoryReport helper returns a valid report', () => {
    const report = getMemoryReport();
    expect(report).toHaveProperty('monitoring');
    expect(report).toHaveProperty('memory');
  });

  it('gc.totalEvents starts at 0', () => {
    const mgr = getMemoryManager();
    const { gc } = mgr.getReport();
    expect(gc.totalEvents).toBe(0);
  });
});

describe('startMonitoring / stopMonitoring', () => {
  it('startMonitoring sets isMonitoring to true', () => {
    const mgr = getMemoryManager();
    expect(mgr.isMonitoring).toBe(false);
    mgr.startMonitoring();
    expect(mgr.isMonitoring).toBe(true);
    mgr.stopMonitoring(); // cleanup
  });

  it('stopMonitoring sets isMonitoring to false', () => {
    const mgr = getMemoryManager();
    mgr.startMonitoring();
    mgr.stopMonitoring();
    expect(mgr.isMonitoring).toBe(false);
  });

  it('calling startMonitoring twice does not throw', () => {
    const mgr = getMemoryManager();
    mgr.startMonitoring();
    expect(() => mgr.startMonitoring()).not.toThrow();
    mgr.stopMonitoring();
  });

  it('calling stopMonitoring without starting does not throw', () => {
    const mgr = getMemoryManager();
    expect(() => mgr.stopMonitoring()).not.toThrow();
  });
});
