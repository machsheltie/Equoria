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
// No burnout. Old contract: BURNOUT_IMMUNITY_THRESHOLD_DAYS 7,
// BURNOUT_RESET_GRACE_DAYS 2 and BURNOUT_STATUS {NONE, AT_RISK, IMMUNE}.
// Owner ruling 2026-10-23 (Equoria-0gl9o): there is no burnout, so the grooming
// burnout immunity label and Horse.burnoutStatus are gone.
// The care-streak grace period lives on as FOAL_STREAK_GRACE_DAYS (below).
// ---------------------------------------------------------------------------
describe('GROOM_CONFIG has no burnout settings', () => {
  it('carries no burnout immunity threshold, burnout grace period or burnout status', () => {
    expect(Object.keys(GROOM_CONFIG).filter(key => /burnout/i.test(key))).toEqual([]);
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

  it('ELIGIBLE_FOAL_GROOMING_TASKS includes hoofHandling', () => {
    expect(GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS).toContain('hoofHandling');
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

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Exact task lists/counts, category-separation/uniqueness invariants, and the
// age-eligibility logic not covered above.
describe('groomConfig — task category invariants & age eligibility (merged from legacy backend/tests, Equoria-wvuin)', () => {
  it('ELIGIBLE_FOAL_ENRICHMENT_TASKS is the exact expected list of 7', () => {
    expect(ELIGIBLE_FOAL_ENRICHMENT_TASKS).toEqual([
      'desensitization',
      'trustBuilding',
      'showgroundExposure',
      'earlyTouch',
      'gentleTouch',
      'feedingAssistance',
      'environmentExploration',
    ]);
    expect(ELIGIBLE_FOAL_ENRICHMENT_TASKS).toHaveLength(7);
  });

  it('FOAL_GROOMING_TASKS is the exact expected list of 5', () => {
    expect(FOAL_GROOMING_TASKS).toEqual([
      'hoofHandling',
      'tyingPractice',
      'spongeBath',
      'coatCheck',
      'maneTailGrooming',
    ]);
    expect(FOAL_GROOMING_TASKS).toHaveLength(5);
  });

  it('enrichment and grooming task categories do not overlap', () => {
    const enrichmentSet = new Set(ELIGIBLE_FOAL_ENRICHMENT_TASKS);
    const groomingSet = new Set(FOAL_GROOMING_TASKS);
    const intersection = [...enrichmentSet].filter(t => groomingSet.has(t));
    expect(intersection).toHaveLength(0);
  });

  it('each task category has no internal duplicates', () => {
    expect(new Set(ELIGIBLE_FOAL_ENRICHMENT_TASKS).size).toBe(ELIGIBLE_FOAL_ENRICHMENT_TASKS.length);
    expect(new Set(FOAL_GROOMING_TASKS).size).toBe(FOAL_GROOMING_TASKS.length);
  });

  it('TASK_CATEGORIES maps ENRICHMENT→enrichment and GROOMING→grooming', () => {
    expect(GROOM_CONFIG.TASK_CATEGORIES.ENRICHMENT).toBe('enrichment');
    expect(GROOM_CONFIG.TASK_CATEGORIES.GROOMING).toBe('grooming');
  });

  // Owner ruling 2026-10-26 (q87) replaced the old +2: each daily groom adds +5.
  it('DAILY_BOND_GAIN is exactly 5', () => {
    expect(GROOM_CONFIG.DAILY_BOND_GAIN).toBe(5);
  });

  describe('age-based task eligibility logic', () => {
    it('enrichment eligible for ages 0-2, not 3+', () => {
      for (let age = 0; age <= 2; age++) {
        expect(age <= GROOM_CONFIG.FOAL_ENRICHMENT_MAX_AGE).toBe(true);
      }
      expect(3 <= GROOM_CONFIG.FOAL_ENRICHMENT_MAX_AGE).toBe(false);
    });

    it('foal grooming eligible for ages 1-3, not 0 or 4+', () => {
      expect(0 >= GROOM_CONFIG.FOAL_GROOMING_MIN_AGE).toBe(false);
      for (let age = 1; age <= 3; age++) {
        expect(age >= GROOM_CONFIG.FOAL_GROOMING_MIN_AGE && age <= GROOM_CONFIG.FOAL_GROOMING_MAX_AGE).toBe(true);
      }
      expect(4 <= GROOM_CONFIG.FOAL_GROOMING_MAX_AGE).toBe(false);
    });

    it('general grooming eligible for ages 3+, not 0-2', () => {
      for (let age = 0; age < 3; age++) {
        expect(age >= GROOM_CONFIG.GENERAL_GROOMING_MIN_AGE).toBe(false);
      }
      for (let age = 3; age <= 10; age++) {
        expect(age >= GROOM_CONFIG.GENERAL_GROOMING_MIN_AGE).toBe(true);
      }
    });

    it('ages 1-2 are eligible for BOTH enrichment and grooming (overlap)', () => {
      for (let age = 1; age <= 2; age++) {
        const canEnrichment = age <= GROOM_CONFIG.FOAL_ENRICHMENT_MAX_AGE;
        const canGrooming = age >= GROOM_CONFIG.FOAL_GROOMING_MIN_AGE && age <= GROOM_CONFIG.FOAL_GROOMING_MAX_AGE;
        expect(canEnrichment && canGrooming).toBe(true);
      }
    });
  });
});
