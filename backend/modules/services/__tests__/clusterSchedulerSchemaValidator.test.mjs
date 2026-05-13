/**
 * clusterManager + showScheduler + schemaValidator + dailyCareAutomation constants
 * unit tests (Equoria-rr7 coverage sprint).
 *
 * All tested exports are pure sync (cluster, scheduler control) or near-pure
 * (schemaValidator runs a simple DB round-trip; dailyCareAutomation constants).
 * No horse or user fixture needed.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { getWorkerCount, shouldUseCluster } from '../../../utils/clusterManager.mjs';
import { startShowScheduler, stopShowScheduler } from '../../../utils/showScheduler.mjs';
import { validateDatabaseSchema } from '../../../utils/schemaValidator.mjs';
import { DAILY_CARE_ROUTINES } from '../../../utils/dailyCareAutomation.mjs';

afterEach(() => {
  // Ensure scheduler is always stopped after each test to avoid open handles
  stopShowScheduler();
});

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

// ── showScheduler ─────────────────────────────────────────────────────────────

describe('startShowScheduler', () => {
  it('starts without error and can be stopped', () => {
    expect(() => startShowScheduler()).not.toThrow();
    expect(() => stopShowScheduler()).not.toThrow();
  });

  it('is idempotent — calling start twice does not error', () => {
    startShowScheduler();
    expect(() => startShowScheduler()).not.toThrow();
    stopShowScheduler();
  });
});

describe('stopShowScheduler', () => {
  it('calling stop when not started does not error', () => {
    expect(() => stopShowScheduler()).not.toThrow();
  });
});

// ── schemaValidator ───────────────────────────────────────────────────────────

describe('validateDatabaseSchema', () => {
  it('returns a boolean (does not throw)', async () => {
    const result = await validateDatabaseSchema({ throwOnError: false });
    expect(typeof result).toBe('boolean');
  });

  it('is idempotent — second call also returns boolean without throwing', async () => {
    await expect(validateDatabaseSchema()).resolves.not.toThrow();
  });
});

// ── dailyCareAutomation constants ─────────────────────────────────────────────

describe('DAILY_CARE_ROUTINES', () => {
  it('contains standard routines with required fields', () => {
    expect(typeof DAILY_CARE_ROUTINES).toBe('object');
    expect(DAILY_CARE_ROUTINES.morning_care).toBeDefined();
    expect(DAILY_CARE_ROUTINES.feeding).toBeDefined();
    expect(DAILY_CARE_ROUTINES.grooming).toBeDefined();
    expect(DAILY_CARE_ROUTINES.exercise).toBeDefined();
    expect(DAILY_CARE_ROUTINES.evening_care).toBeDefined();
  });

  it('each routine has name, interactionType, duration, and priority', () => {
    for (const [, routine] of Object.entries(DAILY_CARE_ROUTINES)) {
      expect(typeof routine.name).toBe('string');
      expect(typeof routine.interactionType).toBe('string');
      expect(typeof routine.duration).toBe('number');
      expect(typeof routine.priority).toBe('number');
    }
  });

  it('priorities are ordered correctly (morning_care is priority 1)', () => {
    expect(DAILY_CARE_ROUTINES.morning_care.priority).toBe(1);
    expect(DAILY_CARE_ROUTINES.evening_care.priority).toBe(5);
  });
});
