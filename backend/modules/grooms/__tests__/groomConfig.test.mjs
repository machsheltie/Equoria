/**
 * groomConfig — unit tests (Equoria-rr7)
 *
 * Pure constants/config, no imports. No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import GROOM_CONFIG, { ELIGIBLE_FOAL_ENRICHMENT_TASKS, FOAL_GROOMING_TASKS } from '../../../config/groomConfig.mjs';

// ---------------------------------------------------------------------------
// GROOM_CONFIG structure
// ---------------------------------------------------------------------------
describe('GROOM_CONFIG structure', () => {
  it('is a non-null object', () => {
    expect(GROOM_CONFIG).not.toBeNull();
    expect(typeof GROOM_CONFIG).toBe('object');
  });

  it('has BOND_SCORE_MAX of 100', () => {
    expect(GROOM_CONFIG.BOND_SCORE_MAX).toBe(100);
  });

  it('has BOND_SCORE_START of 0', () => {
    expect(GROOM_CONFIG.BOND_SCORE_START).toBe(0);
  });

  it('has positive DAILY_BOND_GAIN', () => {
    expect(typeof GROOM_CONFIG.DAILY_BOND_GAIN).toBe('number');
    expect(GROOM_CONFIG.DAILY_BOND_GAIN).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Age thresholds
// ---------------------------------------------------------------------------
describe('GROOM_CONFIG age thresholds', () => {
  it('FOAL_ENRICHMENT_MAX_AGE is 2', () => {
    expect(GROOM_CONFIG.FOAL_ENRICHMENT_MAX_AGE).toBe(2);
  });

  it('FOAL_GROOMING_MIN_AGE is 1', () => {
    expect(GROOM_CONFIG.FOAL_GROOMING_MIN_AGE).toBe(1);
  });

  it('FOAL_GROOMING_MAX_AGE is 3', () => {
    expect(GROOM_CONFIG.FOAL_GROOMING_MAX_AGE).toBe(3);
  });

  it('GENERAL_GROOMING_MIN_AGE is 3', () => {
    expect(GROOM_CONFIG.GENERAL_GROOMING_MIN_AGE).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Burnout system
// ---------------------------------------------------------------------------
describe('GROOM_CONFIG burnout system', () => {
  it('has BURNOUT_IMMUNITY_THRESHOLD_DAYS of 7', () => {
    expect(GROOM_CONFIG.BURNOUT_IMMUNITY_THRESHOLD_DAYS).toBe(7);
  });

  it('has BURNOUT_RESET_GRACE_DAYS of 2', () => {
    expect(GROOM_CONFIG.BURNOUT_RESET_GRACE_DAYS).toBe(2);
  });

  it('BURNOUT_STATUS has NONE, AT_RISK, IMMUNE', () => {
    expect(GROOM_CONFIG.BURNOUT_STATUS.NONE).toBeDefined();
    expect(GROOM_CONFIG.BURNOUT_STATUS.AT_RISK).toBeDefined();
    expect(GROOM_CONFIG.BURNOUT_STATUS.IMMUNE).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Task arrays
// ---------------------------------------------------------------------------
describe('GROOM_CONFIG task arrays', () => {
  it('ELIGIBLE_FOAL_ENRICHMENT_TASKS is a non-empty array', () => {
    expect(Array.isArray(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS)).toBe(true);
    expect(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS.length).toBeGreaterThan(0);
  });

  it('ELIGIBLE_FOAL_ENRICHMENT_TASKS includes desensitization', () => {
    expect(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS).toContain('desensitization');
  });

  it('ELIGIBLE_FOAL_GROOMING_TASKS is a non-empty array', () => {
    expect(Array.isArray(GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS)).toBe(true);
    expect(GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS.length).toBeGreaterThan(0);
  });

  it('ELIGIBLE_FOAL_GROOMING_TASKS includes hoof_handling', () => {
    expect(GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS).toContain('hoof_handling');
  });

  it('ELIGIBLE_GENERAL_GROOMING_TASKS includes brushing', () => {
    expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS).toContain('brushing');
  });

  it('TASK_CATEGORIES has ENRICHMENT and GROOMING', () => {
    expect(GROOM_CONFIG.TASK_CATEGORIES.ENRICHMENT).toBeDefined();
    expect(GROOM_CONFIG.TASK_CATEGORIES.GROOMING).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Streak config
// ---------------------------------------------------------------------------
describe('GROOM_CONFIG streak config', () => {
  it('FOAL_STREAK_BONUS_THRESHOLD is 7', () => {
    expect(GROOM_CONFIG.FOAL_STREAK_BONUS_THRESHOLD).toBe(7);
  });

  it('FOAL_STREAK_GRACE_DAYS is 2', () => {
    expect(GROOM_CONFIG.FOAL_STREAK_GRACE_DAYS).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Named exports
// ---------------------------------------------------------------------------
describe('named exports', () => {
  it('ELIGIBLE_FOAL_ENRICHMENT_TASKS export equals GROOM_CONFIG value', () => {
    expect(ELIGIBLE_FOAL_ENRICHMENT_TASKS).toEqual(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS);
  });

  it('FOAL_GROOMING_TASKS export equals GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS', () => {
    expect(FOAL_GROOMING_TASKS).toEqual(GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS);
  });
});
