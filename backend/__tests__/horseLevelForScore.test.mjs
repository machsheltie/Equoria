/**
 * Horse levels 1-20 (owner ruling 2026-10-23, Equoria-v89t8): up to a weighted
 * stat score of 500 each level spans 50 points (level 10 = 450-499); from 500
 * each level spans 100 points (level 11 = 500-599) up to level 20, the top.
 * Pure function, no DB, no mocks.
 */
import { describe, it, expect } from '@jest/globals';
import { levelForScore, calculateHorseLevel, MAX_HORSE_LEVEL } from '../utils/competitionLogic.mjs';

describe('levelForScore (Equoria-v89t8)', () => {
  it('the top level is 20', () => {
    expect(MAX_HORSE_LEVEL).toBe(20);
  });

  it.each([
    [0, 1],
    [49, 1],
    [50, 2],
    [99, 2],
    [100, 3],
    [149, 3],
    [150, 4],
    [199, 4],
    [200, 5],
    [449, 9],
    [450, 10],
    [499, 10],
    [500, 11],
    [599, 11],
    [600, 12],
    [699, 12],
    [1399, 19],
    [1400, 20],
    [1499, 20],
    [5000, 20],
  ])('score %i is level %i', (score, level) => {
    expect(levelForScore(score)).toBe(level);
  });

  it('never goes below level 1 or returns NaN', () => {
    expect(levelForScore(-10)).toBe(1);
    expect(levelForScore(NaN)).toBe(1);
    expect(levelForScore(undefined)).toBe(1);
  });

  it('calculateHorseLevel uses it and is capped at level 20', () => {
    const horse = { speed: 100, stamina: 100, intelligence: 100, disciplineScores: { Racing: 5000 } };
    expect(calculateHorseLevel(horse, 'Racing')).toBe(20);
  });
});
