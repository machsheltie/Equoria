/**
 * Pure-export unit tests for:
 *  - groomBonusTraitService (validateBonusTraits)
 *  - legacyScoreCalculator (getLegacyScoreDefinitions)
 *  - legacyScoreTraitCalculator (getTraitScoringDefinitions)
 */

import { describe, it, expect } from '@jest/globals';

import { validateBonusTraits } from '../modules/grooms/services/groomBonusTraitService.mjs';

import { getLegacyScoreDefinitions } from '../modules/horses/services/legacyScoreCalculator.mjs';

import { getTraitScoringDefinitions } from '../modules/traits/services/legacyScoreTraitCalculator.mjs';

// Owner ruling 2026-10-28 q154 (Equoria-4fa7s): a show handler is the horse's
// groom and any groom may handle in any class. Old contract: groomHandlerService's
// bonus tables and calculateHandlerBonus judged a groom per conformation class
// and priced per-discipline handler bonuses; they were removed with that
// ruling, and so were their tests here.

// ─── validateBonusTraits ─────────────────────────────────────────────────────

describe('validateBonusTraits', () => {
  it('returns valid=true for an empty object', () => {
    const result = validateBonusTraits({});
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid=true for a single valid trait bonus', () => {
    const result = validateBonusTraits({ speed: 0.1 });
    expect(result.valid).toBe(true);
  });

  it('returns valid=false for null input', () => {
    const result = validateBonusTraits(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns valid=false for non-object input', () => {
    const result = validateBonusTraits('string');
    expect(result.valid).toBe(false);
  });

  it('returns valid=false when more than 3 traits provided', () => {
    const result = validateBonusTraits({
      speed: 0.1,
      stamina: 0.1,
      agility: 0.1,
      boldness: 0.1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Maximum'))).toBe(true);
  });

  it('returns valid=false for a non-numeric bonus value', () => {
    const result = validateBonusTraits({ speed: 'fast' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('must be a number'))).toBe(true);
  });

  it('returns valid=false for bonus above 0.3 (MAX_TRAIT_BONUS)', () => {
    const result = validateBonusTraits({ speed: 0.5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('between 0 and'))).toBe(true);
  });

  it('returns valid=false for negative bonus', () => {
    const result = validateBonusTraits({ speed: -0.1 });
    expect(result.valid).toBe(false);
  });

  it('returns valid=true for bonus at boundary 0', () => {
    const result = validateBonusTraits({ speed: 0 });
    expect(result.valid).toBe(true);
  });

  it('returns valid=true for bonus at boundary 0.3', () => {
    const result = validateBonusTraits({ speed: 0.3 });
    expect(result.valid).toBe(true);
  });
});

// ─── getLegacyScoreDefinitions ───────────────────────────────────────────────

describe('getLegacyScoreDefinitions', () => {
  it('returns maxScores, grades, components', () => {
    const defs = getLegacyScoreDefinitions();
    expect(defs).toHaveProperty('maxScores');
    expect(defs).toHaveProperty('grades');
    expect(defs).toHaveProperty('components');
  });

  it('maxScores has all required keys', () => {
    const { maxScores } = getLegacyScoreDefinitions();
    expect(maxScores).toHaveProperty('baseStats');
    expect(maxScores).toHaveProperty('achievements');
    expect(maxScores).toHaveProperty('traitScore');
    expect(maxScores).toHaveProperty('breedingValue');
    expect(maxScores).toHaveProperty('total');
  });

  it('grades includes S, A, B, C, D, F', () => {
    const { grades } = getLegacyScoreDefinitions();
    for (const g of ['S', 'A', 'B', 'C', 'D', 'F']) {
      expect(grades).toHaveProperty(g);
    }
  });

  it('grade S has higher min than grade A', () => {
    const { grades } = getLegacyScoreDefinitions();
    expect(grades.S.min).toBeGreaterThan(grades.A.min);
  });

  it('grade F has min of 0', () => {
    const { grades } = getLegacyScoreDefinitions();
    expect(grades.F.min).toBe(0);
  });

  it('each grade has name and description', () => {
    const { grades } = getLegacyScoreDefinitions();
    for (const grade of Object.values(grades)) {
      expect(typeof grade.name).toBe('string');
      expect(typeof grade.description).toBe('string');
    }
  });
});

// ─── getTraitScoringDefinitions ──────────────────────────────────────────────

describe('getTraitScoringDefinitions', () => {
  it('returns maxScores, ageCutoff, rareTraits, negativeTraits, negativeTraitPenalties, scoringRules', () => {
    const defs = getTraitScoringDefinitions();
    expect(defs).toHaveProperty('maxScores');
    expect(defs).toHaveProperty('ageCutoff');
    expect(defs).toHaveProperty('rareTraits');
    expect(defs).toHaveProperty('negativeTraits');
    expect(defs).toHaveProperty('negativeTraitPenalties');
    expect(defs).toHaveProperty('scoringRules');
  });

  it('maxScores.total equals sum of component maxScores', () => {
    const { maxScores } = getTraitScoringDefinitions();
    const computed = maxScores.traitCount + maxScores.diversity + maxScores.rareTraits + maxScores.groomCare;
    expect(maxScores.total).toBe(computed);
  });

  it('ageCutoff has days and years fields', () => {
    const { ageCutoff } = getTraitScoringDefinitions();
    expect(typeof ageCutoff.days).toBe('number');
    expect(typeof ageCutoff.years).toBe('number');
    expect(ageCutoff.days).toBeGreaterThan(0);
  });

  it('rareTraits is a non-empty array', () => {
    const { rareTraits } = getTraitScoringDefinitions();
    expect(Array.isArray(rareTraits)).toBe(true);
    expect(rareTraits.length).toBeGreaterThan(0);
  });

  it('negativeTraits is a non-empty array', () => {
    const { negativeTraits } = getTraitScoringDefinitions();
    expect(Array.isArray(negativeTraits)).toBe(true);
    expect(negativeTraits.length).toBeGreaterThan(0);
  });

  it('negativeTraitPenalties entries are all negative numbers', () => {
    const { negativeTraitPenalties } = getTraitScoringDefinitions();
    for (const penalty of Object.values(negativeTraitPenalties)) {
      expect(penalty).toBeLessThan(0);
    }
  });

  it('scoringRules has traitCount, diversity, rareTraits, groomCare, negativeTraits', () => {
    const { scoringRules } = getTraitScoringDefinitions();
    for (const key of ['traitCount', 'diversity', 'rareTraits', 'groomCare', 'negativeTraits']) {
      expect(scoringRules).toHaveProperty(key);
    }
  });
});
