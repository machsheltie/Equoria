/**
 * At birth every trait is hidden unless a parent had it active and revealed
 * (owner ruling 2026-10-26, q98; Equoria-2d55z).
 *
 * Pure tests on applyEpigeneticTraitsAtBirth. Which traits a foal CARRIES is
 * unchanged (inheritance odds and the birth stages stay as they were); only
 * whether a carried trait starts hidden or active is ruled here.
 */

import { describe, it, expect } from '@jest/globals';
import { applyEpigeneticTraitsAtBirth } from '../../../utils/applyEpigeneticTraitsAtBirth.mjs';

const mare = { bondScore: 90, healthStatus: 'Excellent' };
const carried = r => [...r.positive, ...r.negative, ...r.hidden];

/** First seed (1..400) for which the foal carries `trait`. */
function bornCarrying(trait, args) {
  for (let seed = 1; seed <= 400; seed++) {
    const r = applyEpigeneticTraitsAtBirth({ ...args, seed });
    if (carried(r).includes(trait)) {
      return r;
    }
  }
  throw new Error(`no seed in 1..400 produced ${trait}`);
}

describe('at birth — hidden unless a parent had the trait active and revealed', () => {
  it('a trait inherited from a parent where it was ACTIVE is born active (positive)', () => {
    const r = bornCarrying('legendaryBloodline', {
      mare,
      lineage: [],
      feedQuality: 50,
      damTraits: ['legendaryBloodline'],
      parentActiveTraits: ['legendaryBloodline'],
    });
    expect(r.positive).toContain('legendaryBloodline');
    expect(r.hidden).not.toContain('legendaryBloodline');
  });

  it('a negative trait inherited from a parent where it was active is born active (negative)', () => {
    const r = bornCarrying('fragile', {
      mare,
      lineage: [],
      feedQuality: 50,
      sireTraits: ['fragile'],
      parentActiveTraits: ['fragile'],
    });
    expect(r.negative).toContain('fragile');
    expect(r.hidden).not.toContain('fragile');
  });

  it('a trait inherited from a parent where it was HIDDEN is born hidden', () => {
    const r = bornCarrying('eagerLearner', {
      mare,
      lineage: [],
      feedQuality: 50,
      damTraits: ['eagerLearner'],
      parentActiveTraits: [],
    });
    expect(r.hidden).toContain('eagerLearner');
    expect(r.positive).not.toContain('eagerLearner');
  });

  it('traits from the birth stages (premium feed) are born hidden', () => {
    const r = bornCarrying('resilient', { mare, lineage: [], feedQuality: 90 });
    expect(r.hidden).toContain('resilient');
    expect(r.positive).toEqual([]);
    expect(r.negative).toEqual([]);
  });

  it('a horse with no parents is born with nothing active, whatever it carries', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 90, seed });
      expect(r.positive).toEqual([]);
      expect(r.negative).toEqual([]);
    }
  });

  it('a parent-active trait the foal did not inherit is not given to it', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = applyEpigeneticTraitsAtBirth({
        mare,
        lineage: [],
        feedQuality: 50,
        parentActiveTraits: ['legendaryBloodline'],
        seed,
      });
      expect(carried(r)).not.toContain('legendaryBloodline');
    }
  });
});
