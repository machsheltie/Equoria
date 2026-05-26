/**
 * Sentinel-positive tests for the staged at-birth pipeline:
 * Stage-0 inheritance (§A, Equoria-9o3n7.2) + §D hidden-trait visibility
 * (e2flk). Pure-function tests on applyEpigeneticTraitsAtBirth — seeded for
 * determinism, no DB, no mocks.
 *
 * Proves (sentinel-positive, OPTIMAL_FIX §2):
 *   - inheritance FIRES: a parent trait actually lands on the foal under a
 *     seed (and is absent when no parents carry traits — the check isn't
 *     vacuous).
 *   - §D hidden: a legendary parent trait under poor conditions lands in
 *     hidden[] for at least one seed, AND is visible for a different seed
 *     (so the visibility roll is real, not a constant).
 *   - the result always has the three-array shape.
 */

import { describe, it, expect } from '@jest/globals';
import { applyEpigeneticTraitsAtBirth } from '../../../utils/applyEpigeneticTraitsAtBirth.mjs';

const goodMare = { stressLevel: 10, bondScore: 90, healthStatus: 'Excellent' };
const poorMare = { stressLevel: 95, bondScore: 20, healthStatus: 'Poor' }; // used in determinism test

function unionTraits(result) {
  return [...result.positive, ...result.negative, ...result.hidden];
}

describe('§A Stage-0 inheritance — parent traits can be inherited', () => {
  it('always returns the {positive,negative,hidden} shape', () => {
    const r = applyEpigeneticTraitsAtBirth({
      mare: goodMare,
      lineage: [],
      feedQuality: 90,
      stressLevel: 10,
      seed: 1,
    });
    expect(Array.isArray(r.positive)).toBe(true);
    expect(Array.isArray(r.negative)).toBe(true);
    expect(Array.isArray(r.hidden)).toBe(true);
  });

  it('FIRES: a common parent trait lands on the foal for at least one seed', () => {
    let inherited = false;
    for (let seed = 1; seed <= 50 && !inherited; seed++) {
      const r = applyEpigeneticTraitsAtBirth({
        mare: goodMare,
        lineage: [],
        feedQuality: 90,
        stressLevel: 10,
        damTraits: ['intelligent'],
        sireTraits: ['athletic'],
        seed,
      });
      const all = unionTraits(r);
      if (all.includes('intelligent') || all.includes('athletic')) {
        inherited = true;
      }
    }
    expect(inherited).toBe(true);
  });

  it('NOT vacuous: with no parent traits + neutral conditions, the parent-inherited names never appear', () => {
    // Use mid conditions so Stage 1-4 don't fire; assert the specific parent
    // trait names are absent (they can only come from inheritance).
    for (let seed = 1; seed <= 20; seed++) {
      const r = applyEpigeneticTraitsAtBirth({
        mare: { stressLevel: 50, bondScore: 50 },
        lineage: [],
        feedQuality: 50,
        stressLevel: 50,
        damTraits: [],
        sireTraits: [],
        seed,
      });
      const all = unionTraits(r);
      expect(all).not.toContain('intelligent');
      expect(all).not.toContain('athletic');
    }
  });

  it('normalizes legacy snake-case parent traits before inheriting', () => {
    // legacy snake 'eager_learner' must be inheritable as canonical 'eagerLearner'
    let found = false;
    for (let seed = 1; seed <= 50 && !found; seed++) {
      const r = applyEpigeneticTraitsAtBirth({
        mare: goodMare,
        lineage: [],
        feedQuality: 90,
        stressLevel: 10,
        damTraits: ['eager_learner'],
        seed,
      });
      if (unionTraits(r).includes('eagerLearner')) {
        found = true;
      }
      // It must NEVER appear under the snake key.
      expect(unionTraits(r)).not.toContain('eager_learner');
    }
    expect(found).toBe(true);
  });
});

describe('§D visibility — legendary parent trait can be born hidden under poor conditions', () => {
  it('when inherited, legendaryBloodline lands in hidden[] for at least one seed (legendary 90% hidden)', () => {
    // Use favorable inheritance conditions (high bond, low stress) so the
    // legendary parent trait is actually inherited; the 90%-hidden roll is
    // independent of conditions. We assert that across many seeds it is born
    // hidden at least once (and the next test proves it can also be visible).
    let hiddenSeen = false;
    for (let seed = 1; seed <= 300 && !hiddenSeen; seed++) {
      const r = applyEpigeneticTraitsAtBirth({
        mare: goodMare,
        lineage: [],
        feedQuality: 90,
        stressLevel: 10,
        damTraits: ['legendaryBloodline'],
        sireTraits: ['legendaryBloodline'],
        seed,
      });
      if (r.hidden.includes('legendaryBloodline')) {
        hiddenSeen = true;
      }
    }
    expect(hiddenSeen).toBe(true);
  });

  it('legendaryBloodline CAN be visible for a different seed (the roll is real, not constant-hidden)', () => {
    let visibleSeen = false;
    for (let seed = 1; seed <= 300 && !visibleSeen; seed++) {
      const r = applyEpigeneticTraitsAtBirth({
        mare: goodMare,
        lineage: [],
        feedQuality: 90,
        stressLevel: 10,
        damTraits: ['legendaryBloodline'],
        sireTraits: ['legendaryBloodline'],
        seed,
      });
      if (r.positive.includes('legendaryBloodline')) {
        visibleSeen = true;
      }
    }
    expect(visibleSeen).toBe(true);
  });

  it('a deterministic seed is reproducible (same inputs+seed → same result)', () => {
    const args = {
      mare: poorMare,
      lineage: [],
      feedQuality: 20,
      stressLevel: 95,
      damTraits: ['legendaryBloodline', 'intelligent'],
      sireTraits: ['athletic'],
      seed: 42,
    };
    const a = applyEpigeneticTraitsAtBirth(args);
    const b = applyEpigeneticTraitsAtBirth(args);
    expect(b).toEqual(a);
  });
});
