/**
 * atBirthTraits — pure-function branch-coverage tests (Equoria-rr7)
 *
 * Pure exports (no DB):
 *   evaluateTraitConditions    — 7 condition types + default + all-pass path
 *   checkLineageForDisciplineAffinity — empty guard, 3 discipline-source branches,
 *                                       affinity threshold, catch path
 *   getMostCommonDisciplineFromHistory — null, empty, normal result
 *   getHighestScoringDiscipline        — null, non-object, empty-object, normal result
 *   AT_BIRTH_TRAITS                    — constant structure invariants
 */

import { describe, it, expect } from '@jest/globals';
import {
  AT_BIRTH_TRAITS,
  evaluateTraitConditions,
  checkLineageForDisciplineAffinity,
  getMostCommonDisciplineFromHistory,
  getHighestScoringDiscipline,
} from '../../utils/atBirthTraits.mjs';

// ── AT_BIRTH_TRAITS constant ──────────────────────────────────────────────────

describe('AT_BIRTH_TRAITS', () => {
  it('has a positive section with 4 entries', () => {
    const keys = Object.keys(AT_BIRTH_TRAITS.positive);
    expect(keys).toHaveLength(4);
    for (const key of keys) {
      const trait = AT_BIRTH_TRAITS.positive[key];
      expect(typeof trait.name).toBe('string');
      expect(typeof trait.probability).toBe('number');
      expect(trait.probability).toBeGreaterThan(0);
      expect(trait.probability).toBeLessThanOrEqual(1);
      expect(typeof trait.conditions).toBe('object');
    }
  });

  it('has a negative section with 4 entries', () => {
    const keys = Object.keys(AT_BIRTH_TRAITS.negative);
    expect(keys).toHaveLength(4);
    for (const key of keys) {
      const trait = AT_BIRTH_TRAITS.negative[key];
      expect(typeof trait.name).toBe('string');
      expect(typeof trait.probability).toBe('number');
      expect(trait.probability).toBeGreaterThan(0);
      expect(trait.probability).toBeLessThanOrEqual(1);
    }
  });

  it('includes hardy and inbred as key entries', () => {
    expect(AT_BIRTH_TRAITS.positive.hardy).toBeDefined();
    expect(AT_BIRTH_TRAITS.negative.inbred).toBeDefined();
  });
});

// ── evaluateTraitConditions ───────────────────────────────────────────────────

