/**
 * At-birth inheritance is a flat 25% per carried trait (owner ruling
 * 2026-10-27, q138; Equoria-2d55z).
 *
 * Old contract: a parent trait was inherited at a rate set by its rarity
 * (common 50%, rare 15%, legendary 5%, any other or undefined trait 40%) and
 * nudged by the dam's bond score. Owner ruling 2026-10-27 (q138): every trait
 * a parent carries is inherited at a flat 25%, whatever its rarity or the
 * dam's bond. Unchanged: a foal's trait is born hidden unless a parent had it
 * active and revealed (q98), and a Fair or Bad mare still scales every
 * negative-trait roll (Equoria-pw7cm, applyEpigeneticTraitsAtBirthMareHealth).
 *
 * applyEpigeneticTraitsAtBirth is pure; every run is seeded.
 */

import { describe, expect, it } from '@jest/globals';
import { applyEpigeneticTraitsAtBirth } from '../../../utils/applyEpigeneticTraitsAtBirth.mjs';

const SEEDS = Array.from({ length: 4000 }, (_, i) => i + 1);

const birth = (seed, { bondScore = 50, ...extra }) =>
  applyEpigeneticTraitsAtBirth({
    mare: { id: 1, name: 'Test Mare', bondScore },
    lineage: [],
    feedQuality: 50,
    seed,
    ...extra,
  });

const carries = (result, trait) => [...result.positive, ...result.negative, ...result.hidden].includes(trait);

const share = (trait, extra) => SEEDS.filter(seed => carries(birth(seed, extra), trait)).length / SEEDS.length;

describe('inheritance — a flat 25% per carried trait (q138)', () => {
  it.each([
    ['brave', 'common, positive'],
    ['eagerLearner', 'uncommon, positive'],
    ['resilient', 'rare, positive'],
    ['competitive', 'ultra rare, positive'],
    ['heart', 'legendary, positive'],
    ['fearful', 'common, negative'],
  ])('%s (%s) is inherited on about a quarter of births', trait => {
    const rate = share(trait, { damTraits: [trait] });
    expect(rate).toBeGreaterThan(0.23);
    expect(rate).toBeLessThan(0.27);
  });

  it('the dam bond score no longer moves the odds: the same seed gives the same foal', () => {
    for (const seed of SEEDS.slice(0, 300)) {
      const parents = { sireTraits: ['heart', 'fearful'], damTraits: ['brave'] };
      expect(birth(seed, { ...parents, bondScore: 0 })).toEqual(birth(seed, { ...parents, bondScore: 100 }));
    }
  });

  it('a trait carried by both parents is one carried trait: still 25%, not stacked', () => {
    const rate = share('brave', { sireTraits: ['brave'], damTraits: ['brave'] });
    expect(rate).toBeGreaterThan(0.23);
    expect(rate).toBeLessThan(0.27);
  });

  it('a hidden or active parent trait is inherited at the same rate; only visibility differs', () => {
    let hiddenFoals = 0;
    let activeFoals = 0;
    for (const seed of SEEDS) {
      const fromHidden = birth(seed, { damTraits: ['brave'] });
      const fromActive = birth(seed, { damTraits: ['brave'], parentActiveTraits: ['brave'] });
      expect(fromHidden.positive).not.toContain('brave');
      expect(fromActive.hidden).not.toContain('brave');
      expect(carries(fromHidden, 'brave')).toBe(carries(fromActive, 'brave'));
      hiddenFoals += fromHidden.hidden.includes('brave') ? 1 : 0;
      activeFoals += fromActive.positive.includes('brave') ? 1 : 0;
    }
    expect(hiddenFoals).toBe(activeFoals);
    expect(hiddenFoals).toBeGreaterThan(0);
  });

  it('an inherited active trait is born in the array of its ruled polarity (q135)', () => {
    let skittish = 0;
    for (const seed of SEEDS.slice(0, 400)) {
      const foal = birth(seed, { damTraits: ['skittish'], parentActiveTraits: ['skittish'] });
      expect(foal.positive).not.toContain('skittish');
      skittish += foal.negative.includes('skittish') ? 1 : 0;
    }
    expect(skittish).toBeGreaterThan(0);
  });
});
