/**
 * Infrastructure collections stay bounded (Equoria-cmw85.30, Equoria-hikk1,
 * Equoria-ckfi5).
 *
 *  - SerializationService recorded one serializationTime entry per JSON
 *    response in a Map with no cap or eviction: slow growth for the life of the
 *    process.
 *  - The memory-management service capped memoryUsage and gcEvents but let its
 *    own alerts array grow without bound while memory was under pressure.
 *  - eventBus called setMaxListeners(0), silencing Node's MaxListeners warning,
 *    the early signal for a leaked SSE subscription.
 *
 * Real modules, no mocks. Date.now is stepped for the metrics test only because
 * the metric is keyed by millisecond timestamp.
 */

import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { SerializationService, getPerformanceMetrics } from '../services/apiResponseOptimizationService.mjs';
import { getMemoryManager, shutdownMemoryManagement } from '../services/memoryResourceManagementService.mjs';
import { getListenerCeiling } from '../services/eventBus.mjs';

describe('serializationTime metric (Equoria-cmw85.30)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps a bounded window of recent samples however many responses are serialised', () => {
    let clock = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => clock++);

    for (let i = 0; i < 2500; i++) {
      SerializationService.optimizeResponse({ n: i }, { compress: false });
    }

    const samples = Object.keys(getPerformanceMetrics().serializationTime);
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.length).toBeLessThanOrEqual(1000);
  });
});

describe('memory manager alerts (Equoria-hikk1)', () => {
  afterEach(() => {
    shutdownMemoryManagement();
  });

  it('caps the alerts array and keeps the most recent alerts', () => {
    shutdownMemoryManagement();
    // A 1-byte threshold puts every sample over it: one alert per check.
    const manager = getMemoryManager({ memoryThreshold: 1 });
    manager.collectMemoryMetrics();

    for (let i = 0; i < 250; i++) {
      manager.checkMemoryThresholds();
    }
    const last = manager.metrics.alerts[manager.metrics.alerts.length - 1];
    manager.checkMemoryThresholds();

    expect(manager.metrics.alerts.length).toBeLessThanOrEqual(100);
    expect(manager.metrics.alerts.length).toBeGreaterThanOrEqual(10);
    expect(manager.metrics.alerts[manager.metrics.alerts.length - 2]).toBe(last);
  });
});

describe('eventBus listener ceiling (Equoria-ckfi5)', () => {
  it('keeps a finite ceiling so Node still warns about a runaway subscription count', () => {
    const ceiling = getListenerCeiling();
    // 0 means unlimited, which silences MaxListenersExceededWarning.
    expect(Number.isFinite(ceiling)).toBe(true);
    expect(ceiling).toBeGreaterThan(0);
    expect(ceiling).toBeLessThanOrEqual(1000);
  });
});
