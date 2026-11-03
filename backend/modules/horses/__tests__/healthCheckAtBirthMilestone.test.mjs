/**
 * enhancedMilestoneEvaluationSystem constants unit tests (Equoria-rr7 coverage sprint).
 *
 * The emailVerificationService pure-function cases that used to sit below were
 * misfiled here; they moved unchanged to
 * modules/auth/__tests__/emailVerificationTokenPure.test.mjs (Equoria-7t1tn).
 *
 * All tested functions are pure sync or self-contained with real-DB connectivity.
 * No horse fixture is needed — the pure-sync functions drive coverage.
 *
 * NOTE (Equoria-313oc): the former `atBirthTraits` (Impl B) describe blocks were
 * removed when `utils/atBirthTraits.mjs` was deleted. At-birth trait assignment
 * now lives solely in `utils/applyEpigeneticTraitsAtBirth.mjs` (Impl A), exercised
 * by the foaling-service test suites.
 */

import { describe, it, expect } from '@jest/globals';
import {
  milestoneTypes,
  developmentalWindows,
  traitThresholds,
  milestoneTraitPools,
} from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';

// ── enhancedMilestoneEvaluationSystem constants ───────────────────────────────

describe('milestoneTypes', () => {
  it('contains all five developmental milestone keys', () => {
    expect(milestoneTypes.IMPRINTING).toBe('imprinting');
    expect(milestoneTypes.SOCIALIZATION).toBe('socialization');
    expect(milestoneTypes.curiosityPlay).toBe('curiosityPlay');
    expect(milestoneTypes.trustHandling).toBe('trustHandling');
    expect(milestoneTypes.confidenceReactivity).toBe('confidenceReactivity');
  });
});

describe('developmentalWindows', () => {
  it('imprinting window starts at day 0 and ends at day 1', () => {
    expect(developmentalWindows[milestoneTypes.IMPRINTING].start).toBe(0);
    expect(developmentalWindows[milestoneTypes.IMPRINTING].end).toBe(1);
  });

  it('all windows have start and end values', () => {
    for (const window of Object.values(developmentalWindows)) {
      expect(typeof window.start).toBe('number');
      expect(typeof window.end).toBe('number');
      expect(window.end).toBeGreaterThan(window.start);
    }
  });
});

describe('traitThresholds', () => {
  it('CONFIRM is 3 and DENY is -3', () => {
    expect(traitThresholds.CONFIRM).toBe(3);
    expect(traitThresholds.DENY).toBe(-3);
  });
});

describe('milestoneTraitPools', () => {
  // Owner ruling 2026-11-03 (q335): current-roster traits only. Three milestones
  // have no roster trait of negative polarity, so their negative pool is empty
  // (milestoneTraitPoolsRosterOnly.test.mjs pins the roster-only rule).
  it('each milestone has positive and negative trait arrays, with at least one positive trait', () => {
    for (const pool of Object.values(milestoneTraitPools)) {
      expect(Array.isArray(pool.positive)).toBe(true);
      expect(Array.isArray(pool.negative)).toBe(true);
      expect(pool.positive.length).toBeGreaterThan(0);
    }
  });
});
