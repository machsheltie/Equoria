/**
 * clusterManager — pure-function branch-coverage tests (Equoria-jkht)
 *
 * Targets getWorkerCount and shouldUseCluster — two pure exported functions.
 * All branches exercised by injecting env and cpuCount via params.
 *
 * Branch map:
 *   getWorkerCount:
 *     default params (env / cpuCount)
 *     WEB_CONCURRENCY set and valid positive int  → uses configured
 *     WEB_CONCURRENCY 0 / negative               → falls back to cpuCount
 *     WEB_CONCURRENCY invalid string              → falls back to cpuCount
 *     cpuCount = 0 with no valid configured       → desired=0 → ||1 → max(1,1)=1
 *   shouldUseCluster:
 *     NODE_ENV === 'test'                         → always false
 *     CLUSTER_ENABLED set to truthy string        → parseBool → true
 *     CLUSTER_ENABLED set to falsy string         → parseBool → false
 *     NODE_ENV === 'production' + workers > 1     → true
 *     NODE_ENV === 'production' + workers === 1   → false
 *     no special env                              → false
 */

import { describe, it, expect } from '@jest/globals';
import { getWorkerCount, shouldUseCluster } from '../../utils/clusterManager.mjs';

// ── getWorkerCount ────────────────────────────────────────────────────────────

describe('getWorkerCount()', () => {
  it('uses default params when called with no arguments', () => {
    const result = getWorkerCount();
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('returns configured count when WEB_CONCURRENCY is a valid positive int', () => {
    expect(getWorkerCount({ env: { WEB_CONCURRENCY: '4' }, cpuCount: 2 })).toBe(4);
  });

  it('returns cpuCount when WEB_CONCURRENCY is 0 (not > 0)', () => {
    expect(getWorkerCount({ env: { WEB_CONCURRENCY: '0' }, cpuCount: 3 })).toBe(3);
  });

  it('returns cpuCount when WEB_CONCURRENCY is negative', () => {
    expect(getWorkerCount({ env: { WEB_CONCURRENCY: '-1' }, cpuCount: 3 })).toBe(3);
  });

  it('returns cpuCount when WEB_CONCURRENCY is an invalid string (NaN)', () => {
    expect(getWorkerCount({ env: { WEB_CONCURRENCY: 'many' }, cpuCount: 2 })).toBe(2);
  });

  it('returns 1 when WEB_CONCURRENCY absent and cpuCount is 0 (|| 1 fallback)', () => {
    expect(getWorkerCount({ env: {}, cpuCount: 0 })).toBe(1);
  });

  it('returns 1 when WEB_CONCURRENCY absent and cpuCount is 1', () => {
    expect(getWorkerCount({ env: {}, cpuCount: 1 })).toBe(1);
  });
});

// ── shouldUseCluster ──────────────────────────────────────────────────────────

describe('shouldUseCluster()', () => {
  it('returns false when NODE_ENV is "test" (guard short-circuit)', () => {
    expect(shouldUseCluster({ NODE_ENV: 'test' })).toBe(false);
  });

  it('returns true when CLUSTER_ENABLED is "true"', () => {
    expect(shouldUseCluster({ CLUSTER_ENABLED: 'true' })).toBe(true);
  });

  it('returns true when CLUSTER_ENABLED is "1"', () => {
    expect(shouldUseCluster({ CLUSTER_ENABLED: '1' })).toBe(true);
  });

  it('returns true when CLUSTER_ENABLED is "yes"', () => {
    expect(shouldUseCluster({ CLUSTER_ENABLED: 'yes' })).toBe(true);
  });

  it('returns false when CLUSTER_ENABLED is "false"', () => {
    expect(shouldUseCluster({ CLUSTER_ENABLED: 'false' })).toBe(false);
  });

  it('returns false when CLUSTER_ENABLED is "0"', () => {
    expect(shouldUseCluster({ CLUSTER_ENABLED: '0' })).toBe(false);
  });

  it('returns true in production with WEB_CONCURRENCY=2 (workers > 1)', () => {
    expect(shouldUseCluster({ NODE_ENV: 'production', WEB_CONCURRENCY: '2' })).toBe(true);
  });

  it('returns false in production with WEB_CONCURRENCY=1 (workers not > 1)', () => {
    expect(shouldUseCluster({ NODE_ENV: 'production', WEB_CONCURRENCY: '1' })).toBe(false);
  });

  it('returns false when env has no NODE_ENV, CLUSTER_ENABLED, or production flag', () => {
    expect(shouldUseCluster({})).toBe(false);
  });

  it('uses default process.env when called with no argument', () => {
    // In the test runner, NODE_ENV='test' → always returns false
    expect(shouldUseCluster()).toBe(false);
  });

  it('returns false when CLUSTER_ENABLED is empty string (parseBool falsy-left || branch)', () => {
    // '' is not undefined → parseBool called; '' || '' → '' → not in truthy list → false
    expect(shouldUseCluster({ CLUSTER_ENABLED: '' })).toBe(false);
  });
});
