/**
 * pregnancyBonus + riderBonus + statMap + getStatScore — unit tests (Equoria-rr7)
 *
 * All pure functions: no DB, no Prisma, no external I/O.
 */

import { describe, it, expect } from '@jest/globals';

// pregnancyBonus
import {
  PREGNANCY_BONUS_PCT,
  NEG_PER_MISSED_DAY,
  GESTATION_DAYS,
  calculatePregnancyEpigeneticChances,
} from '../../utils/pregnancyBonus.mjs';

// riderBonus
import { applyRiderModifiers } from '../../utils/riderBonus.mjs';

// statMap
import {
  statMap,
  getStatsForDiscipline,
  getAllDisciplines,
  getAllStatCategories,
  isDisciplineValid,
} from '../../utils/statMap.mjs';

// getStatScore
import { getStatScore } from '../../utils/getStatScore.mjs';

// ---------------------------------------------------------------------------
// pregnancyBonus — constants
// ---------------------------------------------------------------------------
describe('PREGNANCY_BONUS_PCT', () => {
  it('basic tier has 0 bonus', () => {
    expect(PREGNANCY_BONUS_PCT.basic).toBe(0);
  });

  it('elite tier has 20 bonus points', () => {
    expect(PREGNANCY_BONUS_PCT.elite).toBe(20);
  });

  it('tiers are ordered by value', () => {
    expect(PREGNANCY_BONUS_PCT.basic).toBeLessThan(PREGNANCY_BONUS_PCT.performance);
    expect(PREGNANCY_BONUS_PCT.performance).toBeLessThan(PREGNANCY_BONUS_PCT.performancePlus);
    expect(PREGNANCY_BONUS_PCT.performancePlus).toBeLessThan(PREGNANCY_BONUS_PCT.highPerformance);
    expect(PREGNANCY_BONUS_PCT.highPerformance).toBeLessThan(PREGNANCY_BONUS_PCT.elite);
  });
});

