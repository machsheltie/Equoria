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
  MILESTONE_TYPES,
  DEVELOPMENTAL_WINDOWS,
  TRAIT_THRESHOLDS,
  MILESTONE_TRAIT_POOLS,
} from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';

// ── enhancedMilestoneEvaluationSystem constants ───────────────────────────────

describe('MILESTONE_TYPES', () => {
  it('contains all five developmental milestone keys', () => {
    expect(MILESTONE_TYPES.IMPRINTING).toBe('imprinting');
    expect(MILESTONE_TYPES.SOCIALIZATION).toBe('socialization');
    expect(MILESTONE_TYPES.CURIOSITY_PLAY).toBe('curiosity_play');
    expect(MILESTONE_TYPES.TRUST_HANDLING).toBe('trust_handling');
    expect(MILESTONE_TYPES.CONFIDENCE_REACTIVITY).toBe('confidence_reactivity');
  });
});

describe('DEVELOPMENTAL_WINDOWS', () => {
  it('imprinting window starts at day 0 and ends at day 1', () => {
    expect(DEVELOPMENTAL_WINDOWS[MILESTONE_TYPES.IMPRINTING].start).toBe(0);
    expect(DEVELOPMENTAL_WINDOWS[MILESTONE_TYPES.IMPRINTING].end).toBe(1);
  });

  it('all windows have start and end values', () => {
    for (const window of Object.values(DEVELOPMENTAL_WINDOWS)) {
      expect(typeof window.start).toBe('number');
      expect(typeof window.end).toBe('number');
      expect(window.end).toBeGreaterThan(window.start);
    }
  });
});

describe('TRAIT_THRESHOLDS', () => {
  it('CONFIRM is 3 and DENY is -3', () => {
    expect(TRAIT_THRESHOLDS.CONFIRM).toBe(3);
    expect(TRAIT_THRESHOLDS.DENY).toBe(-3);
  });
});

describe('MILESTONE_TRAIT_POOLS', () => {
  it('each milestone has positive and negative trait arrays', () => {
    for (const pool of Object.values(MILESTONE_TRAIT_POOLS)) {
      expect(Array.isArray(pool.positive)).toBe(true);
      expect(Array.isArray(pool.negative)).toBe(true);
      expect(pool.positive.length).toBeGreaterThan(0);
      expect(pool.negative.length).toBeGreaterThan(0);
    }
  });
});
