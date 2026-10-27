/**
 * epigeneticTraits — unit tests (Equoria-rr7)
 *
 * No imports, no DB required — completely self-contained pure functions.
 *
 * Old contract: the examples were the 2026-10-19 roster's bold, nervous, lazy
 * and bonded, with bond and situational categories. Owner ruling 2026-10-27
 * (q117) replaced the roster with twenty traits in one category; the examples
 * are now roster traits whose type was already defined (confident, fearful).
 *
 * Old contract: resilient was rarity 'common'. Owner ruling 2026-10-27 (q134)
 * made it 'rare' (and fragile 'uncommon').
 */

import { describe, it, expect } from '@jest/globals';
import {
  getTraitDefinition,
  getTraitsByType,
  getTraitsByCategory,
  getTraitMetadata,
  checkTraitConflict,
} from '../../../utils/epigeneticTraits.mjs';

// Known valid traits from TRAIT_DEFINITIONS
const RESILIENT = 'resilient'; // positive, rare, epigenetic — conflicts: fragile
const CONFIDENT = 'confident'; // positive, common, epigenetic — conflicts: fearful
const FEARFUL = 'fearful'; // negative, common, epigenetic — conflicts: confident
const FRAGILE = 'fragile'; // negative, uncommon, epigenetic — conflicts: resilient

// ---------------------------------------------------------------------------
// getTraitDefinition
// ---------------------------------------------------------------------------
describe('getTraitDefinition', () => {
  it('returns definition for a known positive trait', () => {
    const def = getTraitDefinition(RESILIENT);
    expect(def).not.toBeNull();
    expect(def.type).toBe('positive');
    expect(def.rarity).toBe('rare');
    expect(def.category).toBe('epigenetic');
  });

  it('returns definition for a known negative trait', () => {
    const def = getTraitDefinition(FEARFUL);
    expect(def).not.toBeNull();
    expect(def.type).toBe('negative');
  });

  it('returns null for an unknown trait', () => {
    expect(getTraitDefinition('totallyUnknownTrait')).toBeNull();
  });

  it('includes conflicts array', () => {
    const def = getTraitDefinition(RESILIENT);
    expect(Array.isArray(def.conflicts)).toBe(true);
    expect(def.conflicts).toContain('fragile');
  });

  it('includes description string', () => {
    const def = getTraitDefinition(CONFIDENT);
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
    expect(all).toContain(FEARFUL);
  });

  it('returns only positive traits when type is "positive"', () => {
    const positives = getTraitsByType('positive');
    expect(positives).toContain(RESILIENT);
    expect(positives).toContain(CONFIDENT);
    expect(positives).not.toContain(FEARFUL);
    expect(positives).not.toContain(FRAGILE);
  });

  it('returns only negative traits when type is "negative"', () => {
    const negatives = getTraitsByType('negative');
    expect(negatives).toContain(FEARFUL);
    expect(negatives).toContain(FRAGILE);
    expect(negatives).not.toContain(RESILIENT);
  });

  it('returns empty array for unknown type (no match)', () => {
    const result = getTraitsByType('legendaryUnknownTypeXyz');
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
    expect(epigenetic).toContain(FEARFUL);
  });

  it('every roster trait is a care (epigenetic) trait: no bond or situational traits remain', () => {
    expect(getTraitsByCategory('epigenetic')).toHaveLength(20);
    expect(getTraitsByCategory('bond')).toEqual([]);
    expect(getTraitsByCategory('situational')).toEqual([]);
  });

  it('returns all traits when category is "all"', () => {
    const all = getTraitsByCategory('all');
    expect(all).toContain(RESILIENT);
    expect(all).toContain('heart');
    expect(all).toHaveLength(20);
  });

  it('returns empty array for unknown category', () => {
    const result = getTraitsByCategory('unknownCategory');
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
    expect(meta.rarity).toBe('rare');
    expect(Array.isArray(meta.conflicts)).toBe(true);
  });

  it('returns null for unknown trait', () => {
    expect(getTraitMetadata('noSuchTrait')).toBeNull();
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

  it('returns true for confident vs fearful', () => {
    expect(checkTraitConflict(CONFIDENT, FEARFUL)).toBe(true);
  });

  it('returns false for non-conflicting traits (resilient vs confident)', () => {
    expect(checkTraitConflict(RESILIENT, CONFIDENT)).toBe(false);
  });

  it('returns false for unknown trait pairs', () => {
    expect(checkTraitConflict('unknownA', 'unknownB')).toBe(false);
  });
});
