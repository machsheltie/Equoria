/**
 * At birth every trait is hidden unless a parent had it active and revealed
 * (owner ruling 2026-10-26, q98; Equoria-2d55z).
 *
 * Pure tests on applyEpigeneticTraitsAtBirth. Which traits a foal CARRIES is
 * unchanged (inheritance odds and the birth stages stay as they were); only
 * whether a carried trait starts hidden or active is ruled here.
 *
 * Owner ruling 2026-10-27 (q117): the roster was replaced, so the positive
 * example is now confident (legendaryBloodline is off the roster and can no
 * longer be inherited, which the last test proves).
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
    const r = bornCarrying('confident', {
      mare,
      lineage: [],
      feedQuality: 50,
      damTraits: ['confident'],
      parentActiveTraits: ['confident'],
    });
    expect(r.positive).toContain('confident');
    expect(r.hidden).not.toContain('confident');
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
        parentActiveTraits: ['confident'],
        seed,
      });
      expect(carried(r)).not.toContain('confident');
    }
  });

  it('a parent trait off the roster is never inherited, active or hidden (q117)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = applyEpigeneticTraitsAtBirth({
        mare,
        lineage: [],
        feedQuality: 50,
        sireTraits: ['legendaryBloodline', 'calm'],
        damTraits: ['bold', 'lowImmunity'],
        parentActiveTraits: ['legendaryBloodline', 'bold'],
        seed,
      });
      expect(carried(r)).toEqual([]);
    }
  });
});

// Owner ruling 2026-11-17 (q355): a trait inherited from a parent on which it was revealed but
// dormant is born revealed but dormant. Prenatal traits keep today's rule (q356).
describe('at birth — inherited from a revealed-but-dormant parent (q355)', () => {
  /** Rolls that return `draws` in order, then always lose. */
  const scripted = draws => {
    const queue = [...draws];
    return () => (queue.length > 0 ? queue.shift() : 0.99);
  };

  it("the dam's dormant trait, passed on by her roll, is born dormant: not hidden, not active", () => {
    const r = applyEpigeneticTraitsAtBirth({
      mare,
      lineage: [],
      feedQuality: 50,
      damTraits: ['brave'],
      damDormantTraits: ['brave'],
      rng: scripted([0]),
    });
    expect(r.dormant).toEqual(['brave']);
    expect(r.hidden).toEqual([]);
    expect(r.positive).toEqual([]);
  });

  it('both parents pass it, dormant on the sire and hidden on the dam: born dormant', () => {
    const r = applyEpigeneticTraitsAtBirth({
      mare,
      lineage: [],
      feedQuality: 50,
      sireTraits: ['fearful'],
      damTraits: ['fearful'],
      sireDormantTraits: ['fearful'],
      rng: scripted([0, 0]),
    });
    expect(r.dormant).toEqual(['fearful']);
    expect(r.hidden).toEqual([]);
    expect(r.negative).toEqual([]);
  });

  it('a trait active on a parent still makes the inherited copy active (q98 precedence kept)', () => {
    const r = applyEpigeneticTraitsAtBirth({
      mare,
      lineage: [],
      feedQuality: 50,
      sireTraits: ['brave'],
      damTraits: ['brave'],
      damDormantTraits: ['brave'],
      parentActiveTraits: ['brave'],
      rng: scripted([0, 0]),
    });
    expect(r.positive).toEqual(['brave']);
    expect(r.dormant).toEqual([]);
  });

  it('a prenatal trait the dam carries dormant but did not pass on is born hidden (q356)', () => {
    // Inheritance roll loses (0.99), the well-kept-mare Resilient roll wins (0.05).
    const r = applyEpigeneticTraitsAtBirth({
      mare,
      lineage: [],
      feedQuality: 90,
      damTraits: ['resilient'],
      damDormantTraits: ['resilient'],
      rng: scripted([0.99, 0.05]),
    });
    expect(r.hidden).toEqual(['resilient']);
    expect(r.dormant).toEqual([]);
  });
});

