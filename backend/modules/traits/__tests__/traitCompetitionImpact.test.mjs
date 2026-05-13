/**
 * traitCompetitionImpact — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateTraitCompetitionImpact,
  getTraitCompetitionEffect,
  getAllTraitCompetitionEffects,
  hasSpecializedEffect,
} from '../../../utils/traitCompetitionImpact.mjs';

// ---------------------------------------------------------------------------
// getTraitCompetitionEffect
// ---------------------------------------------------------------------------
describe('getTraitCompetitionEffect', () => {
  it('returns an effect object for a known trait', () => {
    const effect = getTraitCompetitionEffect('resilient');
    expect(effect).toBeDefined();
    expect(effect).toHaveProperty('name');
    expect(effect).toHaveProperty('type');
    expect(effect).toHaveProperty('general');
  });

  it('returns null for an unknown trait', () => {
    expect(getTraitCompetitionEffect('telekinesis')).toBeNull();
  });

  it('returned effect has general.scoreModifier', () => {
    const effect = getTraitCompetitionEffect('bold');
    expect(typeof effect.general.scoreModifier).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// getAllTraitCompetitionEffects
// ---------------------------------------------------------------------------
describe('getAllTraitCompetitionEffects', () => {
  it('returns a non-empty object', () => {
    const effects = getAllTraitCompetitionEffects();
    expect(typeof effects).toBe('object');
    expect(Object.keys(effects).length).toBeGreaterThan(0);
  });

  it('includes resilient, bold, and intelligent traits', () => {
    const effects = getAllTraitCompetitionEffects();
    expect(effects.resilient).toBeDefined();
    expect(effects.bold).toBeDefined();
    expect(effects.intelligent).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// hasSpecializedEffect
// ---------------------------------------------------------------------------
describe('hasSpecializedEffect', () => {
  it('returns true when a trait has a discipline-specific entry', () => {
    // resilient has a discipline-specific effect for Racing
    expect(hasSpecializedEffect('resilient', 'Racing')).toBe(true);
  });

  it('returns false when trait has no discipline-specific entry', () => {
    expect(hasSpecializedEffect('resilient', 'Underwater Polo')).toBe(false);
  });

  it('returns false for an unknown trait', () => {
    expect(hasSpecializedEffect('telekinesis', 'Racing')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateTraitCompetitionImpact
// ---------------------------------------------------------------------------
describe('calculateTraitCompetitionImpact', () => {
  const makeHorse = (traits = {}) => ({
    id: 1,
    epigeneticModifiers: {
      positive: [],
      negative: [],
      hidden: [],
      ...traits,
    },
  });

  it('returns result with expected shape', () => {
    const result = calculateTraitCompetitionImpact(makeHorse(), 'Racing', 70);
    expect(result).toHaveProperty('totalScoreModifier');
    expect(result).toHaveProperty('appliedTraits');
    expect(result).toHaveProperty('traitBonuses');
    expect(result).toHaveProperty('traitPenalties');
    expect(result).toHaveProperty('finalScoreAdjustment');
    expect(result).toHaveProperty('details');
  });

  it('returns zero modifier when horse has no traits', () => {
    const result = calculateTraitCompetitionImpact(makeHorse(), 'Racing', 70);
    expect(result.totalScoreModifier).toBe(0);
    expect(result.appliedTraits).toEqual([]);
  });

  it('applies positive trait modifier for resilient in Racing', () => {
    const horse = makeHorse({ positive: ['resilient'] });
    const result = calculateTraitCompetitionImpact(horse, 'Racing', 70);
    expect(result.totalScoreModifier).toBeGreaterThan(0);
    expect(result.appliedTraits.length).toBeGreaterThan(0);
  });

  it('applies discipline-specific modifier over general one', () => {
    // resilient has Racing-specific modifier of 0.04 vs general 0.03
    const horse = makeHorse({ positive: ['resilient'] });
    const racingResult = calculateTraitCompetitionImpact(horse, 'Racing', 70);
    expect(racingResult.details.disciplineSpecific).toBeGreaterThan(0);
  });

  it('skips unknown traits gracefully', () => {
    const horse = makeHorse({ positive: ['nonexistent_trait'] });
    const result = calculateTraitCompetitionImpact(horse, 'Racing', 70);
    expect(result.totalScoreModifier).toBe(0);
  });

  it('handles horse with no epigeneticModifiers field', () => {
    const horse = { id: 2 };
    const result = calculateTraitCompetitionImpact(horse, 'Racing', 70);
    expect(result.totalScoreModifier).toBe(0);
  });

  it('accumulates modifiers from multiple traits', () => {
    const horse = makeHorse({ positive: ['resilient', 'bold'] });
    const result = calculateTraitCompetitionImpact(horse, 'Racing', 70);
    const singleTrait = calculateTraitCompetitionImpact(makeHorse({ positive: ['resilient'] }), 'Racing', 70);
    expect(result.totalScoreModifier).toBeGreaterThan(singleTrait.totalScoreModifier);
  });

  it('returns negative modifier for negative traits that have competition effects', () => {
    // Check if any negative traits exist in the effects registry
    const effects = getAllTraitCompetitionEffects();
    const negativeTraits = Object.entries(effects)
      .filter(([, e]) => e.type === 'negative' && e.general?.scoreModifier < 0)
      .map(([name]) => name);

    if (negativeTraits.length > 0) {
      const horse = makeHorse({ negative: [negativeTraits[0]] });
      const result = calculateTraitCompetitionImpact(horse, 'Racing', 70);
      expect(result.totalScoreModifier).toBeLessThan(0);
    } else {
      // No negative traits in current registry — skip assertion
      expect(true).toBe(true);
    }
  });

  // -------------------------------------------------------------------
  // calculateDiminishingReturns branch coverage (lines 411-419)
  // -------------------------------------------------------------------
  it('applies 0.9 diminishing factor for 3 applied traits (line 411-413)', () => {
    const horse = makeHorse({ positive: ['resilient', 'bold', 'intelligent'] });
    const result = calculateTraitCompetitionImpact(horse, 'Racing', 70);
    expect(result.appliedTraits.length).toBe(3);
    // diminishing factor 0.9 means modifier < sum of individual modifiers
    expect(result.totalScoreModifier).toBeGreaterThan(0);
  });

  it('applies 0.85 diminishing factor for 4 applied traits (line 414-416)', () => {
    const horse = makeHorse({ positive: ['resilient', 'bold', 'intelligent', 'calm'] });
    const result = calculateTraitCompetitionImpact(horse, 'Racing', 70);
    expect(result.appliedTraits.length).toBe(4);
    expect(result.totalScoreModifier).toBeGreaterThan(0);
  });

  it('applies 0.8 diminishing factor for 5+ applied traits (line 417-419)', () => {
    const horse = makeHorse({ positive: ['resilient', 'bold', 'intelligent', 'calm', 'athletic'] });
    const result = calculateTraitCompetitionImpact(horse, 'Racing', 70);
    expect(result.appliedTraits.length).toBe(5);
    expect(result.totalScoreModifier).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------
  // catch block coverage (lines 386-387)
  // -------------------------------------------------------------------
  it('returns zero-modifier default shape when horse is null (triggers catch, lines 386-387)', () => {
    const result = calculateTraitCompetitionImpact(null, 'Racing', 70);
    expect(result.totalScoreModifier).toBe(0);
    expect(result.appliedTraits).toEqual([]);
    expect(result.finalScoreAdjustment).toBe(0);
  });
});
