/**
 * Pure-export unit tests for:
 *  - groomHandlerService (constants + calculateHandlerBonus)
 *  - groomBonusTraitService (validateBonusTraits)
 *  - legacyScoreCalculator (getLegacyScoreDefinitions)
 *  - legacyScoreTraitCalculator (getTraitScoringDefinitions)
 */

import { describe, it, expect } from '@jest/globals';

import {
  HANDLER_SKILL_BONUSES,
  PERSONALITY_DISCIPLINE_SYNERGY,
  SPECIALTY_DISCIPLINE_BONUSES,
  calculateHandlerBonus,
} from '../services/groomHandlerService.mjs';

import { validateBonusTraits } from '../services/groomBonusTraitService.mjs';

import { getLegacyScoreDefinitions } from '../../horses/index.mjs';

import { getTraitScoringDefinitions } from '../../traits/index.mjs';

// ─── HANDLER_SKILL_BONUSES ───────────────────────────────────────────────────

describe('HANDLER_SKILL_BONUSES', () => {
  it('has entries for novice, intermediate, expert, master', () => {
    expect(HANDLER_SKILL_BONUSES).toHaveProperty('novice');
    expect(HANDLER_SKILL_BONUSES).toHaveProperty('intermediate');
    expect(HANDLER_SKILL_BONUSES).toHaveProperty('expert');
    expect(HANDLER_SKILL_BONUSES).toHaveProperty('master');
  });

  it('baseBonus increases with skill level', () => {
    expect(HANDLER_SKILL_BONUSES.novice.baseBonus).toBeLessThan(HANDLER_SKILL_BONUSES.intermediate.baseBonus);
    expect(HANDLER_SKILL_BONUSES.intermediate.baseBonus).toBeLessThan(HANDLER_SKILL_BONUSES.expert.baseBonus);
    expect(HANDLER_SKILL_BONUSES.expert.baseBonus).toBeLessThan(HANDLER_SKILL_BONUSES.master.baseBonus);
  });

  it('maxBonus increases with skill level', () => {
    expect(HANDLER_SKILL_BONUSES.novice.maxBonus).toBeLessThan(HANDLER_SKILL_BONUSES.master.maxBonus);
  });

  it('each entry has baseBonus, maxBonus, experienceMultiplier', () => {
    for (const level of ['novice', 'intermediate', 'expert', 'master']) {
      expect(HANDLER_SKILL_BONUSES[level]).toHaveProperty('baseBonus');
      expect(HANDLER_SKILL_BONUSES[level]).toHaveProperty('maxBonus');
      expect(HANDLER_SKILL_BONUSES[level]).toHaveProperty('experienceMultiplier');
    }
  });
});

// ─── PERSONALITY_DISCIPLINE_SYNERGY ─────────────────────────────────────────

describe('PERSONALITY_DISCIPLINE_SYNERGY', () => {
  it('includes gentle, energetic, patient, strict, calm, confident', () => {
    const expected = ['gentle', 'energetic', 'patient', 'strict', 'calm', 'confident'];
    for (const p of expected) {
      expect(PERSONALITY_DISCIPLINE_SYNERGY).toHaveProperty(p);
    }
  });

  it('each entry has beneficial array and bonus number', () => {
    for (const [, value] of Object.entries(PERSONALITY_DISCIPLINE_SYNERGY)) {
      expect(Array.isArray(value.beneficial)).toBe(true);
      expect(typeof value.bonus).toBe('number');
      expect(value.bonus).toBeGreaterThan(0);
    }
  });

  it('Dressage appears in gentle.beneficial', () => {
    expect(PERSONALITY_DISCIPLINE_SYNERGY.gentle.beneficial).toContain('Dressage');
  });

  it('Racing appears in energetic.beneficial', () => {
    expect(PERSONALITY_DISCIPLINE_SYNERGY.energetic.beneficial).toContain('Racing');
  });
});

// ─── SPECIALTY_DISCIPLINE_BONUSES ────────────────────────────────────────────

describe('SPECIALTY_DISCIPLINE_BONUSES', () => {
  it('includes showHandling, racing, western, training, foalCare, general', () => {
    const expected = ['showHandling', 'racing', 'western', 'training', 'foalCare', 'general'];
    for (const s of expected) {
      expect(SPECIALTY_DISCIPLINE_BONUSES).toHaveProperty(s);
    }
  });

  it('each entry has disciplines array and bonus number', () => {
    for (const [, value] of Object.entries(SPECIALTY_DISCIPLINE_BONUSES)) {
      expect(Array.isArray(value.disciplines)).toBe(true);
      expect(typeof value.bonus).toBe('number');
      expect(value.bonus).toBeGreaterThan(0);
    }
  });

  it('racing specialty has higher bonus than general', () => {
    expect(SPECIALTY_DISCIPLINE_BONUSES.racing.bonus).toBeGreaterThan(SPECIALTY_DISCIPLINE_BONUSES.general.bonus);
  });
});

// ─── calculateHandlerBonus ───────────────────────────────────────────────────

describe('calculateHandlerBonus', () => {
  const groom = {
    name: 'Alice',
    skillLevel: 'expert',
    speciality: 'showHandling',
    personality: 'gentle',
  };
  const horse = { id: 1, traits: [] };

  it('returns zero bonus for non-conformation discipline', () => {
    const result = calculateHandlerBonus(groom, horse, 'Racing');
    expect(result.handlerBonus).toBe(0);
    expect(result.isConformationShow).toBe(false);
  });

  it('returns positive bonus for a valid conformation class', () => {
    // isValidConformationClass checks CONFORMATION_CLASSES from schema.mjs
    // valid values: 'Foals/Youngstock', 'Mares', 'Stallions', 'Veterans', etc.
    const result = calculateHandlerBonus(groom, horse, 'Mares');
    expect(result.handlerBonus).toBeGreaterThan(0);
    expect(result.isConformationShow).toBe(true);
  });

  it('includes groomName in result', () => {
    const result = calculateHandlerBonus(groom, horse, 'Racing');
    expect(result.groomName).toBe('Alice');
  });

  it('includes bonusBreakdown with totalBonus', () => {
    const result = calculateHandlerBonus(groom, horse, 'Racing');
    expect(result.bonusBreakdown).toHaveProperty('totalBonus');
  });

  it('non-conformation result has all breakdown keys as 0', () => {
    const result = calculateHandlerBonus(groom, horse, 'Barrel Racing');
    const { skillBonus, experienceBonus, personalityBonus, specialtyBonus, bondBonus, totalBonus } =
      result.bonusBreakdown;
    expect(skillBonus).toBe(0);
    expect(experienceBonus).toBe(0);
    expect(personalityBonus).toBe(0);
    expect(specialtyBonus).toBe(0);
    expect(bondBonus).toBe(0);
    expect(totalBonus).toBe(0);
  });
});

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
