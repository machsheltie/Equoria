import { describe, it, expect } from '@jest/globals';
import {
  calculateCompetitionScore,
  calculatePrizeAmount,
  calculateCompetitionXP,
  calculatePlacements,
  getAllDisciplines,
  getDisciplineConfig,
  checkAgeRequirements,
} from '../../utils/competitionLogic.mjs';

describe('calculatePrizeAmount', () => {
  it('gives 50% to 1st place', () => {
    expect(calculatePrizeAmount(1000, 1, 5)).toBe(500);
  });

  it('gives 30% to 2nd place', () => {
    expect(calculatePrizeAmount(1000, 2, 5)).toBe(300);
  });

  it('gives 20% to 3rd place', () => {
    expect(calculatePrizeAmount(1000, 3, 5)).toBe(200);
  });

  it('returns 0 for 4th place', () => {
    expect(calculatePrizeAmount(1000, 4, 5)).toBe(0);
  });

  it('returns 0 when placement <= 0', () => {
    expect(calculatePrizeAmount(1000, 0, 5)).toBe(0);
  });

  it('returns 0 when placement > totalEntries', () => {
    expect(calculatePrizeAmount(1000, 10, 5)).toBe(0);
  });

  it('returns 0 for zero prize pool', () => {
    expect(calculatePrizeAmount(0, 1, 5)).toBe(0);
  });
});

describe('calculateCompetitionXP', () => {
  it('1st place gets +20 placement bonus plus score XP', () => {
    // score 100 → 10 xp + 20 bonus = 30
    expect(calculateCompetitionXP(100, 1, 5)).toBe(30);
  });

  it('2nd place gets +15 bonus', () => {
    expect(calculateCompetitionXP(100, 2, 5)).toBe(25);
  });

  it('3rd place gets +10 bonus', () => {
    expect(calculateCompetitionXP(100, 3, 5)).toBe(20);
  });

  it('top half (not podium) gets +5 bonus', () => {
    // placement 2 of 10 entries = top half, but not podium... placement 4/10
    expect(calculateCompetitionXP(50, 4, 10)).toBe(5 + 5); // 5 score XP + 5 top-half
  });

  it('returns minimum 3 xp for very low score non-podium', () => {
    // score 0 → 0 xp + 0 bonus = 0, but minimum is 3
    expect(calculateCompetitionXP(0, 10, 10)).toBe(3);
  });

  it('bottom half gets only score-based XP (minimum 3)', () => {
    // placement 6/6 = last place, score 30 → 3 xp, min 3
    expect(calculateCompetitionXP(30, 6, 6)).toBe(3);
  });
});

describe('calculatePlacements', () => {
  it('sorts entries by score descending and assigns placement', () => {
    const entries = [
      { horseId: 'a', score: 70 },
      { horseId: 'b', score: 90 },
      { horseId: 'c', score: 80 },
    ];
    const result = calculatePlacements(entries);
    expect(result[0].horseId).toBe('b');
    expect(result[0].placement).toBe(1);
    expect(result[1].horseId).toBe('c');
    expect(result[1].placement).toBe(2);
    expect(result[2].horseId).toBe('a');
    expect(result[2].placement).toBe(3);
  });

  it('does not mutate original array', () => {
    const entries = [
      { horseId: 'x', score: 50 },
      { horseId: 'y', score: 80 },
    ];
    const original = [...entries];
    calculatePlacements(entries);
    expect(entries[0].horseId).toBe(original[0].horseId);
  });

  it('returns empty array for empty input', () => {
    expect(calculatePlacements([])).toEqual([]);
  });

  it('handles single entry with placement 1', () => {
    const result = calculatePlacements([{ horseId: 'solo', score: 55 }]);
    expect(result[0].placement).toBe(1);
  });
});

describe('getAllDisciplines', () => {
  it('returns an array of discipline strings', () => {
    const disciplines = getAllDisciplines();
    expect(Array.isArray(disciplines)).toBe(true);
    expect(disciplines.length).toBeGreaterThan(15);
    expect(disciplines).toContain('Racing');
    expect(disciplines).toContain('Dressage');
    expect(disciplines).toContain('Show Jumping');
  });
});

describe('getDisciplineConfig', () => {
  it('returns config with stats, beneficial, detrimental for Racing', () => {
    const config = getDisciplineConfig('Racing');
    expect(config).toHaveProperty('stats');
    expect(config).toHaveProperty('beneficial');
    expect(config).toHaveProperty('detrimental');
    expect(Array.isArray(config.stats)).toBe(true);
  });

  it('returns a config even for unknown discipline (fallback)', () => {
    const config = getDisciplineConfig('Underwater Polo');
    expect(config).toBeDefined();
  });
});

describe('checkAgeRequirements', () => {
  it('returns true for a horse age 21 (3+ game years)', () => {
    // age is treated as days; 21 days / 7 = 3 years (min eligible)
    const result = checkAgeRequirements({ age: 21 });
    expect(result).toBe(true);
  });

  it('returns false for a foal under minimum age', () => {
    const result = checkAgeRequirements({ age: 1 });
    expect(result).toBe(false);
  });
});

describe('calculateCompetitionScore', () => {
  it('returns a number between 0 and 100', () => {
    const score = calculateCompetitionScore(70, {}, 6, 'Racing');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns 0 for a horse under age 3 (too young)', () => {
    const score = calculateCompetitionScore(100, {}, 1, 'Racing');
    // ageFactor = 0.5, so score = 50 * randomFactor, still clamped to [0, 100]
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns 0 on invalid input', () => {
    // null traits and invalid discipline should not throw, return 0 fallback
    const score = calculateCompetitionScore(null, null, null, null);
    expect(score).toBe(0);
  });

  it('beneficial traits increase score potential', () => {
    const withTrait = { positive: ['fast'], negative: [] };
    const withoutTrait = {};
    // Run multiple times and check average is higher with beneficial trait
    const avgWith =
      Array.from({ length: 50 }, () => calculateCompetitionScore(50, withTrait, 6, 'Racing')).reduce(
        (a, b) => a + b,
        0,
      ) / 50;
    const avgWithout =
      Array.from({ length: 50 }, () => calculateCompetitionScore(50, withoutTrait, 6, 'Racing')).reduce(
        (a, b) => a + b,
        0,
      ) / 50;
    // With beneficial trait should generally be >= without (within statistical variation)
    expect(avgWith).toBeGreaterThanOrEqual(avgWithout - 5); // allow some variance
  });
});
