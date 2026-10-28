/**
 * generateStoreHorseTraitRoster (Equoria-i366a; owner rulings 2026-10-22 and
 * 2026-10-28, q174): a store horse carries a random number of hidden traits,
 * up to 5, drawn from the twenty-trait roster. Pure function, seeded RNG.
 */

import { describe, it, expect } from '@jest/globals';
import { generateStoreHorseTraitRoster, storeHorseTraitCount } from '../services/storeHorseTraitRoster.mjs';
import { checkTraitConflict, traitRosterIds } from '../../../utils/epigeneticTraits.mjs';

// Deterministic mulberry32 in [0, 1): well mixed even for consecutive seeds.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

describe('generateStoreHorseTraitRoster', () => {
  it('the count runs 1 to 5 (q174: up to 5)', () => {
    expect(storeHorseTraitCount).toEqual({ min: 1, max: 5 });
  });

  it('every trait is hidden; none is visible', () => {
    const roster = generateStoreHorseTraitRoster(seeded(1));
    expect(roster.positive).toEqual([]);
    expect(roster.negative).toEqual([]);
    expect(roster.hidden.length).toBeGreaterThan(0);
  });

  it('draws only distinct roster traits, never a conflicting pair, within the count', () => {
    const counts = new Set();
    for (let seed = 1; seed <= 500; seed++) {
      const { hidden } = generateStoreHorseTraitRoster(seeded(seed));
      counts.add(hidden.length);
      expect(hidden.length).toBeGreaterThanOrEqual(1);
      expect(hidden.length).toBeLessThanOrEqual(5);
      expect(new Set(hidden).size).toBe(hidden.length);
      for (const trait of hidden) {
        expect(traitRosterIds).toContain(trait);
      }
      for (const a of hidden) {
        for (const b of hidden) {
          expect(checkTraitConflict(a, b)).toBe(false);
        }
      }
    }
    // Every count from 1 to 5 occurs over 500 seeds.
    expect([...counts].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('can draw every roster trait', () => {
    const seen = new Set();
    for (let seed = 1; seed <= 500; seed++) {
      generateStoreHorseTraitRoster(seeded(seed)).hidden.forEach(t => seen.add(t));
    }
    expect([...seen].sort()).toEqual([...traitRosterIds].sort());
  });

  it('the lowest and highest rolls give 1 and 5 traits', () => {
    expect(generateStoreHorseTraitRoster(() => 0).hidden).toHaveLength(1);
    expect(generateStoreHorseTraitRoster(() => 0.999999).hidden).toHaveLength(5);
  });
});