describe('evaluateTraitConditions()', () => {
  // mareStressMax
  it('returns false when mareStress exceeds mareStressMax', () => {
    expect(evaluateTraitConditions({ mareStressMax: 30 }, { mareStress: 31 })).toBe(false);
  });

  it('returns true when mareStress equals mareStressMax', () => {
    expect(evaluateTraitConditions({ mareStressMax: 30 }, { mareStress: 30 })).toBe(true);
  });

  // mareStressMin
  it('returns false when mareStress is below mareStressMin', () => {
    expect(evaluateTraitConditions({ mareStressMin: 70 }, { mareStress: 69 })).toBe(false);
  });

  it('returns true when mareStress meets mareStressMin', () => {
    expect(evaluateTraitConditions({ mareStressMin: 70 }, { mareStress: 70 })).toBe(true);
  });

  // feedQualityMin
  it('returns false when feedQuality is below feedQualityMin', () => {
    expect(evaluateTraitConditions({ feedQualityMin: 80 }, { feedQuality: 79 })).toBe(false);
  });

  it('returns true when feedQuality meets feedQualityMin', () => {
    expect(evaluateTraitConditions({ feedQualityMin: 80 }, { feedQuality: 80 })).toBe(true);
  });

  // feedQualityMax
  it('returns false when feedQuality exceeds feedQualityMax', () => {
    expect(evaluateTraitConditions({ feedQualityMax: 40 }, { feedQuality: 41 })).toBe(false);
  });

  it('returns true when feedQuality is at feedQualityMax', () => {
    expect(evaluateTraitConditions({ feedQualityMax: 40 }, { feedQuality: 40 })).toBe(true);
  });

  // disciplineSpecialization
  it('returns false when disciplineSpecialization does not match requirement', () => {
    expect(evaluateTraitConditions({ disciplineSpecialization: true }, { disciplineSpecialization: false })).toBe(
      false,
    );
  });

  it('returns true when disciplineSpecialization matches requirement', () => {
    expect(evaluateTraitConditions({ disciplineSpecialization: true }, { disciplineSpecialization: true })).toBe(true);
  });

  // inbreedingDetected
  it('returns false when inbreedingDetected does not match requirement', () => {
    expect(evaluateTraitConditions({ inbreedingDetected: true }, { inbreedingDetected: false })).toBe(false);
  });

  it('returns true when inbreedingDetected matches requirement', () => {
    expect(evaluateTraitConditions({ inbreedingDetected: true }, { inbreedingDetected: true })).toBe(true);
  });

  // noInbreeding
  it('returns false when noInbreeding does not match requirement', () => {
    expect(evaluateTraitConditions({ noInbreeding: true }, { noInbreeding: false })).toBe(false);
  });

  it('returns true when noInbreeding matches requirement', () => {
    expect(evaluateTraitConditions({ noInbreeding: true }, { noInbreeding: true })).toBe(true);
  });

  // default branch — unknown condition logged, does not cause failure
  it('returns true for an unknown condition type (default branch, no-op)', () => {
    expect(evaluateTraitConditions({ unknownConditionXyz: 99 }, { mareStress: 10, feedQuality: 90 })).toBe(true);
  });

  // All conditions satisfied simultaneously
  it('returns true when all conditions are satisfied simultaneously', () => {
    const conditions = {
      mareStressMax: 40,
      feedQualityMin: 70,
      noInbreeding: true,
      disciplineSpecialization: false,
    };
    const actual = {
      mareStress: 20,
      feedQuality: 85,
      noInbreeding: true,
      disciplineSpecialization: false,
    };
    expect(evaluateTraitConditions(conditions, actual)).toBe(true);
  });

  // First failing condition short-circuits
  it('returns false on first failing condition even when later ones would pass', () => {
    // mareStress 50 > 30 → fails on mareStressMax
    expect(
      evaluateTraitConditions({ mareStressMax: 30, feedQualityMin: 50 }, { mareStress: 50, feedQuality: 90 }),
    ).toBe(false);
  });
});

// ── getMostCommonDisciplineFromHistory ────────────────────────────────────────

describe('getMostCommonDisciplineFromHistory()', () => {
  it('returns null for null input', () => {
    expect(getMostCommonDisciplineFromHistory(null)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getMostCommonDisciplineFromHistory([])).toBeNull();
  });

  it('returns null when no competition has a discipline field', () => {
    expect(getMostCommonDisciplineFromHistory([{}, {}])).toBeNull();
  });

  it('returns the most common discipline from competition history', () => {
    const history = [
      { discipline: 'Dressage' },
      { discipline: 'Show Jumping' },
      { discipline: 'Dressage' },
      { discipline: 'Dressage' },
    ];
    expect(getMostCommonDisciplineFromHistory(history)).toBe('Dressage');
  });

  it('returns the single discipline when all competitions share one', () => {
    const history = [{ discipline: 'Eventing' }, { discipline: 'Eventing' }];
    expect(getMostCommonDisciplineFromHistory(history)).toBe('Eventing');
  });
});

// ── getHighestScoringDiscipline ───────────────────────────────────────────────

