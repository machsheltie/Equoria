/**
 * Pregnancy countdown tests.
 *
 * Owner ruling 2026-10-29 (q293, Equoria-9kakx): the in-foal panel shows no
 * trait-chance numbers, and the client-side copy of the trait-chance formula
 * was removed. Old contract: this file pinned that copy against the backend
 * formula (spec §8.2 worked examples and a cross-engine equality check).
 */

import { describe, it, expect } from 'vitest';
import * as pregnancy from '../pregnancyChances';
import { GESTATION_DAYS, getPregnancyProgress } from '../pregnancyChances';

describe('pregnancyChances module', () => {
  it('ships no trait-chance formula or weights to the browser', () => {
    const exported = Object.keys(pregnancy);
    expect(exported).not.toContain('calculatePregnancyEpigeneticChances');
    expect(exported).not.toContain('PREGNANCY_BONUS_PCT');
    expect(exported).not.toContain('NEG_PER_MISSED_DAY');
  });

  it('gestation lasts 7 days', () => {
    expect(GESTATION_DAYS).toBe(7);
  });
});

// Owner ruling 2026-10-12: bred on Eastern calendar day D, the foal arrives on
// day D+7 — the countdown counts Eastern calendar days, matching the nightly
// foaling run. (Old contract: elapsed 24-hour periods.)
describe('getPregnancyProgress — Eastern calendar days', () => {
  const bredAt = '2026-10-09T19:00:00Z'; // 3 PM EDT, Oct 9

  it('is day 7 of 7 with 1 day remaining late on Oct 15 Eastern', () => {
    const progress = getPregnancyProgress(bredAt, Date.parse('2026-10-16T03:30:00Z')); // 11:30 PM EDT Oct 15
    expect(progress).toMatchObject({
      elapsedDays: 6,
      gestationDay: 7,
      daysRemaining: 1,
      isOverdue: false,
    });
  });

  it('is due from 00:00 Eastern on Oct 16, though fewer than 7 x 24 hours have passed', () => {
    const progress = getPregnancyProgress(bredAt, Date.parse('2026-10-16T04:30:00Z')); // 12:30 AM EDT Oct 16
    expect(progress).toMatchObject({ elapsedDays: 7, daysRemaining: 0, isOverdue: true });
  });

  it('returns null without a usable start date', () => {
    expect(getPregnancyProgress(null)).toBeNull();
    expect(getPregnancyProgress('not-a-date')).toBeNull();
  });
});
