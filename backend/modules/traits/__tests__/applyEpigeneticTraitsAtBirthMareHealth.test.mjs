/**
 * Owner rulings 2026-10-26 (q80 / Equoria-pw7cm, Equoria-b76x0):
 *  - a Fair mare multiplies EVERY negative foal-trait roll by 1.25 and a Bad
 *    mare by 1.5 (the pregnancy roll was done earlier; this covers the rolls
 *    inside applyEpigeneticTraitsAtBirth);
 *  - there is NO stress: a mare's stress never decides a trait.
 *
 * applyEpigeneticTraitsAtBirth() is pure; every run here is seeded, so each
 * assertion is deterministic.
 */

import { describe, expect, it } from '@jest/globals';
import { applyEpigeneticTraitsAtBirth } from '../../../utils/applyEpigeneticTraitsAtBirth.mjs';

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

const run = (seed, extra = {}) =>
  applyEpigeneticTraitsAtBirth({
    mare: { id: 1, name: 'Test Mare', bondScore: 50 },
    lineage: [],
    seed,
    ...extra,
  });

const allNegative = result => [...result.negative, ...result.hidden];

// Three ancestors with one id repeated 4 times: high inbreeding.
const inbredLineage = Array.from({ length: 4 }, () => ({ id: 77 }));
// One id repeated 3 times: moderate inbreeding (fragile at 0.5, so x1.25 and
// x1.5 stay below certainty and each step can add foals).
const moderateLineage = Array.from({ length: 3 }, () => ({ id: 78 }));

// Old contract: these cases used the poor-feed lowImmunity roll and the
// inbreeding reactive/lowImmunity rolls. Owner ruling 2026-10-27 (q117) took
// those traits off the roster, so the rolls are gone; the multiplier is proven
// on the negative rolls that remain (an inherited negative trait, and the
// inbreeding fragile roll).

describe('negative foal-trait rolls scale with the mare health multiplier', () => {
  it('an inherited negative trait lands at least as often, and more often overall, with a x1.5 mare', () => {
    let base = 0;
    let scaled = 0;
    const parent = { feedQuality: 60, damTraits: ['fragile'] };
    for (const seed of SEEDS) {
      const plain = allNegative(run(seed, parent)).includes('fragile');
      const bad = allNegative(run(seed, { ...parent, negativeRollMultiplier: 1.5 })).includes('fragile');
      if (plain) {
        expect(bad).toBe(true);
        base += 1;
      }
      scaled += bad ? 1 : 0;
    }
    expect(scaled).toBeGreaterThan(base);
  });

  it('the inbreeding fragile roll scales too', () => {
    const count = multiplier =>
      SEEDS.reduce((sum, seed) => {
        const traits = allNegative(
          run(seed, { feedQuality: 60, lineage: moderateLineage, negativeRollMultiplier: multiplier }),
        );
        return sum + traits.length;
      }, 0);
    expect(count(1.25)).toBeGreaterThan(count(1));
    expect(count(1.5)).toBeGreaterThan(count(1.25));
  });

  it('a multiplier of 1 (or none) leaves the odds untouched', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      expect(run(seed, { feedQuality: 20, lineage: inbredLineage })).toEqual(
        run(seed, { feedQuality: 20, lineage: inbredLineage, negativeRollMultiplier: 1 }),
      );
    }
  });
});

describe('no stress in the foal trait pipeline', () => {
  it('a mare row that still carries a stress value never produces a stress-driven trait', () => {
    for (const seed of SEEDS) {
      const traits = applyEpigeneticTraitsAtBirth({
        mare: { id: 1, name: 'Old Row', bondScore: 50, stressLevel: 100 },
        stressLevel: 100,
        lineage: [],
        feedQuality: 60,
        seed,
      });
      expect(allNegative(traits)).not.toContain('nervous');
    }
  });

  it('a calm-or-not mare does not matter: well-kept-mare feed alone decides resilient (q175)', () => {
    const born = stress =>
      SEEDS.map(seed =>
        applyEpigeneticTraitsAtBirth({
          mare: { id: 1, name: 'Mare', bondScore: 50, stressLevel: stress },
          stressLevel: stress,
          lineage: [],
          feedQuality: 85,
          seed,
        }),
      );
    expect(born(0)).toEqual(born(90));
    expect(born(0).some(r => r.hidden.includes('resilient'))).toBe(true);
  });
});
