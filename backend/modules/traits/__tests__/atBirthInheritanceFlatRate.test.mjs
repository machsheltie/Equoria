/**
 * At-birth inheritance is a flat 25% per carried trait (owner ruling
 * 2026-10-27, q138; Equoria-2d55z), rolled once for each parent that carries
 * it (owner ruling 2026-10-28, q145).
 *
 * Old contract: a parent trait was inherited at a rate set by its rarity
 * (common 50%, rare 15%, legendary 5%, any other or undefined trait 40%) and
 * nudged by the dam's bond score. Owner ruling 2026-10-27 (q138): every trait
 * a parent carries is inherited at a flat 25%, whatever its rarity or the
 * dam's bond. Unchanged: a foal's trait is born hidden unless a parent had it
 * active and revealed (q98), and a Fair or Bad mare still scales every
 * negative-trait roll (Equoria-pw7cm, applyEpigeneticTraitsAtBirthMareHealth).
 *
 * Old contract (q138 as first built): a trait both parents carry was one
 * carried trait and rolled once, still 25%. Owner ruling 2026-10-28 (q145):
 * one 25% roll per carrying parent, so about 43.75% when both carry it. The
 * mare-health multiplier stays on top of the 25% (q146).
 *
 * applyEpigeneticTraitsAtBirth is pure; every run is seeded or takes a
 * scripted rng.
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

  it('a trait carried by both parents rolls once per parent: about 43.75% (q145)', () => {
    const rate = share('brave', { sireTraits: ['brave'], damTraits: ['brave'] });
    expect(rate).toBeGreaterThan(0.41);
    expect(rate).toBeLessThan(0.47);
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

/** A scripted random source that records how many rolls were taken. */
const scripted = values => {
  const queue = [...values];
  const rng = () => {
    rng.calls += 1;
    if (queue.length === 0) {
      throw new Error('rng called more often than scripted');
    }
    return queue.shift();
  };
  rng.calls = 0;
  return rng;
};

const birthWith = (rng, extra) =>
  applyEpigeneticTraitsAtBirth({
    mare: { id: 1, name: 'Test Mare', bondScore: 50 },
    lineage: [],
    feedQuality: 50,
    rng,
    ...extra,
  });

describe('one 25% roll per carrying parent (q145), scripted rng', () => {
  it('both parents carry the trait: two rolls, and the second parent roll can pass on its own', () => {
    const rng = scripted([0.9, 0.1]);
    const foal = birthWith(rng, { sireTraits: ['brave'], damTraits: ['brave'] });
    expect(rng.calls).toBe(2);
    expect(foal.hidden).toEqual(['brave']);
  });

  it('both parents carry the trait and both rolls miss: not inherited', () => {
    const rng = scripted([0.9, 0.3]);
    const foal = birthWith(rng, { sireTraits: ['brave'], damTraits: ['brave'] });
    expect(rng.calls).toBe(2);
    expect(carries(foal, 'brave')).toBe(false);
  });

  it('both parents pass: the trait is carried once, not twice', () => {
    const rng = scripted([0.1, 0.1]);
    const foal = birthWith(rng, { sireTraits: ['brave'], damTraits: ['brave'] });
    expect(foal.hidden).toEqual(['brave']);
  });

  it.each([
    ['sire', { sireTraits: ['brave'] }],
    ['dam', { damTraits: ['brave'] }],
  ])('only the %s carries the trait: one roll', (_who, parents) => {
    const missed = scripted([0.9]);
    expect(carries(birthWith(missed, parents), 'brave')).toBe(false);
    expect(missed.calls).toBe(1);

    const passed = scripted([0.2]);
    expect(birthWith(passed, parents).hidden).toEqual(['brave']);
    expect(passed.calls).toBe(1);
  });

  it('a negative trait with a Bad mare (x1.5): each roll passes below 37.5%', () => {
    // 0.3 misses the plain 25% but passes 25% x 1.5 = 37.5%.
    const plainOne = scripted([0.3]);
    expect(carries(birthWith(plainOne, { damTraits: ['fearful'] }), 'fearful')).toBe(false);

    const badOne = scripted([0.3]);
    const badFoal = birthWith(badOne, { damTraits: ['fearful'], negativeRollMultiplier: 1.5 });
    expect(badOne.calls).toBe(1);
    expect(badFoal.hidden).toEqual(['fearful']);

    // Both parents carry it: two rolls, each at 37.5%.
    const badBoth = scripted([0.9, 0.36]);
    const bothFoal = birthWith(badBoth, {
      sireTraits: ['fearful'],
      damTraits: ['fearful'],
      negativeRollMultiplier: 1.5,
    });
    expect(badBoth.calls).toBe(2);
    expect(bothFoal.hidden).toEqual(['fearful']);

    const badBothMiss = scripted([0.9, 0.38]);
    expect(
      carries(
        birthWith(badBothMiss, {
          sireTraits: ['fearful'],
          damTraits: ['fearful'],
          negativeRollMultiplier: 1.5,
        }),
        'fearful',
      ),
    ).toBe(false);
  });

  it('the multiplier never touches a positive trait', () => {
    const rng = scripted([0.3]);
    expect(carries(birthWith(rng, { damTraits: ['brave'], negativeRollMultiplier: 1.5 }), 'brave')).toBe(false);
  });
});
