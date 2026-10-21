/**
 * clusterManager unit tests (Equoria-rr7 coverage sprint).
 *
 * Pure sync exports; no fixture needed. (The schemaValidator and
 * dailyCareAutomation parts went with those dead files, deleted 2026-10-21.)
 */

import { describe, it, expect } from '@jest/globals';
import { getWorkerCount, shouldUseCluster } from '../utils/clusterManager.mjs';

// ── clusterManager ────────────────────────────────────────────────────────────

describe('getWorkerCount', () => {
  it('returns at least 1', () => {
    expect(getWorkerCount()).toBeGreaterThanOrEqual(1);
  });

  it('respects WEB_CONCURRENCY env override', () => {
    const result = getWorkerCount({ env: { WEB_CONCURRENCY: '3' }, cpuCount: 8 });
    expect(result).toBe(3);
  });

  it('falls back to cpuCount when WEB_CONCURRENCY is absent', () => {
    const result = getWorkerCount({ env: {}, cpuCount: 4 });
    expect(result).toBe(4);
  });

  it('clamps to 1 for cpuCount 0', () => {
    const result = getWorkerCount({ env: {}, cpuCount: 0 });
    expect(result).toBe(1);
  });
});

describe('shouldUseCluster', () => {
  it('returns false in test environment', () => {
    expect(shouldUseCluster({ NODE_ENV: 'test' })).toBe(false);
  });

  it('respects CLUSTER_ENABLED=true', () => {
    expect(shouldUseCluster({ CLUSTER_ENABLED: 'true', NODE_ENV: 'production' })).toBe(true);
  });

  it('respects CLUSTER_ENABLED=false', () => {
    expect(shouldUseCluster({ CLUSTER_ENABLED: 'false', NODE_ENV: 'production' })).toBe(false);
  });
});
