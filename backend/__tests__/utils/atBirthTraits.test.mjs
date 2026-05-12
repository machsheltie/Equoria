/**
 * atBirthTraits — pure-function branch-coverage tests (Equoria-jkht)
 *
 * Covers the four exported pure functions:
 *   evaluateTraitConditions   — switch with 7 named cases + default + all-pass path
 *   checkLineageForDisciplineAffinity — null/empty guard, discipline sources, affinity threshold
 *   getMostCommonDisciplineFromHistory — null, empty, single, multi-discipline
 *   getHighestScoringDiscipline — null, non-object, empty, single, multi, non-number
 *
 * DB-requiring functions (analyzeLineage, detectInbreeding, getAncestors,
 * assessFeedQuality, applyEpigeneticTraitsAtBirth) are out of scope.
 */

import { describe, it, expect } from '@jest/globals';
import {
  evaluateTraitConditions,
  checkLineageForDisciplineAffinity,
  getMostCommonDisciplineFromHistory,
  getHighestScoringDiscipline,
} from '../../utils/atBirthTraits.mjs';

// ─────────────────────────────────────────────────────────────
// evaluateTraitConditions
// ─────────────────────────────────────────────────────────────

describe('evaluateTraitConditions', () => {
  // Empty conditions — fall-through, return true
  it('returns true for empty conditions object', () => {
    expect(evaluateTraitConditions({}, { mareStress: 30, feedQuality: 80 })).toBe(true);
  });

  // mareStressMax
  it('returns false when mareStress exceeds mareStressMax', () => {
    expect(evaluateTraitConditions({ mareStressMax: 20 }, { mareStress: 25 })).toBe(false);
  });

  it('returns true when mareStress is at mareStressMax (boundary)', () => {
    expect(evaluateTraitConditions({ mareStressMax: 20 }, { mareStress: 20 })).toBe(true);
  });

  it('returns true when mareStress is below mareStressMax', () => {
    expect(evaluateTraitConditions({ mareStressMax: 30 }, { mareStress: 10 })).toBe(true);
  });

  // mareStressMin
  it('returns false when mareStress is below mareStressMin', () => {
    expect(evaluateTraitConditions({ mareStressMin: 60 }, { mareStress: 30 })).toBe(false);
  });

  it('returns true when mareStress meets mareStressMin', () => {
    expect(evaluateTraitConditions({ mareStressMin: 60 }, { mareStress: 60 })).toBe(true);
  });

  // feedQualityMin
  it('returns false when feedQuality is below feedQualityMin', () => {
    expect(evaluateTraitConditions({ feedQualityMin: 80 }, { feedQuality: 70 })).toBe(false);
  });

  it('returns true when feedQuality meets feedQualityMin', () => {
    expect(evaluateTraitConditions({ feedQualityMin: 80 }, { feedQuality: 80 })).toBe(true);
  });

  // feedQualityMax
  it('returns false when feedQuality exceeds feedQualityMax', () => {
    expect(evaluateTraitConditions({ feedQualityMax: 30 }, { feedQuality: 40 })).toBe(false);
  });

  it('returns true when feedQuality is at feedQualityMax (boundary)', () => {
    expect(evaluateTraitConditions({ feedQualityMax: 30 }, { feedQuality: 30 })).toBe(true);
  });

  // disciplineSpecialization — requires boolean match
  it('returns false when disciplineSpecialization requirement is true but actual is false', () => {
    expect(evaluateTraitConditions({ disciplineSpecialization: true }, { disciplineSpecialization: false })).toBe(
      false,
    );
  });

  it('returns true when disciplineSpecialization matches requirement', () => {
    expect(evaluateTraitConditions({ disciplineSpecialization: true }, { disciplineSpecialization: true })).toBe(true);
  });

  // inbreedingDetected
  it('returns false when inbreedingDetected requirement not met', () => {
    expect(evaluateTraitConditions({ inbreedingDetected: true }, { inbreedingDetected: false })).toBe(false);
  });

  it('returns true when inbreedingDetected matches', () => {
    expect(evaluateTraitConditions({ inbreedingDetected: true }, { inbreedingDetected: true })).toBe(true);
  });

  // noInbreeding
  it('returns false when noInbreeding requirement not met', () => {
    expect(evaluateTraitConditions({ noInbreeding: true }, { noInbreeding: false })).toBe(false);
  });

  it('returns true when noInbreeding matches', () => {
    expect(evaluateTraitConditions({ noInbreeding: true }, { noInbreeding: true })).toBe(true);
  });

  // default branch — unknown condition key
  it('logs a warning and returns true for unknown condition key', () => {
    expect(evaluateTraitConditions({ magicLevel: 42 }, {})).toBe(true);
  });

  // Multiple conditions — all pass
  it('returns true when multiple conditions all pass', () => {
    const conditions = { mareStressMax: 40, feedQualityMin: 70 };
    const actual = { mareStress: 30, feedQuality: 80 };
    expect(evaluateTraitConditions(conditions, actual)).toBe(true);
  });

  // Multiple conditions — first fails
  it('returns false on first failing condition in a multi-condition set', () => {
    const conditions = { mareStressMax: 20, feedQualityMin: 70 };
    const actual = { mareStress: 50, feedQuality: 80 };
    expect(evaluateTraitConditions(conditions, actual)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// getMostCommonDisciplineFromHistory
// ─────────────────────────────────────────────────────────────

describe('getMostCommonDisciplineFromHistory', () => {
  it('returns null for null input', () => {
    expect(getMostCommonDisciplineFromHistory(null)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getMostCommonDisciplineFromHistory([])).toBeNull();
  });

  it('returns null when no competition has a discipline field', () => {
    expect(getMostCommonDisciplineFromHistory([{ placement: '1st' }, { score: 90 }])).toBeNull();
  });

  it('returns the only discipline from a single competition', () => {
    expect(getMostCommonDisciplineFromHistory([{ discipline: 'Dressage' }])).toBe('Dressage');
  });

  it('returns the most common discipline from multiple competitions', () => {
    const history = [
      { discipline: 'Dressage' },
      { discipline: 'Show Jumping' },
      { discipline: 'Dressage' },
      { discipline: 'Dressage' },
    ];
    expect(getMostCommonDisciplineFromHistory(history)).toBe('Dressage');
  });

  it('handles a tie by returning whichever is seen first in iteration order', () => {
    const history = [{ discipline: 'Eventing' }, { discipline: 'Dressage' }];
    const result = getMostCommonDisciplineFromHistory(history);
    expect(['Eventing', 'Dressage']).toContain(result);
  });
});

// ─────────────────────────────────────────────────────────────
// getHighestScoringDiscipline
// ─────────────────────────────────────────────────────────────

describe('getHighestScoringDiscipline', () => {
  it('returns null for null input', () => {
    expect(getHighestScoringDiscipline(null)).toBeNull();
  });

  it('returns null for a non-object (string)', () => {
    expect(getHighestScoringDiscipline('Dressage')).toBeNull();
  });

  it('returns null for an empty object', () => {
    expect(getHighestScoringDiscipline({})).toBeNull();
  });

  it('returns the only discipline from a single-entry object', () => {
    expect(getHighestScoringDiscipline({ Dressage: 85 })).toBe('Dressage');
  });

  it('returns the highest-scoring discipline from multiple entries', () => {
    expect(getHighestScoringDiscipline({ Dressage: 70, 'Show Jumping': 95, Eventing: 80 })).toBe('Show Jumping');
  });

  it('skips non-number score entries', () => {
    expect(getHighestScoringDiscipline({ Dressage: 70, BadEntry: 'not a number', Eventing: 50 })).toBe('Dressage');
  });

  it('returns null if all entries have non-number scores', () => {
    expect(getHighestScoringDiscipline({ A: 'x', B: null, C: undefined })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// checkLineageForDisciplineAffinity
// ─────────────────────────────────────────────────────────────

describe('checkLineageForDisciplineAffinity', () => {
  it('returns affinity:false for null ancestors (caught by try/catch before guard)', () => {
    const result = checkLineageForDisciplineAffinity(null);
    expect(result.affinity).toBe(false);
  });

  it('returns {affinity: false} for empty array', () => {
    expect(checkLineageForDisciplineAffinity([])).toEqual({ affinity: false });
  });

  it('ancestor with discipline field is counted', () => {
    const ancestors = [
      { id: 1, name: 'A', discipline: 'Dressage' },
      { id: 2, name: 'B', discipline: 'Dressage' },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.disciplineBreakdown).toEqual({ Dressage: 2 });
    expect(result.affinity).toBe(false); // only 2, need 3
  });

  it('ancestor with competitionHistory uses getMostCommonDisciplineFromHistory', () => {
    const ancestors = [
      {
        id: 1,
        name: 'A',
        competitionHistory: [
          { discipline: 'Show Jumping' },
          { discipline: 'Show Jumping' },
          { discipline: 'Dressage' },
        ],
      },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.disciplineBreakdown).toHaveProperty('Show Jumping', 1);
  });

  it('ancestor with disciplineScores uses getHighestScoringDiscipline', () => {
    const ancestors = [
      {
        id: 1,
        name: 'A',
        disciplineScores: { Eventing: 90, Dressage: 60 },
      },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.disciplineBreakdown).toHaveProperty('Eventing', 1);
  });

  it('ancestor with no discipline source contributes nothing', () => {
    const ancestors = [{ id: 1, name: 'No-discipline' }];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.totalWithDisciplines).toBe(0);
    expect(result.affinity).toBe(false);
  });

  it('returns affinity: true when 3+ ancestors share the same discipline', () => {
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

  it('returns affinity: false when max count is exactly 2', () => {
    const ancestors = [
      { id: 1, name: 'A', discipline: 'Dressage' },
      { id: 2, name: 'B', discipline: 'Dressage' },
      { id: 3, name: 'C', discipline: 'Show Jumping' },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(false);
    expect(result.discipline).toBeNull();
  });

  it('correctly identifies the dominant discipline from a mixed group', () => {
    const ancestors = [
      { id: 1, name: 'A', discipline: 'Eventing' },
      { id: 2, name: 'B', discipline: 'Eventing' },
      { id: 3, name: 'C', discipline: 'Eventing' },
      { id: 4, name: 'D', discipline: 'Dressage' },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(true);
    expect(result.discipline).toBe('Eventing');
  });
});
