/**
 * Pregnancy chances — frontend formula tests.
 *
 * Verifies the frontend mirror of backend/utils/pregnancyBonus.mjs against:
 *   1. The 7 worked examples in spec §8.2.
 *   2. The actual backend implementation (cross-engine contract test) — the
 *      frontend helper imports the backend module directly via Vitest's Node
 *      resolution, calls both implementations on the same inputs, and asserts
 *      bit-for-bit numeric equality.
 *
 * If this test ever fails, the frontend has drifted from the backend formula —
 * which is the exact failure mode this contract guards against.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePregnancyEpigeneticChances,
  GESTATION_DAYS,
  getPregnancyProgress,
  NEG_PER_MISSED_DAY,
  PREGNANCY_BONUS_PCT,
} from '../pregnancyChances';
// Backend canonical implementation — imported directly from .mjs.
// Vitest resolves this in node mode; it does not require a transpile step.

// @ts-expect-error — backend file has no TS types but the runtime import is fine
import { calculatePregnancyEpigeneticChances as backendCalc } from '../../../../../backend/utils/pregnancyBonus.mjs';

describe('calculatePregnancyEpigeneticChances — spec §8.2 worked examples', () => {
  // Each row is the literal table from the spec (rounded to 1 decimal where given).
  const cases = [
    { name: '7× elite', input: { elite: 7 }, positive: 20.0, negative: 0 },
    { name: '4× elite + 3× basic', input: { elite: 4, basic: 3 }, positive: 11.4, negative: 0 },
    { name: '3× elite + 4× basic', input: { elite: 3, basic: 4 }, positive: 8.6, negative: 0 },
    { name: '7× performance', input: { performance: 7 }, positive: 5.0, negative: 0 },
    { name: '7× basic', input: { basic: 7 }, positive: 0, negative: 0 },
    { name: '5× elite + 2 missed', input: { elite: 5 }, positive: 14.3, negative: 10 },
    { name: '0 feedings', input: {}, positive: 0, negative: 35 },
  ];

  for (const c of cases) {
    it(`${c.name} → positive ${c.positive}% / negative ${c.negative}%`, () => {
      const out = calculatePregnancyEpigeneticChances(c.input);
      expect(out.positiveChance).toBeCloseTo(c.positive, 1);
      expect(out.negativeChance).toBe(c.negative);
    });
  }
});

describe('calculatePregnancyEpigeneticChances — backend contract', () => {
  // Cross-engine contract: frontend output MUST equal backend output
  // numerically (the formula in pregnancyBonus.mjs is the source of truth).
  const samples = [
    {},
    { elite: 7 },
    { elite: 4, basic: 3 },
    { elite: 3, basic: 4 },
    { performance: 7 },
    { basic: 7 },
    { elite: 5 },
    { performance: 1, performancePlus: 2, highPerformance: 3, elite: 1 },
    { elite: 8 }, // 8th-day edge per spec §8.6
    { elite: 14 }, // double the gestation — divisor cap test
    { unknownTier: 99, elite: 2 }, // unknown key must be ignored on both sides
  ];

  for (const sample of samples) {
    it(`agrees with backend for ${JSON.stringify(sample)}`, () => {
      const fe = calculatePregnancyEpigeneticChances(sample);
      const be = backendCalc(sample);
      expect(fe.positiveChance).toBe(be.positiveChance);
      expect(fe.negativeChance).toBe(be.negativeChance);
    });
  }
});

describe('calculatePregnancyEpigeneticChances — edge cases', () => {
  it('treats null input as zero feedings (35% negative)', () => {
    expect(calculatePregnancyEpigeneticChances(null)).toEqual({
      positiveChance: 0,
      negativeChance: 35,
    });
  });

  it('treats undefined input as zero feedings (35% negative)', () => {
    expect(calculatePregnancyEpigeneticChances(undefined)).toEqual({
      positiveChance: 0,
      negativeChance: 35,
    });
  });

  it('ignores unknown tier keys silently', () => {
    const out = calculatePregnancyEpigeneticChances({ unknownTier: 5, elite: 2 });
    // total = 2 (only elite), weighted = 40, divisor = max(7, 2) = 7
    expect(out.positiveChance).toBeCloseTo(40 / 7, 4);
    // 7 - 2 = 5 missed days
    expect(out.negativeChance).toBe(25);
  });

  it('caps the divisor at GESTATION_DAYS so 7×elite cannot exceed 20%', () => {
    const out = calculatePregnancyEpigeneticChances({ elite: 7 });
    expect(out.positiveChance).toBe(20); // 7*20 / max(7,7) = 140/7 = 20.0
  });

  it('caps the bonus at 8th-day edge (8×elite stays bounded)', () => {
    const out = calculatePregnancyEpigeneticChances({ elite: 8 });
    // weighted = 160, divisor = max(7, 8) = 8 → 20%
    expect(out.positiveChance).toBe(20);
    expect(out.negativeChance).toBe(0);
  });

  it('exports the canonical constants', () => {
    expect(GESTATION_DAYS).toBe(7);
    expect(NEG_PER_MISSED_DAY).toBe(5);
    expect(PREGNANCY_BONUS_PCT.elite).toBe(20);
    expect(PREGNANCY_BONUS_PCT.basic).toBe(0);
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
