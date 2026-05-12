/**
 * enhancedMilestoneEvaluationSystem — pure-function branch-coverage tests (Equoria-jkht)
 *
 * Exercises the four pure helpers exported for unit-testing:
 *   calculateBondModifier          — 5 bond-score ranges → 8 branches
 *   calculateTaskConsistencyModifier — 3 independent conditions → 6 branches
 *   calculateCareGapsPenalty       — 2 independent conditions → 4 branches
 *   determineTraitOutcome          — CONFIRM / DENY / random paths → 6 branches
 *
 * No DB calls. No mocks.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateBondModifier,
  calculateTaskConsistencyModifier,
  calculateCareGapsPenalty,
  determineTraitOutcome,
  evaluateEnhancedMilestone,
  MILESTONE_TYPES,
  MILESTONE_TRAIT_POOLS,
  TRAIT_THRESHOLDS,
} from '../../utils/enhancedMilestoneEvaluationSystem.mjs';

// Minimal groomCareHistory stub used by functions that accept it but don't branch on it
const emptyHistory = { totalInteractions: 0, taskDiversity: 0, averageQuality: 0, interactions: [] };

// ─── calculateBondModifier ────────────────────────────────────────────────────

describe('calculateBondModifier()', () => {
  it('returns 2 when bondScore >= 80', () => {
    expect(calculateBondModifier(emptyHistory, 80)).toBe(2);
    expect(calculateBondModifier(emptyHistory, 100)).toBe(2);
  });

  it('returns 1 when 60 <= bondScore < 80', () => {
    expect(calculateBondModifier(emptyHistory, 60)).toBe(1);
    expect(calculateBondModifier(emptyHistory, 79)).toBe(1);
  });

  it('returns 0 when 40 <= bondScore < 60', () => {
    expect(calculateBondModifier(emptyHistory, 40)).toBe(0);
    expect(calculateBondModifier(emptyHistory, 59)).toBe(0);
  });

  it('returns -1 when 20 <= bondScore < 40', () => {
    expect(calculateBondModifier(emptyHistory, 20)).toBe(-1);
    expect(calculateBondModifier(emptyHistory, 39)).toBe(-1);
  });

  it('returns -2 when bondScore < 20', () => {
    expect(calculateBondModifier(emptyHistory, 0)).toBe(-2);
    expect(calculateBondModifier(emptyHistory, 19)).toBe(-2);
  });
});

// ─── calculateTaskConsistencyModifier ────────────────────────────────────────

describe('calculateTaskConsistencyModifier()', () => {
  it('returns 0 when all three conditions are false', () => {
    const h = { totalInteractions: 0, taskDiversity: 0, averageQuality: 0, interactions: [] };
    expect(calculateTaskConsistencyModifier(h)).toBe(0);
  });

  it('returns 1 when only totalInteractions >= 3', () => {
    const h = { totalInteractions: 3, taskDiversity: 0, averageQuality: 0, interactions: [] };
    expect(calculateTaskConsistencyModifier(h)).toBe(1);
  });

  it('returns 1 when only taskDiversity >= 2', () => {
    const h = { totalInteractions: 0, taskDiversity: 2, averageQuality: 0, interactions: [] };
    expect(calculateTaskConsistencyModifier(h)).toBe(1);
  });

  it('returns 1 when only averageQuality > 0.8', () => {
    const h = { totalInteractions: 0, taskDiversity: 0, averageQuality: 0.9, interactions: [] };
    expect(calculateTaskConsistencyModifier(h)).toBe(1);
  });

  it('returns 3 when all three conditions are true', () => {
    const h = { totalInteractions: 5, taskDiversity: 3, averageQuality: 0.95, interactions: [] };
    expect(calculateTaskConsistencyModifier(h)).toBe(3);
  });

  it('returns 2 when two conditions are true', () => {
    const h = { totalInteractions: 3, taskDiversity: 2, averageQuality: 0, interactions: [] };
    expect(calculateTaskConsistencyModifier(h)).toBe(2);
  });
});

// ─── calculateCareGapsPenalty ─────────────────────────────────────────────────

describe('calculateCareGapsPenalty()', () => {
  const dummyWindow = { start: 0, end: 7 };

  it('returns 0 when both conditions are false (interactions present)', () => {
    const h = { totalInteractions: 1, interactions: [{}] };
    expect(calculateCareGapsPenalty(h, dummyWindow)).toBe(0);
  });

  it('returns 1 when only totalInteractions === 0 (but interactions array non-empty)', () => {
    const h = { totalInteractions: 0, interactions: [{}] };
    expect(calculateCareGapsPenalty(h, dummyWindow)).toBe(1);
  });

  it('returns 2 when only interactions.length === 0 (but totalInteractions > 0)', () => {
    const h = { totalInteractions: 1, interactions: [] };
    expect(calculateCareGapsPenalty(h, dummyWindow)).toBe(2);
  });

  it('returns 3 when both conditions are true', () => {
    const h = { totalInteractions: 0, interactions: [] };
    expect(calculateCareGapsPenalty(h, dummyWindow)).toBe(3);
  });
});

// ─── determineTraitOutcome ────────────────────────────────────────────────────

describe('determineTraitOutcome()', () => {
  const milestoneType = MILESTONE_TYPES.IMPRINTING;
  const pool = MILESTONE_TRAIT_POOLS[milestoneType];

  it('returns a positive trait when finalScore >= CONFIRM threshold (3)', () => {
    const result = determineTraitOutcome(TRAIT_THRESHOLDS.CONFIRM, milestoneType);
    expect(result.type).toBe('positive');
    expect(pool.positive).toContain(result.trait);
    expect(result.reasoning).toMatch(/Positive trait confirmed/);
  });

  it('returns a positive trait when finalScore well above threshold', () => {
    const result = determineTraitOutcome(10, milestoneType);
    expect(result.type).toBe('positive');
    expect(pool.positive).toContain(result.trait);
  });

  it('returns a negative trait when finalScore <= DENY threshold (-3)', () => {
    const result = determineTraitOutcome(TRAIT_THRESHOLDS.DENY, milestoneType);
    expect(result.type).toBe('negative');
    expect(pool.negative).toContain(result.trait);
    expect(result.reasoning).toMatch(/Negative trait confirmed/);
  });

  it('returns a negative trait when finalScore well below threshold', () => {
    const result = determineTraitOutcome(-10, milestoneType);
    expect(result.type).toBe('negative');
    expect(pool.negative).toContain(result.trait);
  });

  it('returns a trait from the full candidate pool in the neutral range', () => {
    const result = determineTraitOutcome(0, milestoneType);
    const allTraits = [...pool.positive, ...pool.negative];
    expect(allTraits).toContain(result.trait);
    expect(['positive', 'negative']).toContain(result.type);
    expect(result.reasoning).toMatch(/neutral range/);
  });

  it('works for all milestone types without throwing', () => {
    Object.values(MILESTONE_TYPES).forEach(type => {
      expect(() => determineTraitOutcome(5, type)).not.toThrow();
      expect(() => determineTraitOutcome(-5, type)).not.toThrow();
      expect(() => determineTraitOutcome(0, type)).not.toThrow();
    });
  });
});

// ── evaluateEnhancedMilestone — validation + horse-not-found paths (lines 75-252) ──

describe('evaluateEnhancedMilestone() — safe throw paths', () => {
  it('rejects with "Invalid milestone type" for an unrecognised milestoneType (lines 82-84)', async () => {
    await expect(evaluateEnhancedMilestone(-1, 'invalid_type')).rejects.toThrow('Invalid milestone type: invalid_type');
  });

  it('rejects with "Horse with ID -1 not found" for a valid type but missing horse (lines 97-99)', async () => {
    await expect(evaluateEnhancedMilestone(-1, MILESTONE_TYPES.IMPRINTING)).rejects.toThrow(
      'Horse with ID -1 not found',
    );
  });

  it('rejects for all milestone types when horse does not exist', async () => {
    for (const type of Object.values(MILESTONE_TYPES)) {
      let thrown = false;
      try {
        await evaluateEnhancedMilestone(-1, type);
      } catch {
        thrown = true;
      }
      expect(thrown).toBe(true);
    }
  });
});
