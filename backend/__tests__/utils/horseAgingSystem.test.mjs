/**
 * horseAgingSystem — unit tests for pure exports (Equoria-rr7)
 *
 * Only tests calculateAgeFromBirth — a pure date utility.
 * DB-requiring functions are out of scope for this unit suite.
 */

import { describe, it, expect } from '@jest/globals';
import { calculateAgeFromBirth } from '../../utils/horseAgingSystem.mjs';

const daysAgo = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

describe('calculateAgeFromBirth', () => {
  it('returns 0 for a horse born today', () => {
    expect(calculateAgeFromBirth(new Date())).toBe(0);
  });

  it('returns 1 for a horse born yesterday', () => {
    expect(calculateAgeFromBirth(daysAgo(1))).toBe(1);
  });

  it('returns 365 for a horse born 365 days ago', () => {
    const result = calculateAgeFromBirth(daysAgo(365));
    // allow ±1 for DST/leap boundaries
    expect(result).toBeGreaterThanOrEqual(364);
    expect(result).toBeLessThanOrEqual(366);
  });

  it('returns 0 for a future birth date', () => {
    const future = new Date(Date.now() + 86400000);
    expect(calculateAgeFromBirth(future)).toBe(0);
  });

  it('accepts ISO date string', () => {
    expect(calculateAgeFromBirth(daysAgo(10).toISOString())).toBe(10);
  });

  it('accepts a custom currentDate as second argument', () => {
    const dob = new Date('2020-01-01');
    const current = new Date('2020-01-11');
    expect(calculateAgeFromBirth(dob, current)).toBe(10);
  });

  it('returns 0 for identical birth and current date', () => {
    const d = new Date('2024-06-15');
    expect(calculateAgeFromBirth(d, d)).toBe(0);
  });

  it('returns a large number for an ancient date (year 1900)', () => {
    const ancient = new Date('1900-01-01');
    const result = calculateAgeFromBirth(ancient);
    expect(result).toBeGreaterThan(40000); // 100+ years in days
  });
});
