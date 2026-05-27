/**
 * applyEpigeneticTraitsAtBirth — unit tests (Equoria-rr7)
 *
 * Pure function, logger import only. No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import { applyEpigeneticTraitsAtBirth } from '../../../utils/applyEpigeneticTraitsAtBirth.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseMare = () => ({ id: 1, stressLevel: 30 });
const emptyLineage = () => [];

const lineageWithDiscipline = (discipline, count = 3) =>
  Array.from({ length: count }, (_, i) => ({ id: i + 100, discipline }));

const lineageWithInbreeding = (id, count = 2) => Array.from({ length: count }, () => ({ id })); // same id repeated = common ancestor

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — return shape', () => {
  it('returns object with positive and negative arrays', () => {
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage: emptyLineage(),
      feedQuality: 50,
      stressLevel: 30,
    });
    expect(Array.isArray(result.positive)).toBe(true);
    expect(Array.isArray(result.negative)).toBe(true);
  });

  it('no duplicates in positive array', () => {
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage: emptyLineage(),
      feedQuality: 50,
      stressLevel: 30,
    });
    const unique = new Set(result.positive);
    expect(unique.size).toBe(result.positive.length);
  });

  it('no duplicates in negative array', () => {
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage: lineageWithInbreeding(999, 5),
      feedQuality: 10,
      stressLevel: 90,
    });
    const unique = new Set(result.negative);
    expect(unique.size).toBe(result.negative.length);
  });
});

// ---------------------------------------------------------------------------
// Stress + feed conditions
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — stress/feed conditions', () => {
  it('low stress + premium feed runs many seeds and usually grants positive traits', () => {
    let foundPositive = false;
    for (let i = 0; i < 50; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: emptyLineage(),
        feedQuality: 90,
        stressLevel: 10,
      });
      if (result.positive.length > 0) {
        foundPositive = true;
        break;
      }
    }
    expect(foundPositive).toBe(true);
  });

  it('positive traits from low stress include resilient or peopleTrusting', () => {
    let found = false;
    for (let i = 0; i < 100; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: emptyLineage(),
        feedQuality: 100,
        stressLevel: 0,
      });
      if (result.positive.includes('resilient') || result.positive.includes('peopleTrusting')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('high stress (>=80) can produce nervous trait in negative array', () => {
    let found = false;
    for (let i = 0; i < 100; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: emptyLineage(),
        feedQuality: 50,
        stressLevel: 90,
      });
      if (result.negative.includes('nervous')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('poor feed quality (<=30) can produce low_immunity trait', () => {
    let found = false;
    for (let i = 0; i < 100; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: emptyLineage(),
        feedQuality: 10,
        stressLevel: 20,
      });
      if (result.negative.includes('low_immunity')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('uses mare.stressLevel when stressLevel param is omitted', () => {
    const mare = { id: 1, stressLevel: 5 };
    const result = applyEpigeneticTraitsAtBirth({
      mare,
      lineage: emptyLineage(),
      feedQuality: 100,
    });
    expect(Array.isArray(result.positive)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Inbreeding detection
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — inbreeding', () => {
  it('inbreeding (repeated ancestor) can produce fragile or reactive trait', () => {
    let found = false;
    for (let i = 0; i < 100; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: lineageWithInbreeding(42, 4), // high severity (count >= 4)
        feedQuality: 50,
        stressLevel: 30,
      });
      if (result.negative.includes('fragile') || result.negative.includes('reactive')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('no inbreeding (empty lineage) does not trigger inbreeding effects', () => {
    // With empty lineage, inbreeding can't occur deterministically
    let inbreedingTraitFound = false;
    for (let i = 0; i < 20; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: emptyLineage(),
        feedQuality: 60,
        stressLevel: 20,
      });
      if (result.negative.includes('fragile') || result.negative.includes('reactive')) {
        inbreedingTraitFound = true;
        break;
      }
    }
    // With no lineage, fragile/reactive from inbreeding should be zero
    expect(inbreedingTraitFound).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Discipline specialization
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — discipline specialization', () => {
  it('3+ ancestors with same discipline can produce discipline affinity trait', () => {
    let found = false;
    for (let i = 0; i < 100; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: lineageWithDiscipline('Dressage', 4),
        feedQuality: 50,
        stressLevel: 20,
      });
      const hasAffinity = result.positive.some(t => t.includes('discipline_affinity'));
      if (hasAffinity) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('4+ ancestors with same discipline can produce legacy_talent', () => {
    let found = false;
    for (let i = 0; i < 100; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: lineageWithDiscipline('Racing', 6),
        feedQuality: 50,
        stressLevel: 20,
      });
      if (result.positive.includes('legacy_talent')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('fewer than 3 ancestors with same discipline does not trigger specialization', () => {
    let affinityFound = false;
    for (let i = 0; i < 20; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: lineageWithDiscipline('Jumping', 2),
        feedQuality: 50,
        stressLevel: 20,
      });
      if (result.positive.some(t => t.includes('discipline_affinity'))) {
        affinityFound = true;
        break;
      }
    }
    expect(affinityFound).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — error handling', () => {
  it('throws when mare is not provided', () => {
    expect(() => applyEpigeneticTraitsAtBirth({ mare: null, lineage: [], feedQuality: 50, stressLevel: 30 })).toThrow();
  });

  it('handles null lineage gracefully (treated as empty)', () => {
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage: null,
      feedQuality: 50,
      stressLevel: 30,
    });
    expect(Array.isArray(result.positive)).toBe(true);
    expect(Array.isArray(result.negative)).toBe(true);
  });

  it('handles missing feedQuality (defaults to 50)', () => {
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage: [],
    });
    expect(Array.isArray(result.positive)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// inbreeding severity branches
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — inbreeding severity branches', () => {
  it('moderate severity (3 occurrences): exercises second ternary true-branch (fragileChance=0.5)', () => {
    // maxCount=3: first ternary (>=4) false → second ternary (>=3) true → severity='moderate'
    let found = false;
    for (let i = 0; i < 200; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: lineageWithInbreeding(55, 3),
        feedQuality: 50,
        stressLevel: 30,
      });
      if (result.negative.includes('fragile') || result.negative.includes('reactive')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('low severity (2 occurrences): exercises both ternary false-branches (fragileChance=0.25, reactiveChance=0.2)', () => {
    // maxCount=2: first ternary (>=4) false → second ternary (>=3) false → severity='low'
    let found = false;
    for (let i = 0; i < 200; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: lineageWithInbreeding(66, 2),
        feedQuality: 50,
        stressLevel: 30,
      });
      if (
        result.negative.includes('fragile') ||
        result.negative.includes('reactive') ||
        result.negative.includes('low_immunity')
      ) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('null ancestor in lineage exercises ancestor&&ancestor.id false-branch in analyzeInbreeding', () => {
    // null ancestor → `ancestor && ancestor.id` is false → skipped
    const lineageWithNull = [null, { id: 10 }, { id: 10 }];
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage: lineageWithNull,
      feedQuality: 50,
      stressLevel: 30,
    });
    expect(Array.isArray(result.positive)).toBe(true);
    expect(Array.isArray(result.negative)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// analyzeDisciplineSpecialization branches
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — analyzeDisciplineSpecialization branches', () => {
  it('3 ancestors with mostCompetedDiscipline exercises that true-branch in analyzeDisciplineSpecialization', () => {
    const lineage = Array.from({ length: 3 }, (_, i) => ({
      id: i + 200,
      mostCompetedDiscipline: 'Racing',
    }));
    let found = false;
    for (let i = 0; i < 100; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage,
        feedQuality: 50,
        stressLevel: 30,
      });
      if (result.positive.some(t => t.includes('discipline_affinity') || t === 'legacy_talent')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('3 ancestors with disciplineScores exercises that true-branch and calls getHighestScoringDiscipline', () => {
    const lineage = Array.from({ length: 3 }, (_, i) => ({
      id: i + 300,
      disciplineScores: { Dressage: 90, Racing: 50 },
    }));
    let found = false;
    for (let i = 0; i < 100; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage,
        feedQuality: 50,
        stressLevel: 30,
      });
      if (result.positive.some(t => t.includes('discipline_affinity'))) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('null ancestor exercises ancestor&&ancestor.discipline false-branch in analyzeDisciplineSpecialization', () => {
    // null → all three `ancestor && ancestor.X` checks in analyzeDisciplineSpecialization are false
    const lineage = [null, { id: 20, discipline: 'Jumping' }];
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage,
      feedQuality: 50,
      stressLevel: 30,
    });
    expect(Array.isArray(result.positive)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getHighestScoringDiscipline branches
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — getHighestScoringDiscipline branches', () => {
  it('string disciplineScores exercises typeof!==object guard true-branch → returns null, no affinity', () => {
    // ancestor.disciplineScores = 'Racing' (string) → typeof 'Racing' !== 'object' is true → null returned
    const lineage = [{ id: 400, disciplineScores: 'Racing' }];
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage,
      feedQuality: 50,
      stressLevel: 30,
    });
    // Only 1 ancestor → count < 3 → no specialization
    expect(result.positive.some(t => t.includes('discipline_affinity'))).toBe(false);
  });

  it('mixed score types exercise typeof score===number false-branch for non-number entries', () => {
    // disciplineScores: { Racing: 'fast', Dressage: 90 }
    // Racing: typeof 'fast' !== 'number' → false branch (skip)
    // Dressage: typeof 90 === 'number' → true branch (counted as highest)
    // 3 ancestors → Dressage count = 3 → specialization triggers
    const lineage = Array.from({ length: 3 }, (_, i) => ({
      id: i + 500,
      disciplineScores: { Racing: 'fast', Dressage: 90 },
    }));
    let found = false;
    for (let i = 0; i < 100; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage,
        feedQuality: 50,
        stressLevel: 30,
      });
      if (result.positive.some(t => t.includes('discipline_affinity_dressage'))) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fallback branches
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — fallback branches', () => {
  it('mare without stressLevel property exercises mare.stressLevel||50 right-branch (defaults to 50)', () => {
    // stressLevel param omitted → stressLevel!==undefined is false → use mare.stressLevel||50
    // mare has no stressLevel key → undefined||50 = 50 (right-branch of || covered)
    const mare = { id: 1 };
    const result = applyEpigeneticTraitsAtBirth({
      mare,
      lineage: emptyLineage(),
      feedQuality: 50,
    });
    expect(Array.isArray(result.positive)).toBe(true);
    expect(Array.isArray(result.negative)).toBe(true);
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Deterministic negative-condition assertions, peopleTrusting/low_immunity
// presence, and disciplineScores-fallback specialization not covered above.
describe('applyEpigeneticTraitsAtBirth — condition coverage (merged from legacy backend/tests, Equoria-wvuin)', () => {
  // statistical retry-loop helper (mirrors legacy approach: ≤(1-p)^25 false-negative)
  function traitAppears(fn, traitName, category = 'positive', maxRuns = 25) {
    for (let i = 0; i < maxRuns; i++) {
      if (fn()[category].includes(traitName)) return true;
    }
    return false;
  }

  it('assigns peopleTrusting trait with low stress and premium feed', () => {
    const mare = { stressLevel: 20 };
    expect(
      traitAppears(() => applyEpigeneticTraitsAtBirth({ mare, feedQuality: 80, stressLevel: 20 }), 'peopleTrusting'),
    ).toBe(true);
  });

  it('does not assign positive traits with high stress (deterministic)', () => {
    const result = applyEpigeneticTraitsAtBirth({ mare: { stressLevel: 50 }, feedQuality: 85, stressLevel: 50 });
    expect(result.positive).not.toContain('resilient');
    expect(result.positive).not.toContain('peopleTrusting');
  });

  it('does not assign positive traits with poor feed quality (deterministic)', () => {
    const result = applyEpigeneticTraitsAtBirth({ mare: { stressLevel: 15 }, feedQuality: 60, stressLevel: 15 });
    expect(result.positive).not.toContain('resilient');
    expect(result.positive).not.toContain('peopleTrusting');
  });

  it('uses disciplineScores when discipline field is not available', () => {
    const lineage = [
      { id: 1, disciplineScores: { Racing: 85, Dressage: 60 } },
      { id: 2, disciplineScores: { Racing: 90, Jumping: 55 } },
      { id: 3, disciplineScores: { Racing: 78, Dressage: 70 } },
      { id: 4, disciplineScores: { Dressage: 80, Racing: 65 } },
    ];
    expect(
      traitAppears(
        () => applyEpigeneticTraitsAtBirth({ mare: { stressLevel: 50 }, lineage, feedQuality: 50, stressLevel: 50 }),
        'discipline_affinity_racing',
      ),
    ).toBe(true);
  });

  it('does not assign discipline traits without sufficient specialization (deterministic)', () => {
    const lineage = [
      { id: 1, discipline: 'Racing' },
      { id: 2, discipline: 'Dressage' },
      { id: 3, discipline: 'Show Jumping' },
      { id: 4, discipline: 'Racing' },
    ];
    const result = applyEpigeneticTraitsAtBirth({
      mare: { stressLevel: 50 },
      lineage,
      feedQuality: 50,
      stressLevel: 50,
    });
    expect(result.positive.filter(t => t.startsWith('discipline_affinity_'))).toHaveLength(0);
    expect(result.positive).not.toContain('legacy_talent');
  });

  it('assigns low_immunity trait with poor nutrition', () => {
    expect(
      traitAppears(
        () =>
          applyEpigeneticTraitsAtBirth({ mare: { stressLevel: 50 }, lineage: [], feedQuality: 25, stressLevel: 50 }),
        'low_immunity',
        'negative',
      ),
    ).toBe(true);
  });

  it('does not duplicate low_immunity even with repeated common ancestor', () => {
    const lineage = [
      { id: 1, name: 'Common Ancestor' },
      { id: 1, name: 'Common Ancestor' },
      { id: 1, name: 'Common Ancestor' },
    ];
    const result = applyEpigeneticTraitsAtBirth({
      mare: { stressLevel: 50 },
      lineage,
      feedQuality: 25,
      stressLevel: 50,
    });
    expect(result.negative.filter(t => t === 'low_immunity').length).toBeLessThanOrEqual(1);
  });
});
