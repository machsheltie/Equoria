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
 *   - visibility (owner ruling 2026-10-26, q98, replacing the §D rolls): an
 *     inherited trait is born hidden unless a parent had it active and
 *     revealed, for every seed.
 *   - the result always has the three-array shape.
 */

import { describe, it, expect } from '@jest/globals';
import { applyEpigeneticTraitsAtBirth } from '../../../utils/applyEpigeneticTraitsAtBirth.mjs';

const goodMare = { bondScore: 90, healthStatus: 'Excellent' };
const poorMare = { bondScore: 20, healthStatus: 'Poor' }; // used in determinism test

function unionTraits(result) {
  return [...result.positive, ...result.negative, ...result.hidden];
}

describe('§A Stage-0 inheritance — parent traits can be inherited', () => {
  it('always returns the {positive,negative,hidden} shape', () => {
    const r = applyEpigeneticTraitsAtBirth({
      mare: goodMare,
      lineage: [],
      feedQuality: 90,
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
        mare: { bondScore: 50 },
        lineage: [],
        feedQuality: 50,
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

// Owner ruling 2026-10-26 (q98, Equoria-2d55z) replaced the §D rarity rolls
// (legendary 90% / rare 70% / poor feed 30% born hidden, otherwise visible by
// chance) with one rule: a carried trait is born hidden unless a parent had it
// active and revealed. These two cases pin the new rule for the legendary trait
// the old §D tests used.
describe('visibility (q98) — an inherited legendary trait follows the parent, never a roll', () => {
  it('inherited from parents where it was hidden: born hidden for every seed', () => {
    let inherited = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = applyEpigeneticTraitsAtBirth({
        mare: goodMare,
        lineage: [],
        feedQuality: 90,
        damTraits: ['legendaryBloodline'],
        sireTraits: ['legendaryBloodline'],
        seed,
      });
      expect(r.positive).not.toContain('legendaryBloodline');
      inherited += r.hidden.includes('legendaryBloodline') ? 1 : 0;
    }
    expect(inherited).toBeGreaterThan(0);
  });

  it('inherited from a parent where it was active and revealed: born active for every seed', () => {
    let inherited = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = applyEpigeneticTraitsAtBirth({
        mare: goodMare,
        lineage: [],
        feedQuality: 90,
        damTraits: ['legendaryBloodline'],
        sireTraits: ['legendaryBloodline'],
        parentActiveTraits: ['legendaryBloodline'],
        seed,
      });
      expect(r.hidden).not.toContain('legendaryBloodline');
      inherited += r.positive.includes('legendaryBloodline') ? 1 : 0;
    }
    expect(inherited).toBeGreaterThan(0);
  });
});

describe('seeded births', () => {
  it('a deterministic seed is reproducible (same inputs+seed → same result)', () => {
    const args = {
      mare: poorMare,
      lineage: [],
      feedQuality: 20,
      damTraits: ['legendaryBloodline', 'intelligent'],
      sireTraits: ['athletic'],
      seed: 42,
    };
    const a = applyEpigeneticTraitsAtBirth(args);
    const b = applyEpigeneticTraitsAtBirth(args);
    expect(b).toEqual(a);
  });
});
