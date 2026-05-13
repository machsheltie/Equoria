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