describe('NEG_PER_MISSED_DAY and GESTATION_DAYS', () => {
  it('NEG_PER_MISSED_DAY is 5', () => {
    expect(NEG_PER_MISSED_DAY).toBe(5);
  });

  it('GESTATION_DAYS is 7', () => {
    expect(GESTATION_DAYS).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// calculatePregnancyEpigeneticChances
// ---------------------------------------------------------------------------
describe('calculatePregnancyEpigeneticChances', () => {
  it('returns zero positive_chance and 35 negative_chance for null (all missed)', () => {
    const result = calculatePregnancyEpigeneticChances(null);
    expect(result.positive_chance).toBe(0);
    expect(result.negative_chance).toBe(35); // 7 days * 5
  });

  it('returns zero positive_chance for undefined input', () => {
    const result = calculatePregnancyEpigeneticChances(undefined);
    expect(result.positive_chance).toBe(0);
    expect(result.negative_chance).toBe(35);
  });

  it('returns zero positive_chance for empty object', () => {
    const result = calculatePregnancyEpigeneticChances({});
    expect(result.positive_chance).toBe(0);
    expect(result.negative_chance).toBe(35);
  });

  it('basic tier feedings contribute zero positive_chance', () => {
    const result = calculatePregnancyEpigeneticChances({ basic: 7 });
    expect(result.positive_chance).toBe(0);
    expect(result.negative_chance).toBe(0); // 7 feedings → 0 unfed days
  });

  it('7 elite feedings produce maximum positive_chance = 20', () => {
    // weightedSum = 7 * 20 = 140, divisor = max(7, 7) = 7, positive_chance = 20
    const result = calculatePregnancyEpigeneticChances({ elite: 7 });
    expect(result.positive_chance).toBe(20);
    expect(result.negative_chance).toBe(0);
  });

  it('mixed tier feedings blend correctly', () => {
    // 4 performancePlus (10) + 3 highPerformance (15) = 4*10 + 3*15 = 85
    // divisor = max(7, 7) = 7, positive_chance = 85/7 ≈ 12.14
    const result = calculatePregnancyEpigeneticChances({ performancePlus: 4, highPerformance: 3 });
    expect(result.positive_chance).toBeCloseTo(85 / 7, 5);
    expect(result.negative_chance).toBe(0);
  });

  it('under-feeding raises negative_chance proportionally', () => {
    // 5 elite feedings → unfedDays = max(0, 7 - 5) = 2 → negative_chance = 10
    const result = calculatePregnancyEpigeneticChances({ elite: 5 });
    expect(result.negative_chance).toBe(10);
  });

  it('ignores unknown tier keys silently', () => {
    const result = calculatePregnancyEpigeneticChances({ unknownTier: 7, elite: 7 });
    expect(result.positive_chance).toBe(20); // elite only
    expect(result.negative_chance).toBe(0);
  });

  it('more feedings than GESTATION_DAYS caps divisor at totalFeedings', () => {
    // 10 elite feedings → divisor = max(7, 10) = 10, positive_chance = (10*20)/10 = 20
    const result = calculatePregnancyEpigeneticChances({ elite: 10 });
    expect(result.positive_chance).toBe(20);
    expect(result.negative_chance).toBe(0); // unfedDays = max(0, 7-10) = 0
  });

  it('returns an object with both fields', () => {
    const result = calculatePregnancyEpigeneticChances({ performance: 7 });
    expect(typeof result.positive_chance).toBe('number');
    expect(typeof result.negative_chance).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// applyRiderModifiers
// ---------------------------------------------------------------------------
describe('applyRiderModifiers', () => {
  it('returns unchanged score for zero bonus and penalty', () => {
    expect(applyRiderModifiers(100, 0, 0)).toBe(100);
  });

  it('uses 0 defaults when bonus and penalty omitted', () => {
    expect(applyRiderModifiers(80)).toBe(80);
  });

  it('applies bonus correctly: score * (1 + bonus)', () => {
    expect(applyRiderModifiers(100, 0.1, 0)).toBeCloseTo(110, 5);
  });

  it('applies penalty correctly: score * (1 - penalty)', () => {
    expect(applyRiderModifiers(100, 0, 0.08)).toBeCloseTo(92, 5);
  });

  it('applies both bonus and penalty: score * (1 + bonus - penalty)', () => {
    expect(applyRiderModifiers(100, 0.05, 0.02)).toBeCloseTo(103, 5);
  });

  it('throws if score is negative', () => {
    expect(() => applyRiderModifiers(-1)).toThrow();
  });

  it('throws if score is not a number', () => {
    expect(() => applyRiderModifiers('bad')).toThrow();
  });

  it('throws if bonusPercent exceeds 0.10', () => {
    expect(() => applyRiderModifiers(100, 0.11, 0)).toThrow();
  });

  it('throws if penaltyPercent exceeds 0.08', () => {
    expect(() => applyRiderModifiers(100, 0, 0.09)).toThrow();
  });

  it('throws if bonusPercent is negative', () => {
    expect(() => applyRiderModifiers(100, -0.01, 0)).toThrow();
  });

  it('accepts boundary values without throwing', () => {
    expect(() => applyRiderModifiers(0, 0, 0)).not.toThrow();
    expect(() => applyRiderModifiers(100, 0.1, 0.08)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// statMap + getStatsForDiscipline + getAllDisciplines + isDisciplineValid
// ---------------------------------------------------------------------------
describe('statMap', () => {
  it('is a non-null object', () => {
    expect(statMap).not.toBeNull();
    expect(typeof statMap).toBe('object');
  });

  it('has at least 20 disciplines', () => {
    expect(Object.keys(statMap).length).toBeGreaterThanOrEqual(20);
  });

  it('each discipline maps to an array of 3 stats', () => {
    for (const stats of Object.values(statMap)) {
      expect(Array.isArray(stats)).toBe(true);
      expect(stats).toHaveLength(3);
    }
  });
});

describe('getStatsForDiscipline', () => {
  it('returns [speed, stamina, focus] for Racing', () => {
    const stats = getStatsForDiscipline('Racing');
    expect(stats).toEqual(['speed', 'stamina', 'focus']);
  });

  it('returns [precision, focus, obedience] for Dressage', () => {
    const stats = getStatsForDiscipline('Dressage');
    expect(stats).toEqual(['precision', 'focus', 'obedience']);
  });

  it('returns null for unknown discipline', () => {
    expect(getStatsForDiscipline('FakeDisc')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getStatsForDiscipline('')).toBeNull();
  });
});

describe('getAllDisciplines', () => {
  it('returns an array', () => {
    expect(Array.isArray(getAllDisciplines())).toBe(true);
  });

  it('includes Racing and Dressage', () => {
    const all = getAllDisciplines();
    expect(all).toContain('Racing');
    expect(all).toContain('Dressage');
  });
});

describe('getAllStatCategories', () => {
  it('returns unique sorted stat names', () => {
    const cats = getAllStatCategories();
    expect(Array.isArray(cats)).toBe(true);
    // Should include core stats
    expect(cats).toContain('speed');
    expect(cats).toContain('stamina');
    expect(cats).toContain('agility');
  });

  it('has no duplicates', () => {
    const cats = getAllStatCategories();
    const unique = new Set(cats);
    expect(cats).toHaveLength(unique.size);
  });
});

describe('isDisciplineValid', () => {
  it('returns true for valid discipline', () => {
    expect(isDisciplineValid('Racing')).toBe(true);
  });

  it('returns false for unknown discipline', () => {
    expect(isDisciplineValid('FakeDisc')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isDisciplineValid('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getStatScore
// ---------------------------------------------------------------------------
describe('getStatScore', () => {
  const horse = {
    speed: 80,
    stamina: 60,
    focus: 40,
    agility: 70,
    precision: 50,
    obedience: 30,
    balance: 55,
    boldness: 45,
    intelligence: 65,
    flexibility: 35,
  };

  it('throws if horse is falsy', () => {
    expect(() => getStatScore(null, 'Racing')).toThrow('Horse object is required');
  });

  it('throws if discipline is falsy', () => {
    expect(() => getStatScore(horse, '')).toThrow('Discipline is required');
  });

  it('throws for unknown discipline', () => {
    expect(() => getStatScore(horse, 'FakeDiscipline')).toThrow('Unknown discipline');
  });

  it('returns correct weighted score for Racing (speed 50%, stamina 30%, focus 20%)', () => {
    // speed=80, stamina=60, focus=40 → 0.5*80 + 0.3*60 + 0.2*40 = 40 + 18 + 8 = 66
    const result = getStatScore(horse, 'Racing');
    expect(result).toBeCloseTo(66, 5);
  });

  it('returns correct weighted score for Dressage (precision 50%, focus 30%, obedience 20%)', () => {
    // precision=50, focus=40, obedience=30 → 0.5*50 + 0.3*40 + 0.2*30 = 25 + 12 + 6 = 43
    const result = getStatScore(horse, 'Dressage');
    expect(result).toBeCloseTo(43, 5);
  });

  it('defaults missing stat to 0', () => {
    const sparseHorse = { speed: 80 };
    const result = getStatScore(sparseHorse, 'Racing');
    // speed=80 (50%), stamina=0 (30%), focus=0 (20%) → 40
    expect(result).toBeCloseTo(40, 5);
  });

  it('throws when stat value is non-numeric string', () => {
    const badHorse = { speed: 'fast', stamina: 60, focus: 40 };
    expect(() => getStatScore(badHorse, 'Racing')).toThrow();
  });
});
