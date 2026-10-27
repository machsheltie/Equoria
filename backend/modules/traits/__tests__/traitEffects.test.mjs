/**
 * traitEffects — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB required.
 *
 * Owner ruling 2026-10-27 (q117, Equoria-2d55z) replaced the trait roster:
 * effects keyed to traits no longer on it (calm, bold, intelligent, athletic,
 * nervous, lazy, legendaryBloodline and the rest) were removed, so those names
 * now resolve to no effects. The combination mechanics are exercised with the
 * entries that remain (resilient, eagerLearner, peopleTrusting, fragile and the
 * generated discipline affinities); the old per-trait value checks for removed
 * traits became "has no effect" checks.
 */

import { describe, it, expect } from '@jest/globals';
import {
  getTraitEffects,
  getAllTraitEffects,
  hasTraitEffect,
  getCombinedTraitEffects,
} from '../../../utils/traitEffects.mjs';

// ---------------------------------------------------------------------------
// getTraitEffects
// ---------------------------------------------------------------------------
describe('getTraitEffects', () => {
  it('returns an object for a known trait (resilient)', () => {
    const effects = getTraitEffects('resilient');
    expect(effects).not.toBeNull();
    expect(typeof effects).toBe('object');
  });

  it('resilient has competitionScoreModifier', () => {
    const effects = getTraitEffects('resilient');
    expect(typeof effects.competitionScoreModifier).toBe('number');
    expect(effects.competitionScoreModifier).toBeGreaterThan(0);
  });

  it('peopleTrusting has bondingBonus', () => {
    const effects = getTraitEffects('peopleTrusting');
    expect(effects.bondingBonus).toBeDefined();
    expect(typeof effects.bondingBonus).toBe('number');
  });

  it('calm and bold, no longer traits, have no effects', () => {
    expect(getTraitEffects('calm')).toBeNull();
    expect(getTraitEffects('bold')).toBeNull();
  });

  it('returns null for an unknown trait', () => {
    expect(getTraitEffects('telekinesis')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getTraitEffects(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getTraitEffects('')).toBeNull();
  });

  it('returns null for numeric input', () => {
    expect(getTraitEffects(42)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAllTraitEffects
// ---------------------------------------------------------------------------
describe('getAllTraitEffects', () => {
  it('returns a non-empty object', () => {
    const all = getAllTraitEffects();
    expect(typeof all).toBe('object');
    expect(Object.keys(all).length).toBeGreaterThan(0);
  });

  it('includes the roster traits that keep effects, and none of the removed ones', () => {
    const all = getAllTraitEffects();
    expect(all.resilient).toBeDefined();
    expect(all.eagerLearner).toBeDefined();
    expect(all.peopleTrusting).toBeDefined();
    expect(all.fragile).toBeDefined();
    expect(all.calm).toBeUndefined();
    expect(all.bold).toBeUndefined();
    expect(all.intelligent).toBeUndefined();
  });

  it('each entry is an object with at least one effect', () => {
    const all = getAllTraitEffects();
    for (const [, effects] of Object.entries(all)) {
      expect(typeof effects).toBe('object');
      expect(Object.keys(effects).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// hasTraitEffect
// ---------------------------------------------------------------------------
describe('hasTraitEffect', () => {
  it('returns true for a known effect on a known trait', () => {
    expect(hasTraitEffect('resilient', 'competitionScoreModifier')).toBe(true);
  });

  it('returns true for suppressTemperamentDrift on resilient', () => {
    expect(hasTraitEffect('resilient', 'suppressTemperamentDrift')).toBe(true);
  });

  it('returns false for a non-existent effect on a known trait', () => {
    expect(hasTraitEffect('resilient', 'nonexistentEffect')).toBe(false);
  });

  it('returns false for unknown trait', () => {
    expect(hasTraitEffect('telekinesis', 'competitionScoreModifier')).toBe(false);
  });

  it('returns false for null trait name', () => {
    expect(hasTraitEffect(null, 'competitionScoreModifier')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getCombinedTraitEffects
// ---------------------------------------------------------------------------
describe('getCombinedTraitEffects', () => {
  it('returns empty object for empty array', () => {
    expect(getCombinedTraitEffects([])).toEqual({});
  });

  it('returns empty object for non-array input', () => {
    expect(getCombinedTraitEffects('resilient')).toEqual({});
    expect(getCombinedTraitEffects(null)).toEqual({});
    expect(getCombinedTraitEffects(undefined)).toEqual({});
  });

  it('returns effects for single trait', () => {
    const combined = getCombinedTraitEffects(['resilient']);
    expect(combined.competitionScoreModifier).toBeDefined();
  });

  it('skips unknown traits gracefully', () => {
    const combined = getCombinedTraitEffects(['telekinesis']);
    expect(Object.keys(combined).length).toBe(0);
  });

  it('combines numeric effects additively for two traits', () => {
    const single = getCombinedTraitEffects(['resilient']);
    const double = getCombinedTraitEffects(['resilient', 'eagerLearner']);
    // both have competitionScoreModifier → combined should be larger
    expect(double.competitionScoreModifier).toBeGreaterThan(single.competitionScoreModifier);
  });

  it('boolean effects: true if any trait has it', () => {
    const combined = getCombinedTraitEffects(['fragile', 'resilient']);
    // Only resilient has suppressTemperamentDrift: true
    expect(combined.suppressTemperamentDrift).toBe(true);
  });

  it('merges discipline-specific objects from multiple traits', () => {
    const combined = getCombinedTraitEffects(['resilient', 'disciplineAffinityDressage']);
    // resilient has disciplineModifiers.Racing, the Dressage affinity has disciplineModifiers.Dressage
    expect(combined.disciplineModifiers).toBeDefined();
    expect(combined.disciplineModifiers.Racing).toBeDefined();
    expect(combined.disciplineModifiers.Dressage).toBeDefined();
  });

  it('mixed known/unknown traits only uses known', () => {
    const combined = getCombinedTraitEffects(['resilient', 'telekinesis']);
    expect(combined.competitionScoreModifier).toBeDefined();
  });

  it('object effect overwrites prior non-object value for same key — the else branch', () => {
    // eager_learner.baseStatBoost = 1 (number) → stored directly
    // disciplineAffinityRacing.baseStatBoost = { speed: 3, stamina: 2 } (object)
    // combinedEffects.baseStatBoost = 1 (truthy, not object) → outer else-if fires;
    // the inner object check is FALSE (number ≠ object) → else overwrites with spread
    const combined = getCombinedTraitEffects(['eager_learner', 'disciplineAffinityRacing']);
    expect(combined.baseStatBoost).toEqual({ speed: 3, stamina: 2 });
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Exact per-trait effect-value assertions, additive/object combination math, and
// discipline-modifier sign checks not covered by the function-mechanics tests above.
describe('traitEffects — exact per-trait definitions (merged from legacy backend/tests, Equoria-wvuin)', () => {
  describe('getCombinedTraitEffects — exact arithmetic', () => {
    it('combines numeric modifiers additively (resilient 0.03 + eagerLearner 0.02 = 0.05)', () => {
      expect(getCombinedTraitEffects(['resilient', 'eagerLearner']).competitionScoreModifier).toBe(0.05);
    });

    it('merges object baseStatBoost across the Racing and Endurance affinities', () => {
      const combined = getCombinedTraitEffects(['disciplineAffinityRacing', 'disciplineAffinityEndurance']);
      expect(combined.baseStatBoost.speed).toBe(3); // only Racing 3
      expect(combined.baseStatBoost.stamina).toBe(5); // Racing 2 + Endurance 3
      expect(combined.baseStatBoost.intelligence).toBe(2); // only Endurance 2
    });

    it('combines resilient + eagerLearner effects from both traits', () => {
      const combined = getCombinedTraitEffects(['resilient', 'eagerLearner']);
      expect(combined.suppressTemperamentDrift).toBe(true); // resilient
      expect(combined.trainingXpModifier).toBe(0.25); // eagerLearner
      expect(combined.statGainChanceModifier).toBe(0.1); // eagerLearner
      expect(combined.trainingConsistencyBonus).toBe(0.25); // resilient 0.1 + eagerLearner 0.15
    });
  });

  describe('positive traits — exact effect values', () => {
    it('resilient has correct effects', () => {
      const e = getTraitEffects('resilient');
      expect(e.suppressTemperamentDrift).toBe(true);
      expect(e.competitionScoreModifier).toBe(0.03);
      expect(e.disciplineModifiers['Cross Country']).toBe(0.05);
    });

    it('eagerLearner has correct effects', () => {
      const e = getTraitEffects('eagerLearner');
      expect(e.trainingXpModifier).toBe(0.25);
      expect(e.statGainChanceModifier).toBe(0.1);
      expect(e.baseStatBoost).toBe(1);
      expect(e.competitionScoreModifier).toBe(0.02);
    });

    it('intelligent and athletic, no longer traits, have no effects', () => {
      expect(getTraitEffects('intelligent')).toBeNull();
      expect(getTraitEffects('athletic')).toBeNull();
    });
  });

  describe('negative traits — exact penalty values', () => {
    it('fragile has correct penalties', () => {
      const e = getTraitEffects('fragile');
      expect(e.competitionScoreModifier).toBe(-0.035);
      expect(e.injuryRisk).toBe(0.3);
      expect(e.disciplineModifiers['Cross Country']).toBe(-0.08);
    });

    it('nervous and lazy, no longer traits, have no penalties', () => {
      expect(getTraitEffects('nervous')).toBeNull();
      expect(getTraitEffects('lazy')).toBeNull();
      expect(getCombinedTraitEffects(['nervous', 'lazy'])).toEqual({});
    });

    // Owner ruling 2026-10-22 (Equoria-0d4wa) replaced the old contract (burnout
    // blocked training stat gains and cut competition scores): there is no
    // burnout trait, so a stored 'burnout' name has no effects at all.
    it('burnout has no effects (there is no burnout)', () => {
      expect(getTraitEffects('burnout')).toBeNull();
      expect(getCombinedTraitEffects(['burnout'])).toEqual({});
    });
  });

  describe('rare traits', () => {
    it('legendaryBloodline, no longer a trait, has no effects', () => {
      expect(getTraitEffects('legendaryBloodline')).toBeNull();
    });
  });

  describe('discipline modifiers — sign checks', () => {
    it('positive traits have positive discipline bonuses', () => {
      const resilient = getTraitEffects('resilient');
      expect(resilient.disciplineModifiers['Cross Country']).toBeGreaterThan(0);
      expect(resilient.disciplineModifiers['Endurance']).toBeGreaterThan(0);
      expect(resilient.disciplineModifiers['Racing']).toBeGreaterThan(0);
    });

    it('negative traits have negative discipline penalties', () => {
      const fragile = getTraitEffects('fragile');
      expect(fragile.disciplineModifiers['Racing']).toBeLessThan(0);
      expect(fragile.disciplineModifiers['Show Jumping']).toBeLessThan(0);
      expect(fragile.disciplineModifiers['Cross Country']).toBeLessThan(0);
    });
  });

  describe('hasTraitEffect — additional known effects', () => {
    it('eagerLearner has trainingXpModifier and peopleTrusting has groomingBondingBonus; removed traits have none', () => {
      expect(hasTraitEffect('eagerLearner', 'trainingXpModifier')).toBe(true);
      expect(hasTraitEffect('peopleTrusting', 'groomingBondingBonus')).toBe(true);
      expect(hasTraitEffect('lazy', 'trainingXpModifier')).toBe(false);
      expect(hasTraitEffect('bold', 'competitionConfidenceBoost')).toBe(false);
    });
  });

  describe('getAllTraitEffects — includes negative/rare categories', () => {
    it('includes fragile; no lazy, nervous, legendaryBloodline (q117) and no burnout (Equoria-0d4wa)', () => {
      const all = getAllTraitEffects();
      expect(all.fragile).toBeDefined();
      expect(all.lazy).toBeUndefined();
      expect(all.nervous).toBeUndefined();
      expect(all.legendaryBloodline).toBeUndefined();
      expect(all.burnout).toBeUndefined();
    });
  });
});
