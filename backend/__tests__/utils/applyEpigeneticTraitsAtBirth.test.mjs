/**
 * applyEpigeneticTraitsAtBirth — unit tests (Equoria-rr7)
 *
 * Pure function, logger import only. No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import { applyEpigeneticTraitsAtBirth } from '../../utils/applyEpigeneticTraitsAtBirth.mjs';

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