describe('getHighestScoringDiscipline()', () => {
  it('returns null for null input', () => {
    expect(getHighestScoringDiscipline(null)).toBeNull();
  });

  it('returns null for non-object input (string)', () => {
    expect(getHighestScoringDiscipline('Dressage')).toBeNull();
  });

  it('returns null for empty object (no entries)', () => {
    expect(getHighestScoringDiscipline({})).toBeNull();
  });

  it('returns the discipline with the highest numeric score', () => {
    const scores = { Dressage: 75, 'Show Jumping': 90, Eventing: 60 };
    expect(getHighestScoringDiscipline(scores)).toBe('Show Jumping');
  });

  it('ignores non-numeric score values and returns the numeric winner', () => {
    const scores = { Dressage: 'high', 'Show Jumping': 80 };
    expect(getHighestScoringDiscipline(scores)).toBe('Show Jumping');
  });

  it('returns null when all scores are non-numeric', () => {
    expect(getHighestScoringDiscipline({ Dressage: 'n/a', Eventing: null })).toBeNull();
  });
});

// ── checkLineageForDisciplineAffinity ─────────────────────────────────────────

describe('checkLineageForDisciplineAffinity()', () => {
  // Guard: null / empty
  it('returns {affinity: false} for null ancestors', () => {
    const result = checkLineageForDisciplineAffinity(null);
    expect(result.affinity).toBe(false);
  });

  it('returns {affinity: false} for empty ancestors array', () => {
    const result = checkLineageForDisciplineAffinity([]);
    expect(result.affinity).toBe(false);
  });

  // Method 1: ancestor.discipline field
  it('reads discipline from ancestor.discipline field and detects affinity at >=3', () => {
    const ancestors = [
      { id: 1, name: 'A', discipline: 'Dressage' },
      { id: 2, name: 'B', discipline: 'Dressage' },
      { id: 3, name: 'C', discipline: 'Dressage' },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(true);
    expect(result.discipline).toBe('Dressage');
    expect(result.count).toBe(3);
  });

  // Method 2: ancestor.competitionHistory
  it('reads discipline from ancestor.competitionHistory (getMostCommonDisciplineFromHistory)', () => {
    const ancestors = [
      { id: 1, name: 'A', competitionHistory: [{ discipline: 'Eventing' }, { discipline: 'Eventing' }] },
      { id: 2, name: 'B', competitionHistory: [{ discipline: 'Eventing' }] },
      { id: 3, name: 'C', competitionHistory: [{ discipline: 'Eventing' }] },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(true);
    expect(result.discipline).toBe('Eventing');
  });

  // Method 3: ancestor.disciplineScores
  it('reads discipline from ancestor.disciplineScores (getHighestScoringDiscipline)', () => {
    const ancestors = [
      { id: 1, name: 'A', disciplineScores: { 'Show Jumping': 95, Dressage: 60 } },
      { id: 2, name: 'B', disciplineScores: { 'Show Jumping': 88, Dressage: 55 } },
      { id: 3, name: 'C', disciplineScores: { 'Show Jumping': 91, Dressage: 70 } },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(true);
    expect(result.discipline).toBe('Show Jumping');
  });

  // Affinity NOT met (count < 3)
  it('returns affinity=false when fewer than 3 ancestors share a discipline', () => {
    const ancestors = [
      { id: 1, name: 'A', discipline: 'Dressage' },
      { id: 2, name: 'B', discipline: 'Dressage' },
      { id: 3, name: 'C', discipline: 'Eventing' },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(false);
    expect(result.discipline).toBeNull();
    expect(result.count).toBe(2);
  });

  // No discipline info on any ancestor
  it('returns affinity=false when no ancestors have any discipline info', () => {
    const result = checkLineageForDisciplineAffinity([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);
    expect(result.affinity).toBe(false);
    expect(result.count).toBe(0);
  });

  // Catch path: getter that throws
  it('returns {affinity: false, error} when ancestor getter throws (catch branch)', () => {
    const evil = Object.defineProperty({ id: 99, name: 'Evil' }, 'discipline', {
      get() {
        throw new Error('getter bomb');
      },
      enumerable: true,
    });
    const result = checkLineageForDisciplineAffinity([evil]);
    expect(result.affinity).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});
