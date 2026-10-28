/**
 * generateStoreHorseTraitRoster (Equoria-i366a). Owner rulings 2026-10-28:
 * q174 (the count may be known, never the names), q241 and q246 (each roster
 * trait rolls its own chance by rarity tier: Common 25%, Uncommon 20%, Rare
 * 15%, Ultra Rare 10%, Legendary 5%; at most 5; at least 1, rolling again
 * until one comes up). The q246 ruling replaced the earlier draw of a uniform
 * count from 1 to 5 with every trait equally likely.
 * Pure function, seeded RNG.
 */

import { describe, it, expect } from '@jest/globals';
import { generateStoreHorseTraitRoster } from '../services/storeHorseTraitRoster.mjs';
import { storeHorseTraitSettings } from '../config/storeHorseTraitSettings.mjs';
import { checkTraitConflict, getTraitDefinition, traitRosterIds } from '../../../utils/epigeneticTraits.mjs';

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

const rarityOf = trait => getTraitDefinition(trait).rarity;

describe('generateStoreHorseTraitRoster', () => {
  it('carries the ruled tier chances, at least 1 and at most 5 traits (q241, q246)', () => {
    expect(storeHorseTraitSettings.tierChance).toEqual({
      common: 0.25,
      uncommon: 0.2,
      rare: 0.15,
      ultraRare: 0.1,
      legendary: 0.05,
    });
    expect(storeHorseTraitSettings.minTraits).toBe(1);
    expect(storeHorseTraitSettings.maxTraits).toBe(5);
    for (const trait of traitRosterIds) {
      expect(storeHorseTraitSettings.traitRarity[trait]).toBe(rarityOf(trait));
    }
  });

  it('every trait is hidden; none is visible', () => {
    const roster = generateStoreHorseTraitRoster(seeded(1));
    expect(roster.positive).toEqual([]);
    expect(roster.negative).toEqual([]);
    expect(roster.hidden.length).toBeGreaterThan(0);
  });

  it('draws only distinct roster traits, never a conflicting pair, 1 to 5 of them', () => {
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
    expect([...counts].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('can draw every roster trait', () => {
    const seen = new Set();
    for (let seed = 1; seed <= 500; seed++) {
      generateStoreHorseTraitRoster(seeded(seed)).hidden.forEach(t => seen.add(t));
    }
    expect([...seen].sort()).toEqual([...traitRosterIds].sort());
  });

  // A constant roll c carries exactly the tiers whose chance is above c.
  it.each([
    [0.22, ['common']],
    [0.17, ['common', 'uncommon']],
    [0.12, ['common', 'uncommon', 'rare']],
    [0.07, ['common', 'uncommon', 'rare', 'ultraRare']],
  ])('a roll of %s carries only the tiers %j, capped at 5', (roll, tiers) => {
    const { hidden } = generateStoreHorseTraitRoster(() => roll);
    expect(hidden).toHaveLength(5);
    for (const trait of hidden) {
      expect(tiers).toContain(rarityOf(trait));
    }
  });

  it('a pass that turns up no trait is rolled again until one comes up', () => {
    // First pass: 19 shuffle draws and 20 trait rolls, every roll a miss.
    const firstPassCalls = traitRosterIds.length - 1 + traitRosterIds.length;
    let calls = 0;
    const rng = () => (calls++ < firstPassCalls ? 0.99 : 0);
    const { hidden } = generateStoreHorseTraitRoster(rng);
    expect(calls).toBeGreaterThan(firstPassCalls);
    expect(hidden).toHaveLength(5);
  });

  it('fails loud rather than hang when the random source never hits', () => {
    expect(() => generateStoreHorseTraitRoster(() => 0.25)).toThrow(/no trait came up/);
  });

  it('commoner tiers turn up more often than rarer ones', () => {
    const perTraitHits = Object.fromEntries(traitRosterIds.map(t => [t, 0]));
    for (let seed = 1; seed <= 3000; seed++) {
      generateStoreHorseTraitRoster(seeded(seed)).hidden.forEach(t => perTraitHits[t]++);
    }
    const tierMean = tier => {
      const traits = traitRosterIds.filter(t => rarityOf(t) === tier);
      return traits.reduce((sum, t) => sum + perTraitHits[t], 0) / traits.length;
    };
    const order = ['common', 'uncommon', 'rare', 'ultraRare', 'legendary'].map(tierMean);
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]).toBeGreaterThan(order[i]);
    }
  });
});
