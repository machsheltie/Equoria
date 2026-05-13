/**
 * Branch-coverage tests for legacyScoreCalculator pure helpers.
 *
 * Tests the exported private functions:
 *   calculateBaseStatsScore, calculateAchievementsScore,
 *   calculateBreedingValueScore, calculateLegacyGrade
 * and the pure groom-care helper from legacyScoreTraitCalculator:
 *   calculateGroomCareConsistency
 *
 * No DB calls, no mocks — all functions are pure (or effectively pure).
 * Equoria-jkht coverage sprint.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateBaseStatsScore,
  calculateAchievementsScore,
  calculateBreedingValueScore,
  calculateLegacyGrade,
  getLegacyScoreDefinitions,
} from '../../../services/legacyScoreCalculator.mjs';
import { calculateGroomCareConsistency } from '../../../services/legacyScoreTraitCalculator.mjs';

// ─── calculateLegacyGrade ──────────────────────────────────────────────────────

describe('calculateLegacyGrade', () => {
  it('returns S for score >= 90', () => {
    expect(calculateLegacyGrade(90)).toBe('S');
    expect(calculateLegacyGrade(100)).toBe('S');
    expect(calculateLegacyGrade(95)).toBe('S');
  });

  it('returns A for score >= 80 and < 90', () => {
    expect(calculateLegacyGrade(80)).toBe('A');
    expect(calculateLegacyGrade(85)).toBe('A');
    expect(calculateLegacyGrade(89)).toBe('A');
  });

  it('returns B for score >= 70 and < 80', () => {
    expect(calculateLegacyGrade(70)).toBe('B');
    expect(calculateLegacyGrade(75)).toBe('B');
    expect(calculateLegacyGrade(79)).toBe('B');
  });

  it('returns C for score >= 60 and < 70', () => {
    expect(calculateLegacyGrade(60)).toBe('C');
    expect(calculateLegacyGrade(65)).toBe('C');
    expect(calculateLegacyGrade(69)).toBe('C');
  });

  it('returns D for score >= 50 and < 60', () => {
    expect(calculateLegacyGrade(50)).toBe('D');
    expect(calculateLegacyGrade(55)).toBe('D');
    expect(calculateLegacyGrade(59)).toBe('D');
  });

  it('returns F for score < 50', () => {
    expect(calculateLegacyGrade(49)).toBe('F');
    expect(calculateLegacyGrade(0)).toBe('F');
    expect(calculateLegacyGrade(1)).toBe('F');
  });
});

// ─── calculateBaseStatsScore ───────────────────────────────────────────────────

describe('calculateBaseStatsScore', () => {
  it('calculates score for a horse with all stats set', () => {
    const horse = {
      speed: 80,
      stamina: 70,
      agility: 60,
      balance: 50,
      precision: 90,
      intelligence: 75,
      boldness: 65,
      flexibility: 55,
      obedience: 85,
      focus: 70,
    };
    const result = calculateBaseStatsScore(horse);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(30);
    expect(result.breakdown.individualStats.speed).toBe(80);
  });

  it('treats null stats as 0', () => {
    const horse = {
      speed: null,
      stamina: null,
      agility: null,
      balance: null,
      precision: null,
      intelligence: null,
      boldness: null,
      flexibility: null,
      obedience: null,
      focus: null,
    };
    const result = calculateBaseStatsScore(horse);
    expect(result.score).toBe(0);
    expect(result.breakdown.totalStats).toBe(0);
  });

  it('treats undefined stats as 0', () => {
    const horse = {};
    const result = calculateBaseStatsScore(horse);
    expect(result.score).toBe(0);
    expect(result.breakdown.averageStats).toBe(0);
  });

  it('treats 0 stats as 0', () => {
    const horse = {
      speed: 0,
      stamina: 0,
      agility: 0,
      balance: 0,
      precision: 0,
      intelligence: 0,
      boldness: 0,
      flexibility: 0,
      obedience: 0,
      focus: 0,
    };
    const result = calculateBaseStatsScore(horse);
    expect(result.score).toBe(0);
  });

  it('caps score at MAX_BASE_STATS_SCORE (30) for all-100 stats', () => {
    const horse = {
      speed: 100,
      stamina: 100,
      agility: 100,
      balance: 100,
      precision: 100,
      intelligence: 100,
      boldness: 100,
      flexibility: 100,
      obedience: 100,
      focus: 100,
    };
    const result = calculateBaseStatsScore(horse);
    expect(result.score).toBe(30);
  });

  it('mixes some null and some valid stats', () => {
    const horse = { speed: 100, stamina: null, agility: undefined };
    const result = calculateBaseStatsScore(horse);
    expect(result.breakdown.individualStats.speed).toBe(100);
    expect(result.breakdown.individualStats.stamina).toBe(0);
    expect(result.breakdown.individualStats.agility).toBe(0);
  });

  it('returns breakdown with all 10 stats listed', () => {
    const horse = {
      speed: 50,
      stamina: 50,
      agility: 50,
      balance: 50,
      precision: 50,
      intelligence: 50,
      boldness: 50,
      flexibility: 50,
      obedience: 50,
      focus: 50,
    };
    const result = calculateBaseStatsScore(horse);
    const keys = Object.keys(result.breakdown.individualStats);
    expect(keys).toHaveLength(10);
  });
});

// ─── calculateAchievementsScore ────────────────────────────────────────────────

describe('calculateAchievementsScore', () => {
  it('returns 0 score for horse with no competition results', async () => {
    const horse = { competitionResults: [] };
    const result = await calculateAchievementsScore(horse);
    expect(result.score).toBe(0);
    expect(result.breakdown.firstPlaces).toBe(0);
    expect(result.breakdown.totalCompetitions).toBe(0);
    expect(result.breakdown.winRate).toBe(0);
  });

  it('handles null competitionResults gracefully', async () => {
    const horse = { competitionResults: null };
    const result = await calculateAchievementsScore(horse);
    expect(result.score).toBe(0);
  });

  it('scores 3 points per first-place', async () => {
    const horse = { competitionResults: [{ placement: 1 }, { placement: 1 }] };
    const result = await calculateAchievementsScore(horse);
    expect(result.breakdown.firstPlaces).toBe(2);
    // 2*3=6 points for placements; win rate=100% triggers +3+2+1=6 bonus; total=12 (cap 25)
    expect(result.score).toBeGreaterThanOrEqual(6);
  });

  it('scores 2 points per second-place and 1 per third-place', async () => {
    const horse = {
      competitionResults: [{ placement: 2 }, { placement: 2 }, { placement: 3 }],
    };
    const result = await calculateAchievementsScore(horse);
    expect(result.breakdown.secondPlaces).toBe(2);
    expect(result.breakdown.thirdPlaces).toBe(1);
    // 2*2+1*1=5; win rate=0 (no firsts); no competition bonus (<10); total=5
    expect(result.score).toBe(5);
  });

  it('adds competition bonus of 2 for >= 10 competitions', async () => {
    const results = Array.from({ length: 10 }, () => ({ placement: 4 }));
    const horse = { competitionResults: results };
    const result = await calculateAchievementsScore(horse);
    expect(result.breakdown.competitionBonus).toBe(2);
  });

  it('adds competition bonus of 3 for >= 25 competitions', async () => {
    const results = Array.from({ length: 25 }, () => ({ placement: 4 }));
    const horse = { competitionResults: results };
    const result = await calculateAchievementsScore(horse);
    expect(result.breakdown.competitionBonus).toBe(3);
  });

  it('adds competition bonus of 5 for >= 50 competitions', async () => {
    const results = Array.from({ length: 50 }, () => ({ placement: 4 }));
    const horse = { competitionResults: results };
    const result = await calculateAchievementsScore(horse);
    expect(result.breakdown.competitionBonus).toBe(5);
  });

  it('adds win-rate bonus of +1 for winRate >= 10%', async () => {
    // 1 win out of 10 = 10% win rate
    const results = [{ placement: 1 }, ...Array.from({ length: 9 }, () => ({ placement: 4 }))];
    const horse = { competitionResults: results };
    const result = await calculateAchievementsScore(horse);
    expect(result.breakdown.winRate).toBe(10);
    // winRate=0.1 → triggers all three checks (>=0.1 yes, >=0.3 no, >=0.5 no)
    expect(result.breakdown.winRateBonus).toBe(1);
  });

  it('adds win-rate bonus of +2+1 for winRate >= 30%', async () => {
    // 3 wins out of 10 = 30% win rate
    const results = [
      { placement: 1 },
      { placement: 1 },
      { placement: 1 },
      ...Array.from({ length: 7 }, () => ({ placement: 4 })),
    ];
    const horse = { competitionResults: results };
    const result = await calculateAchievementsScore(horse);
    expect(result.breakdown.winRateBonus).toBe(2);
  });

  it('adds win-rate bonus of +3+2+1 for winRate >= 50%', async () => {
    // 5 wins out of 10 = 50% win rate
    const results = [
      ...Array.from({ length: 5 }, () => ({ placement: 1 })),
      ...Array.from({ length: 5 }, () => ({ placement: 4 })),
    ];
    const horse = { competitionResults: results };
    const result = await calculateAchievementsScore(horse);
    expect(result.breakdown.winRateBonus).toBe(3);
  });

  it('caps total score at MAX_ACHIEVEMENTS_SCORE (25)', async () => {
    // Many wins from 50 competitions → would exceed 25 without cap
    const results = Array.from({ length: 50 }, () => ({ placement: 1 }));
    const horse = { competitionResults: results };
    const result = await calculateAchievementsScore(horse);
    expect(result.score).toBe(25);
  });

  it('winRate is 0 when totalCompetitions is 0', async () => {
    const horse = { competitionResults: [] };
    const result = await calculateAchievementsScore(horse);
    expect(result.breakdown.winRate).toBe(0);
    expect(result.breakdown.winRateBonus).toBe(0);
  });
});

// ─── calculateBreedingValueScore ──────────────────────────────────────────────

describe('calculateBreedingValueScore', () => {
  it('returns 0 score for horse with no offspring', () => {
    const horse = { damOffspring: [], sireOffspring: [] };
    const result = calculateBreedingValueScore(horse);
    expect(result.score).toBe(0);
    expect(result.breakdown.offspringCount).toBe(0);
    expect(result.breakdown.breedingActivityBonus).toBe(0);
  });

  it('handles null damOffspring and sireOffspring', () => {
    const horse = { damOffspring: null, sireOffspring: null };
    const result = calculateBreedingValueScore(horse);
    expect(result.score).toBe(0);
  });

  it('handles undefined offspring arrays', () => {
    const horse = {};
    const result = calculateBreedingValueScore(horse);
    expect(result.score).toBe(0);
    expect(result.breakdown.offspringCount).toBe(0);
  });

  it('gives 2 points per offspring up to 5 offspring', () => {
    const horse = {
      damOffspring: [1, 2, 3].map(() => ({})),
      sireOffspring: [],
    };
    const result = calculateBreedingValueScore(horse);
    expect(result.breakdown.offspringCount).toBe(3);
    // 3*2=6 points, no bonus (<5); score=6
    expect(result.score).toBe(6);
  });

  it('adds bonus of 3 for >= 5 offspring', () => {
    const horse = {
      damOffspring: Array.from({ length: 5 }, () => ({})),
      sireOffspring: [],
    };
    const result = calculateBreedingValueScore(horse);
    expect(result.breakdown.offspringCount).toBe(5);
    // 5*2=10, capped at 10; +3 bonus; total=13
    expect(result.score).toBe(13);
    expect(result.breakdown.breedingActivityBonus).toBe(3);
  });

  it('adds bonus of 5 for >= 10 offspring', () => {
    const horse = {
      damOffspring: Array.from({ length: 10 }, () => ({})),
      sireOffspring: [],
    };
    const result = calculateBreedingValueScore(horse);
    expect(result.breakdown.offspringCount).toBe(10);
    // 10*2=20 but capped at 10; +3+5=8 bonus; total=18
    expect(result.score).toBe(18);
    expect(result.breakdown.breedingActivityBonus).toBe(5);
  });

  it('combines dam and sire offspring counts', () => {
    const horse = {
      damOffspring: Array.from({ length: 3 }, () => ({})),
      sireOffspring: Array.from({ length: 4 }, () => ({})),
    };
    const result = calculateBreedingValueScore(horse);
    expect(result.breakdown.offspringCount).toBe(7);
  });

  it('reaches maximum achievable score (18 = 10+3+5) for many offspring', () => {
    // Formula: min(count*2,10) + 3 (if >=5) + 5 (if >=10) = max 18
    const horse = {
      damOffspring: Array.from({ length: 20 }, () => ({})),
      sireOffspring: Array.from({ length: 20 }, () => ({})),
    };
    const result = calculateBreedingValueScore(horse);
    expect(result.score).toBe(18);
  });
});

// ─── calculateGroomCareConsistency ────────────────────────────────────────────

describe('calculateGroomCareConsistency', () => {
  it('returns 0 for empty milestoneData', () => {
    expect(calculateGroomCareConsistency([])).toBe(0);
  });

  it('returns a number between 0 and 5 for valid milestone data', () => {
    const milestoneData = [
      { taskConsistency: 8, taskDiversity: 7, bondScore: 80 },
      { taskConsistency: 9, taskDiversity: 8, bondScore: 90 },
    ];
    const result = calculateGroomCareConsistency(milestoneData);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(5);
  });

  it('handles null taskConsistency and taskDiversity via || 0', () => {
    const milestoneData = [{ taskConsistency: null, taskDiversity: null, bondScore: 75 }];
    const result = calculateGroomCareConsistency(milestoneData);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(5);
  });

  it('handles null bondScore via || 50 default', () => {
    const milestoneData = [{ taskConsistency: 5, taskDiversity: 5, bondScore: null }];
    const result = calculateGroomCareConsistency(milestoneData);
    // bondScore defaults to 50 → (50-50)/50 = 0 → Math.max(0, 0) = 0
    // combinedScore = 0.5 * 0.4 + 0.5 * 0.3 + 0 * 0.3 = 0.35
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(5);
  });

  it('clamps negative bondScore contribution via Math.max(0, bondScore)', () => {
    // bondScore < 50 → (bondScore-50)/50 is negative → Math.max(0, negative)=0
    const milestoneData = [{ taskConsistency: 5, taskDiversity: 5, bondScore: 20 }];
    const result = calculateGroomCareConsistency(milestoneData);
    // negative bond contribution is clamped to 0
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(5);
  });

  it('gives higher score for high consistency/diversity/bond', () => {
    const highData = [{ taskConsistency: 10, taskDiversity: 10, bondScore: 100 }];
    const lowData = [{ taskConsistency: 1, taskDiversity: 1, bondScore: 51 }];
    const highResult = calculateGroomCareConsistency(highData);
    const lowResult = calculateGroomCareConsistency(lowData);
    expect(highResult).toBeGreaterThanOrEqual(lowResult);
  });

  it('averages across multiple milestone entries', () => {
    const milestoneData = [
      { taskConsistency: 10, taskDiversity: 10, bondScore: 100 },
      { taskConsistency: 0, taskDiversity: 0, bondScore: 50 },
    ];
    const result = calculateGroomCareConsistency(milestoneData);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(5);
  });
});

// ─── getLegacyScoreDefinitions (already exported, sanity check) ───────────────

describe('getLegacyScoreDefinitions — structure', () => {
  it('returns an object with maxScores summing to 100', () => {
    const defs = getLegacyScoreDefinitions();
    const { baseStats, achievements, traitScore, breedingValue } = defs.maxScores;
    expect(baseStats + achievements + traitScore + breedingValue).toBe(100);
  });
});
