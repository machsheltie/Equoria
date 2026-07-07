/**
 * Pure-formula unit coverage for the Equoria-g8qg0 level-bracket mapping.
 *
 * The HTTP sentinel (modules/competition/__tests__/showEntryLevelBracket.sentinel.test.mjs)
 * proves the bracket is enforced end-to-end on both entry paths. THIS suite
 * pins the pure math at the XP→level boundaries (which the HTTP test only
 * samples at the bracket edges) and the bracket-inclusivity + defensive guards.
 * No DB, no mocks — pure functions.
 *
 * PINNED MAPPING (user decision 2026-07-07): horseLevel = floor(horseXp/100)+1.
 */

import { describe, it, expect } from '@jest/globals';
import { HORSE_XP_PER_LEVEL, getHorseXpLevel, isHorseWithinLevelBracket } from '../utils/horseCompetitionLevel.mjs';

describe('getHorseXpLevel — pinned mapping floor(horseXp/100)+1 (Equoria-g8qg0)', () => {
  it('the XP-per-level constant is 100', () => {
    expect(HORSE_XP_PER_LEVEL).toBe(100);
  });

  it.each([
    [0, 1],
    [1, 1],
    [99, 1],
    [100, 2],
    [199, 2],
    [200, 3],
    [250, 3],
    [499, 5],
    [500, 6],
    [550, 6],
    [600, 7],
    [650, 7],
    [10000, 101],
  ])('horseXp %i -> level %i', (xp, level) => {
    expect(getHorseXpLevel(xp)).toBe(level);
  });

  it('a brand-new horse (0 xp) is level 1, never level 0', () => {
    expect(getHorseXpLevel(0)).toBe(1);
  });

  it('defends against non-finite / negative xp by treating it as 0 (level 1)', () => {
    expect(getHorseXpLevel(undefined)).toBe(1);
    expect(getHorseXpLevel(null)).toBe(1);
    expect(getHorseXpLevel(NaN)).toBe(1);
    expect(getHorseXpLevel(-500)).toBe(1);
  });
});

describe('isHorseWithinLevelBracket — inclusive on both ends (Equoria-g8qg0)', () => {
  it('accepts a horse exactly at levelMin and levelMax (inclusive)', () => {
    expect(isHorseWithinLevelBracket(3, 3, 6)).toBe(true); // at min
    expect(isHorseWithinLevelBracket(6, 3, 6)).toBe(true); // at max
    expect(isHorseWithinLevelBracket(5, 3, 6)).toBe(true); // interior
  });

  it('rejects a horse below levelMin or above levelMax', () => {
    expect(isHorseWithinLevelBracket(2, 3, 6)).toBe(false); // below
    expect(isHorseWithinLevelBracket(7, 3, 6)).toBe(false); // above
  });

  it('single-level bracket (levelMin == levelMax) admits only that exact level', () => {
    expect(isHorseWithinLevelBracket(5, 5, 5)).toBe(true);
    expect(isHorseWithinLevelBracket(4, 5, 5)).toBe(false);
    expect(isHorseWithinLevelBracket(6, 5, 5)).toBe(false);
  });

  it('the legacy open bracket (1..999) admits any realistic horse level', () => {
    expect(isHorseWithinLevelBracket(1, 1, 999)).toBe(true);
    expect(isHorseWithinLevelBracket(500, 1, 999)).toBe(true);
    expect(isHorseWithinLevelBracket(999, 1, 999)).toBe(true);
  });

  it('a non-number bound fails OPEN for that end only (defensive, never silently rejects)', () => {
    expect(isHorseWithinLevelBracket(50, undefined, 60)).toBe(true); // no min → unbounded below
    expect(isHorseWithinLevelBracket(50, 40, undefined)).toBe(true); // no max → unbounded above
    expect(isHorseWithinLevelBracket(50, 60, undefined)).toBe(false); // min still enforced
  });
});
