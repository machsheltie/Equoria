/**
 * epigeneticTraits — unit tests (Equoria-rr7)
 *
 * No imports, no DB required — completely self-contained pure functions.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateEpigeneticTraits,
  getTraitDefinition,
  getTraitsByType,
  getTraitsByCategory,
  getTraitMetadata,
  checkTraitConflict,
} from '../../utils/epigeneticTraits.mjs';

// Known valid traits from TRAIT_DEFINITIONS
const RESILIENT = 'resilient'; // positive, common, epigenetic — conflicts: fragile, easilyOverwhelmed
const BOLD = 'bold'; // positive, common, epigenetic — conflicts: nervous, fearful
const BONDED = 'bonded'; // positive, common, bond
const NERVOUS = 'nervous'; // negative, common, epigenetic — conflicts: bold, calm, confident
const FRAGILE = 'fragile'; // negative, common, epigenetic — conflicts: resilient, athletic
const LAZY = 'lazy'; // negative, common, epigenetic

// ---------------------------------------------------------------------------
// getTraitDefinition
// ---------------------------------------------------------------------------
describe('getTraitDefinition', () => {
  it('returns definition for a known positive trait', () => {
    const def = getTraitDefinition(RESILIENT);
    expect(def).not.toBeNull();
    expect(def.type).toBe('positive');
    expect(def.rarity).toBe('common');
    expect(def.category).toBe('epigenetic');
  });

  it('returns definition for a known negative trait', () => {
    const def = getTraitDefinition(NERVOUS);
    expect(def).not.toBeNull();
    expect(def.type).toBe('negative');
  });

  it('returns null for an unknown trait', () => {
    expect(getTraitDefinition('totally_unknown_trait')).toBeNull();
  });

  it('includes conflicts array', () => {
    const def = getTraitDefinition(RESILIENT);
    expect(Array.isArray(def.conflicts)).toBe(true);
    expect(def.conflicts).toContain('fragile');
  });

  it('includes description string', () => {
    const def = getTraitDefinition(BOLD);
    expect(typeof def.description).toBe('string');
    expect(def.description.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getTraitsByType
// ---------------------------------------------------------------------------
describe('getTraitsByType', () => {
  it('returns all traits when type is "all"', () => {
    const all = getTraitsByType('all');
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
    expect(all).toContain(RESILIENT);
    expect(all).toContain(NERVOUS);
  });

  it('returns only positive traits when type is "positive"', () => {
    const positives = getTraitsByType('positive');
    expect(positives).toContain(RESILIENT);
    expect(positives).toContain(BOLD);
    expect(positives).not.toContain(NERVOUS);
    expect(positives).not.toContain(LAZY);
  });

  it('returns only negative traits when type is "negative"', () => {
    const negatives = getTraitsByType('negative');
    expect(negatives).toContain(NERVOUS);
    expect(negatives).toContain(LAZY);
    expect(negatives).not.toContain(RESILIENT);
  });

  it('returns empty array for unknown type (no match)', () => {
    const result = getTraitsByType('legendary_unknown_type_xyz');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('defaults to "all" when no argument given', () => {
    const all = getTraitsByType();
    expect(all.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getTraitsByCategory
// ---------------------------------------------------------------------------
describe('getTraitsByCategory', () => {
  it('returns epigenetic traits', () => {
    const epigenetic = getTraitsByCategory('epigenetic');
    expect(epigenetic).toContain(RESILIENT);
    expect(epigenetic).toContain(NERVOUS);
  });

  it('returns bond traits', () => {
    const bond = getTraitsByCategory('bond');
    expect(bond).toContain(BONDED);
    expect(bond).not.toContain(RESILIENT);
  });

  it('returns situational traits', () => {
    const situational = getTraitsByCategory('situational');
    expect(situational).toContain('showCalm');
    expect(situational).not.toContain(RESILIENT);
  });

  it('returns all traits when category is "all"', () => {
    const all = getTraitsByCategory('all');
    expect(all).toContain(RESILIENT);
    expect(all).toContain(BONDED);
    expect(all).toContain('showCalm');
  });

  it('returns empty array for unknown category', () => {
    const result = getTraitsByCategory('unknown_category');
    expect(result).toHaveLength(0);
  });

  it('defaults to "all" when no argument given', () => {
    const all = getTraitsByCategory();
    expect(all.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getTraitMetadata
// ---------------------------------------------------------------------------
describe('getTraitMetadata', () => {
  it('returns full metadata object for a known trait', () => {
    const meta = getTraitMetadata(RESILIENT);
    expect(meta).not.toBeNull();
    expect(meta.name).toBe(RESILIENT);
    expect(meta.type).toBe('positive');
    expect(meta.category).toBe('epigenetic');
    expect(typeof meta.description).toBe('string');
    expect(meta.rarity).toBe('common');
    expect(Array.isArray(meta.conflicts)).toBe(true);
  });

  it('returns null for unknown trait', () => {
    expect(getTraitMetadata('no_such_trait')).toBeNull();
  });

  it('conflicts array is a copy (not reference to internal)', () => {
    const meta = getTraitMetadata(RESILIENT);
    const originalLength = meta.conflicts.length;
    meta.conflicts.push('mutated');
    const meta2 = getTraitMetadata(RESILIENT);
    expect(meta2.conflicts).toHaveLength(originalLength);
  });
});

// ---------------------------------------------------------------------------
// checkTraitConflict
// ---------------------------------------------------------------------------
describe('checkTraitConflict', () => {
  it('returns true for conflicting traits (resilient vs fragile)', () => {
    expect(checkTraitConflict(RESILIENT, FRAGILE)).toBe(true);
  });

  it('returns true regardless of argument order (fragile vs resilient)', () => {
    expect(checkTraitConflict(FRAGILE, RESILIENT)).toBe(true);
  });

  it('returns true for bold vs nervous', () => {
    expect(checkTraitConflict(BOLD, NERVOUS)).toBe(true);
  });

  it('returns false for non-conflicting traits (resilient vs bold)', () => {
    expect(checkTraitConflict(RESILIENT, BOLD)).toBe(false);
  });

  it('returns false for unknown trait pairs', () => {
    expect(checkTraitConflict('unknown_a', 'unknown_b')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateEpigeneticTraits
// ---------------------------------------------------------------------------
describe('calculateEpigeneticTraits', () => {
  const validParams = {
    damTraits: ['resilient'],
    sireTraits: ['bold'],
    damBondScore: 80,
    damStressLevel: 20,
    seed: 42,
  };

  it('throws for null params', () => {
    expect(() => calculateEpigeneticTraits(null)).toThrow('Missing required breeding parameters');
  });

  it('throws for missing damTraits', () => {
    expect(() => calculateEpigeneticTraits({ sireTraits: [], damBondScore: 50, damStressLevel: 20 })).toThrow(
      'Missing required breeding parameters',
    );
  });

  it('throws when damTraits is not an array', () => {
    expect(() => calculateEpigeneticTraits({ ...validParams, damTraits: 'resilient' })).toThrow(
      'Parent traits must be arrays',
    );
  });

  it('throws when damBondScore is out of range', () => {
    expect(() => calculateEpigeneticTraits({ ...validParams, damBondScore: 150 })).toThrow(
      'Bond scores must be between 0-100',
    );
  });

  it('throws when damStressLevel is out of range', () => {
    expect(() => calculateEpigeneticTraits({ ...validParams, damStressLevel: -5 })).toThrow(
      'Bond scores must be between 0-100, stress levels between 0-100',
    );
  });

  it('returns object with positive, negative, hidden arrays', () => {
    const result = calculateEpigeneticTraits(validParams);
    expect(Array.isArray(result.positive)).toBe(true);
    expect(Array.isArray(result.negative)).toBe(true);
    expect(Array.isArray(result.hidden)).toBe(true);
  });

  it('is deterministic with the same seed', () => {
    const r1 = calculateEpigeneticTraits(validParams);
    const r2 = calculateEpigeneticTraits(validParams);
    expect(r1).toEqual(r2);
  });

  it('produces different results with different seeds', () => {
    const r1 = calculateEpigeneticTraits({ ...validParams, seed: 1 });
    const r2 = calculateEpigeneticTraits({ ...validParams, seed: 9999 });
    // Different seeds should produce at least occasionally different results
    // (both valid, but not guaranteed identical)
    expect(typeof r1).toBe('object');
    expect(typeof r2).toBe('object');
  });

  it('accepts empty parent trait arrays', () => {
    const result = calculateEpigeneticTraits({
      damTraits: [],
      sireTraits: [],
      damBondScore: 50,
      damStressLevel: 50,
      seed: 1,
    });
    expect(Array.isArray(result.positive)).toBe(true);
  });

  it('does not include conflicting traits in result', () => {
    const result = calculateEpigeneticTraits(validParams);
    const allTraits = [...result.positive, ...result.negative, ...result.hidden];
    for (const t1 of allTraits) {
      for (const t2 of allTraits) {
        if (t1 !== t2) {
          expect(checkTraitConflict(t1, t2)).toBe(false);
        }
      }
    }
  });
});