// Owner ruling 2026-11-17 (q354): an inherited trait takes its state from the parent whose roll
// passed it on, not from whichever parent shows it. Both passing: the better state wins (active,
// then dormant, then hidden). Prenatal traits keep today's rule (q356). Arguments mirror the
// foaling service: each parent's active list plus their union.
describe('at birth — the state follows the parent whose roll passed the trait on (q354)', () => {
  const scripted = draws => {
    const queue = [...draws];
    return () => (queue.length > 0 ? queue.shift() : 0.99);
  };
  const parents = ({ sireActive = [], damActive = [], ...rest }) => ({
    mare,
    lineage: [],
    feedQuality: 50,
    sireActiveTraits: sireActive,
    damActiveTraits: damActive,
    parentActiveTraits: [...new Set([...sireActive, ...damActive])],
    ...rest,
  });

  it('active on the sire, hidden on the dam, only the dam passes it: born hidden', () => {
    const r = applyEpigeneticTraitsAtBirth(
      parents({
        sireTraits: ['brave'],
        damTraits: ['brave'],
        sireActive: ['brave'],
        rng: scripted([0.99, 0]),
      }),
    );
    expect(r.hidden).toEqual(['brave']);
    expect(r.positive).toEqual([]);
    expect(r.dormant).toEqual([]);
  });

  it('active on the sire (roll lost), dormant on the dam (roll won): born dormant', () => {
    const r = applyEpigeneticTraitsAtBirth(
      parents({
        sireTraits: ['fearful'],
        damTraits: ['fearful'],
        sireActive: ['fearful'],
        damDormantTraits: ['fearful'],
        rng: scripted([0.99, 0]),
      }),
    );
    expect(r.dormant).toEqual(['fearful']);
    expect(r.negative).toEqual([]);
    expect(r.hidden).toEqual([]);
  });

  it('active on the dam, hidden on the sire, only the sire passes it: born hidden', () => {
    const r = applyEpigeneticTraitsAtBirth(
      parents({
        sireTraits: ['confident'],
        damTraits: ['confident'],
        damActive: ['confident'],
        rng: scripted([0, 0.99]),
      }),
    );
    expect(r.hidden).toEqual(['confident']);
    expect(r.positive).toEqual([]);
  });

  it('both parents pass it, active on one and hidden on the other: born active', () => {
    for (const [sireActive, damActive] of [
      [['brave'], []],
      [[], ['brave']],
    ]) {
      const r = applyEpigeneticTraitsAtBirth(
        parents({
          sireTraits: ['brave'],
          damTraits: ['brave'],
          sireActive,
          damActive,
          rng: scripted([0, 0]),
        }),
      );
      expect(r.positive).toEqual(['brave']);
      expect(r.hidden).toEqual([]);
    }
  });

  it('both parents pass it, active on one and dormant on the other: born active', () => {
    const r = applyEpigeneticTraitsAtBirth(
      parents({
        sireTraits: ['skittish'],
        damTraits: ['skittish'],
        damActive: ['skittish'],
        sireDormantTraits: ['skittish'],
        rng: scripted([0, 0]),
      }),
    );
    expect(r.negative).toEqual(['skittish']);
    expect(r.dormant).toEqual([]);
  });

  it('the pass odds and roll order are unchanged: one roll per carrying parent, sire first', () => {
    const draws = [];
    const rng = () => {
      draws.push('roll');
      return 0.99;
    };
    applyEpigeneticTraitsAtBirth(parents({ sireTraits: ['brave'], damTraits: ['brave'], sireActive: ['brave'], rng }));
    expect(draws).toHaveLength(2);
  });

  it('a prenatal trait a parent shows is still born active though that parent did not pass it (q356)', () => {
    // Sire's inheritance roll loses (0.99); the well-kept-mare Resilient roll wins (0.05).
    const r = applyEpigeneticTraitsAtBirth(
      parents({
        feedQuality: 90,
        sireTraits: ['resilient'],
        sireActive: ['resilient'],
        rng: scripted([0.99, 0.05]),
      }),
    );
    expect(r.positive).toEqual(['resilient']);
    expect(r.hidden).toEqual([]);
  });

  it('a prenatal trait also passed on by a hidden parent stays active when the other parent shows it (q356)', () => {
    // Sire (active) loses, dam (hidden) wins, then the well-kept-mare Resilient roll wins too.
    const r = applyEpigeneticTraitsAtBirth(
      parents({
        feedQuality: 90,
        sireTraits: ['resilient'],
        damTraits: ['resilient'],
        sireActive: ['resilient'],
        rng: scripted([0.99, 0, 0.05]),
      }),
    );
    expect(r.positive).toEqual(['resilient']);
    expect(r.hidden).toEqual([]);
  });
});
