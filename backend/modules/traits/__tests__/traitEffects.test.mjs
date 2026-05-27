/**
 * traitEffects — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB required.
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

  it('calm has bondingBonus', () => {
    const effects = getTraitEffects('calm');
    expect(effects.bondingBonus).toBeDefined();
    expect(typeof effects.bondingBonus).toBe('number');
  });

  it('bold has competitionNerveBonus', () => {
    const effects = getTraitEffects('bold');
    expect(effects.competitionNerveBonus).toBeDefined();
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

  it('includes resilient, calm, bold, intelligent', () => {
    const all = getAllTraitEffects();
    expect(all.resilient).toBeDefined();
    expect(all.calm).toBeDefined();
    expect(all.bold).toBeDefined();
    expect(all.intelligent).toBeDefined();
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
    const double = getCombinedTraitEffects(['resilient', 'bold']);
    // both have competitionScoreModifier → combined should be larger
    expect(double.competitionScoreModifier).toBeGreaterThan(single.competitionScoreModifier);
  });

  it('boolean effects: true if any trait has it', () => {
    const combined = getCombinedTraitEffects(['resilient', 'calm']);
    // Both have suppressTemperamentDrift: true
    expect(combined.suppressTemperamentDrift).toBe(true);
  });

  it('merges discipline-specific objects from multiple traits', () => {
    const combined = getCombinedTraitEffects(['resilient', 'calm']);
    // resilient has disciplineModifiers.Racing, calm has disciplineModifiers.Dressage
    expect(combined.disciplineModifiers).toBeDefined();
    expect(combined.disciplineModifiers.Racing).toBeDefined();
    expect(combined.disciplineModifiers.Dressage).toBeDefined();
  });

  it('mixed known/unknown traits only uses known', () => {
    const combined = getCombinedTraitEffects(['resilient', 'telekinesis']);
    expect(combined.competitionScoreModifier).toBeDefined();
  });

  it('object effect overwrites prior non-object value for same key — line 699 else branch', () => {
    // eager_learner.baseStatBoost = 1 (number) → stored directly (line 667)
    // athletic.baseStatBoost = { stamina:2, agility:2, balance:1 } (object)
    // combinedEffects.baseStatBoost = 1 (truthy, not object) → outer else-if fires at line 679
    // inner if at 681 is FALSE (number ≠ object) → else at line 699 overwrites with spread
    const combined = getCombinedTraitEffects(['eager_learner', 'athletic']);
    expect(combined.baseStatBoost).toEqual({ stamina: 2, agility: 2, balance: 1 });
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Exact per-trait effect-value assertions, additive/object combination math, and
// discipline-modifier sign checks not covered by the function-mechanics tests above.
describe('traitEffects — exact per-trait definitions (merged from legacy backend/tests, Equoria-wvuin)', () => {
  describe('getCombinedTraitEffects — exact arithmetic', () => {
    it('combines numeric modifiers additively (resilient 0.03 + athletic 0.05 = 0.08)', () => {
      expect(getCombinedTraitEffects(['resilient', 'athletic']).competitionScoreModifier).toBe(0.08);
    });

    it('merges object baseStatBoost across athletic + legendaryBloodline', () => {
      const combined = getCombinedTraitEffects(['athletic', 'legendaryBloodline']);
      expect(combined.baseStatBoost.stamina).toBe(5); // athletic 2 + legendary 3
      expect(combined.baseStatBoost.agility).toBe(5); // athletic 2 + legendary 3
      expect(combined.baseStatBoost.balance).toBe(3); // athletic 1 + legendary 2
      expect(combined.baseStatBoost.focus).toBe(2); // only legendary 2
    });

    it('combines resilient + intelligent effects from both traits', () => {
      const combined = getCombinedTraitEffects(['resilient', 'intelligent']);
      expect(combined.suppressTemperamentDrift).toBe(true); // resilient
      expect(combined.trainingXpModifier).toBe(0.25); // intelligent
      expect(combined.trainingStressReduction).toBe(0.15); // resilient
      expect(combined.statGainChanceModifier).toBe(0.15); // intelligent
    });
  });

  describe('positive traits — exact effect values', () => {
    it('resilient has correct effects', () => {
      const e = getTraitEffects('resilient');
      expect(e.suppressTemperamentDrift).toBe(true);
      expect(e.trainingStressReduction).toBe(0.15);
      expect(e.competitionStressResistance).toBe(0.15);
      expect(e.competitionScoreModifier).toBe(0.03);
      expect(e.stressRecoveryRate).toBe(1.25);
      expect(e.disciplineModifiers['Cross Country']).toBe(0.05);
    });

    it('intelligent has correct effects', () => {
      const e = getTraitEffects('intelligent');
      expect(e.trainingXpModifier).toBe(0.25);
      expect(e.statGainChanceModifier).toBe(0.15);
      expect(e.trainingTimeReduction).toBe(0.1);
      expect(e.competitionScoreModifier).toBe(0.03);
      expect(e.problemSolvingBonus).toBe(true);
      expect(e.disciplineModifiers['Dressage']).toBe(0.06);
    });

    it('athletic has correct effects', () => {
      const e = getTraitEffects('athletic');
      expect(e.physicalTrainingBonus).toBe(0.2);
      expect(e.competitionScoreModifier).toBe(0.05);
      expect(e.baseStatBoost.stamina).toBe(2);
      expect(e.baseStatBoost.agility).toBe(2);
      expect(e.disciplineModifiers['Racing']).toBe(0.07);
    });
  });

  describe('negative traits — exact penalty values', () => {
    it('nervous has correct penalties', () => {
      const e = getTraitEffects('nervous');
      expect(e.trainingStressIncrease).toBe(0.25);
      expect(e.competitionStressRisk).toBe(10);
      expect(e.competitionScoreModifier).toBe(-0.04);
      expect(e.stressAccumulation).toBe(1.2);
      expect(e.disciplineModifiers['Racing']).toBe(-0.06);
    });

    it('lazy has correct penalties', () => {
      const e = getTraitEffects('lazy');
      expect(e.trainingXpModifier).toBe(-0.2);
      expect(e.trainingMotivationPenalty).toBe(0.25);
      expect(e.competitionScoreModifier).toBe(-0.035);
      expect(e.activityAvoidance).toBe(true);
      expect(e.disciplineModifiers['Endurance']).toBe(-0.08);
    });

    it('burnout has severe penalties', () => {
      const e = getTraitEffects('burnout');
      expect(e.statGainBlocked).toBe(true);
      expect(e.trainingXpModifier).toBe(-0.5);
      expect(e.competitionScoreModifier).toBe(-0.1);
      expect(e.extendedRestRequired).toBe(true);
      expect(e.disciplineModifiers['Endurance']).toBe(-0.15);
    });
  });

  describe('rare traits — exact effect values', () => {
    it('legendaryBloodline has powerful effects', () => {
      const e = getTraitEffects('legendaryBloodline');
      expect(e.trainingXpModifier).toBe(0.5);
      expect(e.statGainChanceModifier).toBe(0.3);
      expect(e.competitionScoreModifier).toBe(0.08);
      expect(e.eliteTrainingAccess).toBe(true);
      expect(e.baseStatBoost.stamina).toBe(3);
      expect(e.breedingValueBonus).toBe(0.5);
      expect(e.disciplineModifiers['Racing']).toBe(0.1);
    });
  });

  describe('discipline modifiers — sign checks', () => {
    it('positive traits have positive discipline bonuses', () => {
      const resilient = getTraitEffects('resilient');
      expect(resilient.disciplineModifiers['Cross Country']).toBeGreaterThan(0);
      expect(resilient.disciplineModifiers['Endurance']).toBeGreaterThan(0);
      const bold = getTraitEffects('bold');
      expect(bold.disciplineModifiers['Show Jumping']).toBeGreaterThan(0);
      expect(bold.disciplineModifiers['Racing']).toBeGreaterThan(0);
    });

    it('negative traits have negative discipline penalties', () => {
      const nervous = getTraitEffects('nervous');
      expect(nervous.disciplineModifiers['Racing']).toBeLessThan(0);
      expect(nervous.disciplineModifiers['Show Jumping']).toBeLessThan(0);
      const lazy = getTraitEffects('lazy');
      expect(lazy.disciplineModifiers['Endurance']).toBeLessThan(0);
      expect(lazy.disciplineModifiers['Cross Country']).toBeLessThan(0);
    });
  });

  describe('hasTraitEffect — additional known effects', () => {
    it('lazy has trainingXpModifier and bold has competitionConfidenceBoost', () => {
      expect(hasTraitEffect('lazy', 'trainingXpModifier')).toBe(true);
      expect(hasTraitEffect('bold', 'competitionConfidenceBoost')).toBe(true);
    });
  });

  describe('getAllTraitEffects — includes negative/rare categories', () => {
    it('includes lazy, nervous, legendaryBloodline, burnout', () => {
      const all = getAllTraitEffects();
      expect(all.lazy).toBeDefined();
      expect(all.nervous).toBeDefined();
      expect(all.legendaryBloodline).toBeDefined();
      expect(all.burnout).toBeDefined();
    });
  });
});
