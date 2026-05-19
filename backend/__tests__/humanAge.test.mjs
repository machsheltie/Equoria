/**
 * humanAge.test.mjs — Equoria-iqzn
 *
 * Unit coverage for the COPPA age-math helper. Pure, no DB, no mocks.
 * Sentinel-positive: each gate is exercised with a value that PASSES and a
 * value that FAILS, so the check cannot silently degrade to always-true.
 */

import { describe, it, expect } from '@jest/globals';
import { getHumanAgeYears, meetsCoppaMinimumAge, COPPA_MIN_AGE_YEARS } from '../utils/humanAge.mjs';

const NOW = new Date(Date.UTC(2026, 4, 18)); // 2026-05-18

describe('getHumanAgeYears', () => {
  it('returns full calendar years', () => {
    expect(getHumanAgeYears('1996-05-18', NOW)).toBe(30);
    expect(getHumanAgeYears('1996-05-19', NOW)).toBe(29); // birthday tomorrow
    expect(getHumanAgeYears('1996-05-17', NOW)).toBe(30); // birthday was yesterday
  });

  it('exact 13th birthday is 13', () => {
    expect(getHumanAgeYears('2013-05-18', NOW)).toBe(13);
  });

  it('day before 13th birthday is 12', () => {
    expect(getHumanAgeYears('2013-05-19', NOW)).toBe(12);
  });

  it('fails closed (null) for missing / invalid / future input', () => {
    expect(getHumanAgeYears(null, NOW)).toBeNull();
    expect(getHumanAgeYears(undefined, NOW)).toBeNull();
    expect(getHumanAgeYears('', NOW)).toBeNull();
    expect(getHumanAgeYears('not-a-date', NOW)).toBeNull();
    expect(getHumanAgeYears('2030-01-01', NOW)).toBeNull(); // future DOB
  });
});

describe('meetsCoppaMinimumAge', () => {
  it('COPPA_MIN_AGE_YEARS is 13', () => {
    expect(COPPA_MIN_AGE_YEARS).toBe(13);
  });

  it('PASSES for exactly 13 and older (sentinel-positive)', () => {
    expect(meetsCoppaMinimumAge('2013-05-18', NOW)).toBe(true); // exactly 13
    expect(meetsCoppaMinimumAge('1990-01-01', NOW)).toBe(true); // adult
  });

  it('FAILS for under 13 and for unknown age (sentinel-negative)', () => {
    expect(meetsCoppaMinimumAge('2013-05-19', NOW)).toBe(false); // 12, bday tomorrow
    expect(meetsCoppaMinimumAge('2020-01-01', NOW)).toBe(false); // 6
    expect(meetsCoppaMinimumAge(null, NOW)).toBe(false); // unknown → fail closed
    expect(meetsCoppaMinimumAge('not-a-date', NOW)).toBe(false);
  });
});
