/**
 * groomConfig — unit tests (Equoria-rr7)
 *
 * Pure constants/config, no imports. No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import groomConfig, { eligibleFoalEnrichmentTasks, foalGroomingTasks } from '../../../config/groomConfig.mjs';

// ---------------------------------------------------------------------------
// groomConfig structure
// ---------------------------------------------------------------------------
describe('groomConfig structure', () => {
  it('is a non-null object', () => {
    expect(groomConfig).not.toBeNull();
    expect(typeof groomConfig).toBe('object');
  });

  it('has BOND_SCORE_MAX of 100', () => {
    expect(groomConfig.BOND_SCORE_MAX).toBe(100);
  });

  it('has BOND_SCORE_START of 0', () => {
    expect(groomConfig.BOND_SCORE_START).toBe(0);
  });

  it('has positive DAILY_BOND_GAIN', () => {
    expect(typeof groomConfig.DAILY_BOND_GAIN).toBe('number');
    expect(groomConfig.DAILY_BOND_GAIN).toBeGreaterThan(0);
  });
});

// Equoria-czpa5: the age thresholds (FOAL_ENRICHMENT_MAX_AGE, FOAL_GROOMING_MIN/MAX_AGE,
// GENERAL_GROOMING_MIN_AGE, MIN_AGE_FOR_GROOMING_TASKS), ELIGIBLE_GENERAL_GROOMING_TASKS and
// FOAL_STREAK_BONUS_THRESHOLD had no reader after utils/groomBondingSystem.mjs was deleted
// (Equoria-4twey); they were removed from groomConfig with their assertions.

// ---------------------------------------------------------------------------
// No burnout. Old contract: BURNOUT_IMMUNITY_THRESHOLD_DAYS 7,
// BURNOUT_RESET_GRACE_DAYS 2 and BURNOUT_STATUS {NONE, AT_RISK, IMMUNE}.
// Owner ruling 2026-10-23 (Equoria-0gl9o): there is no burnout, so the grooming
// burnout immunity label and Horse.burnoutStatus are gone.
// The care-streak grace period lives on as FOAL_STREAK_GRACE_DAYS (below).
// ---------------------------------------------------------------------------
describe('groomConfig has no burnout settings', () => {
  it('carries no burnout immunity threshold, burnout grace period or burnout status', () => {
    expect(Object.keys(groomConfig).filter(key => /burnout/i.test(key))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task arrays
// ---------------------------------------------------------------------------
describe('groomConfig task arrays', () => {
  it('ELIGIBLE_FOAL_ENRICHMENT_TASKS is a non-empty array', () => {
    expect(Array.isArray(groomConfig.ELIGIBLE_FOAL_ENRICHMENT_TASKS)).toBe(true);
    expect(groomConfig.ELIGIBLE_FOAL_ENRICHMENT_TASKS.length).toBeGreaterThan(0);
  });

  it('ELIGIBLE_FOAL_ENRICHMENT_TASKS includes desensitization', () => {
    expect(groomConfig.ELIGIBLE_FOAL_ENRICHMENT_TASKS).toContain('desensitization');
  });

  it('ELIGIBLE_FOAL_GROOMING_TASKS is a non-empty array', () => {
    expect(Array.isArray(groomConfig.ELIGIBLE_FOAL_GROOMING_TASKS)).toBe(true);
    expect(groomConfig.ELIGIBLE_FOAL_GROOMING_TASKS.length).toBeGreaterThan(0);
  });

  it('ELIGIBLE_FOAL_GROOMING_TASKS includes hoofHandling', () => {
    expect(groomConfig.ELIGIBLE_FOAL_GROOMING_TASKS).toContain('hoofHandling');
  });
});

// ---------------------------------------------------------------------------
// Streak config
// ---------------------------------------------------------------------------
describe('groomConfig streak config', () => {
  it('FOAL_STREAK_GRACE_DAYS is 2', () => {
    expect(groomConfig.FOAL_STREAK_GRACE_DAYS).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Named exports
// ---------------------------------------------------------------------------
describe('named exports', () => {
  it('ELIGIBLE_FOAL_ENRICHMENT_TASKS export equals groomConfig value', () => {
    expect(eligibleFoalEnrichmentTasks).toEqual(groomConfig.ELIGIBLE_FOAL_ENRICHMENT_TASKS);
  });

  it('foalGroomingTasks export equals groomConfig.ELIGIBLE_FOAL_GROOMING_TASKS', () => {
    expect(foalGroomingTasks).toEqual(groomConfig.ELIGIBLE_FOAL_GROOMING_TASKS);
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Exact task lists/counts and category-separation/uniqueness invariants. The
// age-eligibility cases went with the age thresholds (Equoria-czpa5).
describe('groomConfig — task category invariants & age eligibility (merged from legacy backend/tests, Equoria-wvuin)', () => {
  it('ELIGIBLE_FOAL_ENRICHMENT_TASKS is the exact expected list of 7', () => {
    expect(eligibleFoalEnrichmentTasks).toEqual([
      'desensitization',
      'trustBuilding',
      'showgroundExposure',
      'earlyTouch',
      'gentleTouch',
      'feedingAssistance',
      'environmentExploration',
    ]);
    expect(eligibleFoalEnrichmentTasks).toHaveLength(7);
  });

  it('foalGroomingTasks is the exact expected list of 5', () => {
    expect(foalGroomingTasks).toEqual(['hoofHandling', 'tyingPractice', 'spongeBath', 'coatCheck', 'maneTailGrooming']);
    expect(foalGroomingTasks).toHaveLength(5);
  });

  it('enrichment and grooming task categories do not overlap', () => {
    const enrichmentSet = new Set(eligibleFoalEnrichmentTasks);
    const groomingSet = new Set(foalGroomingTasks);
    const intersection = [...enrichmentSet].filter(t => groomingSet.has(t));
    expect(intersection).toHaveLength(0);
  });

  it('each task category has no internal duplicates', () => {
    expect(new Set(eligibleFoalEnrichmentTasks).size).toBe(eligibleFoalEnrichmentTasks.length);
    expect(new Set(foalGroomingTasks).size).toBe(foalGroomingTasks.length);
  });

  // Owner ruling 2026-10-26 (q87) replaced the old +2: each daily groom adds +5.
  it('DAILY_BOND_GAIN is exactly 5', () => {
    expect(groomConfig.DAILY_BOND_GAIN).toBe(5);
  });
});
