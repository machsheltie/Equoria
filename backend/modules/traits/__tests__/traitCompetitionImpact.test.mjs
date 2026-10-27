/**
 * traitCompetitionImpact — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB required.
 *
 * Owner ruling 2026-10-27 (q117, Equoria-2d55z) replaced the trait roster:
 * entries for traits no longer on it (bold, intelligent, calm, athletic,
 * nervous, stubborn, legendaryBloodline and the rest) were removed, so those
 * names now apply nothing. The mechanics are exercised with the entries that
 * remain (resilient, eagerLearner, fragile); where a test needs four or five
 * applied traits it lists a remaining trait twice, because the calculator
 * counts every listed trait.
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
    const effect = getTraitCompetitionEffect('eagerLearner');
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

  it('holds exactly the roster traits that keep a competition effect', () => {
    const effects = getAllTraitCompetitionEffects();
    expect(Object.keys(effects).sort()).toEqual(['eagerLearner', 'fragile', 'resilient']);
    expect(getTraitCompetitionEffect('bold')).toBeNull();
    expect(getTraitCompetitionEffect('intelligent')).toBeNull();
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
    const horse = makeHorse({ positive: ['nonexistentTrait'] });
    const result = calculateTraitCompetitionImpact(horse, 'Racing', 70);
    expect(result.totalScoreModifier).toBe(0);
  });

  it('handles horse with no epigeneticModifiers field', () => {
    const horse = { id: 2 };
    const result = calculateTraitCompetitionImpact(horse, 'Racing', 70);
    expect(result.totalScoreModifier).toBe(0);
  });

  it('accumulates modifiers from multiple traits', () => {
    const horse = makeHorse({ positive: ['resilient', 'eagerLearner'] });
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
  // Racing modifiers: resilient +0.04 (specialised), eagerLearner +0.035
  // (general), fragile -0.05 (specialised).
  const sumOf = result => result.appliedTraits.reduce((sum, t) => sum + t.modifier, 0);

  it('applies 0.9 diminishing factor for 3 applied traits', () => {
    const horse = makeHorse({ positive: ['resilient', 'eagerLearner'], negative: ['fragile'] });
    const result = calculateTraitCompetitionImpact(horse, 'Racing', 70);
    expect(result.appliedTraits.length).toBe(3);
    expect(result.totalScoreModifier).toBeCloseTo(sumOf(result) * 0.9, 12);
    expect(result.totalScoreModifier).toBeGreaterThan(0);
  });

  it('applies 0.85 diminishing factor for 4 applied traits', () => {
    const horse = makeHorse({
      positive: ['resilient', 'eagerLearner', 'eagerLearner'],
      negative: ['fragile'],
    });
    const result = calculateTraitCompetitionImpact(horse, 'Racing', 70);
    expect(result.appliedTraits.length).toBe(4);
    expect(result.totalScoreModifier).toBeCloseTo(sumOf(result) * 0.85, 12);
  });

  it('applies 0.8 diminishing factor for 5+ applied traits', () => {
    const horse = makeHorse({
      positive: ['resilient', 'eagerLearner', 'eagerLearner', 'resilient'],
      negative: ['fragile'],
    });
    const result = calculateTraitCompetitionImpact(horse, 'Racing', 70);
    expect(result.appliedTraits.length).toBe(5);
    expect(result.totalScoreModifier).toBeCloseTo(sumOf(result) * 0.8, 12);
  });

  it('a horse carrying only traits off the roster gets no competition modifier', () => {
    const horse = makeHorse({ positive: ['bold', 'legendaryBloodline'], negative: ['nervous'] });
    const result = calculateTraitCompetitionImpact(horse, 'Show Jumping', 70);
    expect(result.appliedTraits).toEqual([]);
    expect(result.totalScoreModifier).toBe(0);
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

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Exact-value legendary/rare/discipline-specific modifier assertions, the
// getTraitCompetitionEffect/hasSpecializedEffect exact-value checks, and the
// balance/fairness invariants not covered by the tests above.
describe('traitCompetitionImpact — exact modifiers & balance invariants (merged from legacy backend/tests, Equoria-wvuin)', () => {
  const baseScore = 100;
  const mkHorse = (positive = [], negative = []) => ({
    id: 1,
    name: 'Test Horse',
    epigeneticModifiers: { positive, negative, hidden: [] },
  });

  it('legendaryBloodline, no longer a trait, applies nothing', () => {
    const result = calculateTraitCompetitionImpact(mkHorse(['legendaryBloodline']), 'Racing', baseScore);
    expect(result.appliedTraits).toHaveLength(0);
    expect(result.finalScoreAdjustment).toBe(0);
  });

  it('resilient uses specialized 0.05 for Cross Country, general 0.03 for Dressage', () => {
    const cc = calculateTraitCompetitionImpact(mkHorse(['resilient']), 'Cross Country', baseScore);
    const dressage = calculateTraitCompetitionImpact(mkHorse(['resilient']), 'Dressage', baseScore);
    expect(cc.appliedTraits[0].isSpecialized).toBe(true);
    expect(cc.appliedTraits[0].modifier).toBe(0.05);
    expect(dressage.appliedTraits[0].isSpecialized).toBe(false);
    expect(dressage.appliedTraits[0].modifier).toBe(0.03);
  });

  it('getTraitCompetitionEffect returns exact eagerLearner effect values', () => {
    const eager = getTraitCompetitionEffect('eagerLearner');
    expect(eager.name).toBe('Eager Learner');
    expect(eager.type).toBe('positive');
    expect(eager.general.scoreModifier).toBe(0.035);
    expect(eager.disciplines['Dressage'].scoreModifier).toBe(0.05);
  });

  it('hasSpecializedEffect: exact specialized and non-specialized combinations', () => {
    expect(hasSpecializedEffect('eagerLearner', 'Dressage')).toBe(true);
    expect(hasSpecializedEffect('fragile', 'Show Jumping')).toBe(true);
    expect(hasSpecializedEffect('resilient', 'Endurance')).toBe(true);
    expect(hasSpecializedEffect('eagerLearner', 'Racing')).toBe(false);
    expect(hasSpecializedEffect('bold', 'Show Jumping')).toBe(false);
    expect(hasSpecializedEffect('unknownTrait', 'Show Jumping')).toBe(false);
  });

  describe('discipline-specific modifier matrix', () => {
    const cases = [
      { trait: 'resilient', discipline: 'Endurance', expectedModifier: 0.06 },
      { trait: 'eagerLearner', discipline: 'Reining', expectedModifier: 0.045 },
      { trait: 'fragile', discipline: 'Show Jumping', expectedModifier: -0.06 },
      { trait: 'fragile', discipline: 'Cross Country', expectedModifier: -0.08 },
    ];
    cases.forEach(({ trait, discipline, expectedModifier }) => {
      it(`${trait} → ${discipline} = ${expectedModifier}`, () => {
        const horse = mkHorse(expectedModifier > 0 ? [trait] : [], expectedModifier < 0 ? [trait] : []);
        const result = calculateTraitCompetitionImpact(horse, discipline, 100);
        expect(result.appliedTraits).toHaveLength(1);
        expect(result.appliedTraits[0].modifier).toBe(expectedModifier);
        expect(result.appliedTraits[0].isSpecialized).toBe(true);
      });
    });
  });

  describe('balance and fairness invariants', () => {
    it('all trait effects are balanced (general ≤0.08, discipline ≤0.12, sign matches type)', () => {
      const allEffects = getAllTraitCompetitionEffects();
      Object.values(allEffects).forEach(effect => {
        expect(Math.abs(effect.general.scoreModifier)).toBeLessThanOrEqual(0.08);
        if (effect.disciplines) {
          Object.values(effect.disciplines).forEach(de => {
            expect(Math.abs(de.scoreModifier)).toBeLessThanOrEqual(0.12);
          });
        }
        if (effect.type === 'positive') {
          expect(effect.general.scoreModifier).toBeGreaterThan(0);
        }
        if (effect.type === 'negative') {
          expect(effect.general.scoreModifier).toBeLessThan(0);
        }
      });
    });

    it('stacking 7 powerful traits stays within ≤0.5 total / ≤50 point bonus', () => {
      // Since q117 only resilient and eagerLearner give a bonus; each is listed
      // several times so seven are stacked.
      const horse = mkHorse([
        'resilient',
        'eagerLearner',
        'resilient',
        'eagerLearner',
        'resilient',
        'eagerLearner',
        'eager_learner',
      ]);
      const result = calculateTraitCompetitionImpact(horse, 'Show Jumping', 100);
      expect(result.totalScoreModifier).toBeLessThanOrEqual(0.5);
      expect(result.finalScoreAdjustment).toBeLessThanOrEqual(50);
    });
  });
});
