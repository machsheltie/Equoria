/**
 * Tests for the pregnancy bonus formula (feed-system redesign 2026-04-29).
 *
 * Spec: docs/superpowers/specs/2026-04-29-feed-system-redesign-design.md §8.2
 *
 * Pure-function math — no DB, no I/O, no mocks.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculatePregnancyEpigeneticChances,
  PREGNANCY_BONUS_PCT,
  GESTATION_DAYS,
  NEG_PER_MISSED_DAY,
} from '../../utils/pregnancyBonus.mjs';

describe('calculatePregnancyEpigeneticChances', () => {
  // ---------------------------------------------------------------
  // Worked examples from spec §8.2 (all 7 rows of the truth table)
  // ---------------------------------------------------------------

  it('worked example: 7× elite → 20.0% positive, 0% negative', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 7 });
    expect(r.positive_chance).toBeCloseTo(20, 5);
    expect(r.negative_chance).toBe(0);
  });

  it('worked example: 4× elite + 3× basic → ~11.4% positive, 0% negative', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 4, basic: 3 });
    expect(r.positive_chance).toBeCloseTo(80 / 7, 5);
    expect(r.negative_chance).toBe(0);
  });

  it('worked example: 3× elite + 4× basic → ~8.6% positive, 0% negative', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 3, basic: 4 });
    expect(r.positive_chance).toBeCloseTo(60 / 7, 5);
    expect(r.negative_chance).toBe(0);
  });

  it('worked example: 7× performance → 5.0% positive, 0% negative', () => {
    const r = calculatePregnancyEpigeneticChances({ performance: 7 });
    expect(r.positive_chance).toBeCloseTo(5, 5);
    expect(r.negative_chance).toBe(0);
  });

  it('worked example: 7× basic → 0% positive, 0% negative', () => {
    const r = calculatePregnancyEpigeneticChances({ basic: 7 });
    expect(r.positive_chance).toBe(0);
    expect(r.negative_chance).toBe(0);
  });

  it('worked example: 5× elite + 2 missed days → ~14.3% positive, 10% negative', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 5 });
    expect(r.positive_chance).toBeCloseTo(100 / 7, 5);
    expect(r.negative_chance).toBe(10);
  });

  it('worked example: 0 feedings → 0% positive, 35% negative', () => {
    const r = calculatePregnancyEpigeneticChances({});
    expect(r.positive_chance).toBe(0);
    expect(r.negative_chance).toBe(35);
  });

  // ---------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------

  it('8 feedings (edge case) caps divisor at max(7, total) — bonus stays bounded', () => {
    // 8× elite. With cap: 160/8 = 20. Without cap: 160/7 = 22.86 (over the per-tier max).
    const r = calculatePregnancyEpigeneticChances({ elite: 8 });
    expect(r.positive_chance).toBeCloseTo(160 / 8, 5);
    expect(r.positive_chance).toBeLessThanOrEqual(20);
    expect(r.negative_chance).toBe(0);
  });

  it('ignores unknown tier keys gracefully', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 3, garbage: 99, somethingElse: 7 });
    expect(r.positive_chance).toBeCloseTo(60 / 7, 5);
    // Only 3 known feedings → 4 missed → 20% negative
    expect(r.negative_chance).toBe(20);
  });

  it('handles undefined input as zero feedings', () => {
    const r = calculatePregnancyEpigeneticChances(undefined);
    expect(r.positive_chance).toBe(0);
    expect(r.negative_chance).toBe(35);
  });

  it('handles null input as zero feedings', () => {
    const r = calculatePregnancyEpigeneticChances(null);
    expect(r.positive_chance).toBe(0);
    expect(r.negative_chance).toBe(35);
  });

  it('handles missing arguments (no-arg call) as zero feedings', () => {
    const r = calculatePregnancyEpigeneticChances();
    expect(r.positive_chance).toBe(0);
    expect(r.negative_chance).toBe(35);
  });

  it('mixed tiers covering all 5 valid keys', () => {
    // 1+1+1+1+3 = 7 feedings (no missed days)
    // Weighted sum = 1*0 + 1*5 + 1*10 + 1*15 + 3*20 = 90
    // positive = 90/7 ≈ 12.857
    const r = calculatePregnancyEpigeneticChances({
      basic: 1,
      performance: 1,
      performancePlus: 1,
      highPerformance: 1,
      elite: 3,
    });
    expect(r.positive_chance).toBeCloseTo(90 / 7, 5);
    expect(r.negative_chance).toBe(0);
  });

  it('1 feeding → 1 fed day, 6 missed days → 30% negative', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 1 });
    expect(r.positive_chance).toBeCloseTo(20 / 7, 5);
    expect(r.negative_chance).toBe(30);
  });

  it('return shape always has positive_chance and negative_chance numeric fields', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 4, performance: 2 });
    expect(typeof r.positive_chance).toBe('number');
    expect(typeof r.negative_chance).toBe('number');
    expect(Number.isFinite(r.positive_chance)).toBe(true);
    expect(Number.isFinite(r.negative_chance)).toBe(true);
  });

  // ---------------------------------------------------------------
  // Sentinel-positive tests (ensure formula breaks loudly if changed)
  // ---------------------------------------------------------------

  it('sentinel: divisor floor is max(7, total) — NOT divide-by-N for N<7', () => {
    // 3× elite. If divisor were N=3 (broken), positive would be 60/3 = 20.
    // Correct divisor = max(7, 3) = 7 → 60/7 ≈ 8.571.
    const r = calculatePregnancyEpigeneticChances({ elite: 3 });
    expect(r.positive_chance).toBeCloseTo(60 / 7, 5);
    expect(r.positive_chance).not.toBeCloseTo(20, 1); // would-be result if divisor were broken
  });

  it('sentinel: missed-day penalty is exactly 5% per missed day', () => {
    // 3 feedings → 4 missed days → 20% negative
    const r3 = calculatePregnancyEpigeneticChances({ basic: 3 });
    expect(r3.negative_chance).toBe(20);
    // 6 feedings → 1 missed day → 5% negative
    const r6 = calculatePregnancyEpigeneticChances({ basic: 6 });
    expect(r6.negative_chance).toBe(5);
    // 7 feedings → 0 missed days → 0% negative
    const r7 = calculatePregnancyEpigeneticChances({ basic: 7 });
    expect(r7.negative_chance).toBe(0);
  });

  it('sentinel: tier weights are exactly basic=0, performance=5, performancePlus=10, highPerformance=15, elite=20', () => {
    // 7× of each tier individually proves the per-tier weight (no divisor effect since totalFeedings = 7)
    expect(calculatePregnancyEpigeneticChances({ basic: 7 }).positive_chance).toBe(0);
    expect(calculatePregnancyEpigeneticChances({ performance: 7 }).positive_chance).toBeCloseTo(5, 5);
    expect(calculatePregnancyEpigeneticChances({ performancePlus: 7 }).positive_chance).toBeCloseTo(10, 5);
    expect(calculatePregnancyEpigeneticChances({ highPerformance: 7 }).positive_chance).toBeCloseTo(15, 5);
    expect(calculatePregnancyEpigeneticChances({ elite: 7 }).positive_chance).toBeCloseTo(20, 5);
  });

  it('sentinel: negative chance does not exceed 35% (cap from 7 missed days × 5%)', () => {
    const r = calculatePregnancyEpigeneticChances({});
    expect(r.negative_chance).toBeLessThanOrEqual(35);
    expect(r.negative_chance).toBe(35);
  });

  it('sentinel: extra feedings beyond GESTATION_DAYS do NOT produce negative_chance', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 10 });
    expect(r.negative_chance).toBe(0); // not negative, not undefined
  });

  it('null rawCount for valid tier: Number(null)=0 falls through || 0 false branch (line 66)', () => {
    // elite is a valid tier, so no continue; but rawCount=null → Number(null)=0 (falsy) → || 0 used
    const r = calculatePregnancyEpigeneticChances({ elite: null });
    expect(r.positive_chance).toBe(0);
    expect(r.negative_chance).toBe(GESTATION_DAYS * NEG_PER_MISSED_DAY);
  });

  it('non-numeric string rawCount for valid tier: Number("abc")=NaN (falsy) → || 0 false branch', () => {
    const r = calculatePregnancyEpigeneticChances({ performance: 'abc' });
    expect(r.positive_chance).toBe(0);
    expect(r.negative_chance).toBe(GESTATION_DAYS * NEG_PER_MISSED_DAY);
  });

  it('zero rawCount for valid tier: Number(0)=0 (falsy) → || 0 false branch', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 0, basic: 7 });
    // elite: 0 → 0 feedings from elite; basic: 7 → 7 feedings at 0 weight
    expect(r.positive_chance).toBe(0);
    expect(r.negative_chance).toBe(0);
  });
});

describe('exported constants', () => {
  it('PREGNANCY_BONUS_PCT defines exactly the 5 tier weights from spec §8.2', () => {
    expect(PREGNANCY_BONUS_PCT).toEqual({
      basic: 0,
      performance: 5,
      performancePlus: 10,
      highPerformance: 15,
      elite: 20,
    });
  });

  it('GESTATION_DAYS is 7', () => {
    expect(GESTATION_DAYS).toBe(7);
  });

  it('NEG_PER_MISSED_DAY is 5', () => {
    expect(NEG_PER_MISSED_DAY).toBe(5);
  });
});
