/**
 * Foal birth stats (Equoria-fq9ob; owner rulings 2026-10-28 q204, q247, q248):
 * each of the 12 stats is the parents' average varied by -10%..+10%, each stat
 * rolled on its own, rounded half up, never below 0, never capped.
 *
 * Pure function, seeded RNG; the real-foaling path is in
 * foalLineageStatBonus.integration.test.mjs.
 */

import { describe, expect, it } from '@jest/globals';
import { birthStatVariation, inheritedBaseStats } from '../services/foalBirthStats.mjs';
import { horseStatNames as horseStats } from '../services/foalLineageStatBonus.mjs';

// Deterministic mulberry32 in [0, 1).
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

const allStats = value => Object.fromEntries(horseStats.map(stat => [stat, value]));

describe('inheritedBaseStats', () => {
  it('varies by at most 10% (q247)', () => {
    expect(birthStatVariation).toBe(0.1);
  });

  it('a middle roll gives exactly the parents’ average', () => {
    const sire = { ...allStats(40), speed: 80 };
    const dam = { ...allStats(20), speed: 60 };
    expect(inheritedBaseStats(sire, dam, () => 0.5)).toEqual({ ...allStats(30), speed: 70 });
  });

  it('the lowest roll gives 90% and the highest close to 110% of the average', () => {
    expect(inheritedBaseStats(allStats(100), allStats(100), () => 0)).toEqual(allStats(90));
    expect(inheritedBaseStats(allStats(100), allStats(100), () => 0.999999)).toEqual(allStats(110));
  });

  it('rounds half up (q248)', () => {
    // Average 25 at factor 0.9 is 22.5 -> 23; average 15 at factor 0.9 is 13.5 -> 14.
    expect(inheritedBaseStats(allStats(25), allStats(25), () => 0).speed).toBe(23);
    expect(inheritedBaseStats(allStats(15), allStats(15), () => 0).speed).toBe(14);
  });

  it('is never capped: parents above 100 give a foal above 100', () => {
    expect(inheritedBaseStats(allStats(400), allStats(300), () => 0.5)).toEqual(allStats(350));
  });

  it('is never below 0, and a missing parent stat counts as 0', () => {
    expect(inheritedBaseStats(allStats(-10), allStats(-10), () => 0.5)).toEqual(allStats(0));
    expect(inheritedBaseStats({ speed: 50 }, null, () => 0.5)).toEqual({ ...allStats(0), speed: 25 });
  });

  it('rolls each stat on its own, always within 10% of the average', () => {
    const differentValues = new Set();
    for (let seed = 1; seed <= 200; seed++) {
      const stats = inheritedBaseStats(allStats(100), allStats(60), seeded(seed));
      differentValues.add(new Set(Object.values(stats)).size);
      for (const stat of horseStats) {
        expect(stats[stat]).toBeGreaterThanOrEqual(72);
        expect(stats[stat]).toBeLessThanOrEqual(88);
      }
    }
    // Independent rolls: a foal's 12 stats are not all moved by the same amount.
    expect(Math.max(...differentValues)).toBeGreaterThan(1);
  });
});
