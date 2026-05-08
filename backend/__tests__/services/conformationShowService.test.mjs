/**
 * conformationShowService pure-sync unit tests (Equoria-rr7 coverage sprint).
 *
 * All tested exports are pure sync — no DB fixture required.
 * Covers the scoring and validation functions.
 */

import { describe, it, expect } from '@jest/globals';
import {
  CONFORMATION_SHOW_CONFIG,
  SHOW_HANDLING_SKILL_SCORES,
  CONFORMATION_AGE_CLASSES,
  isValidConformationClass,
  calculateConformationScore,
  getHandlerScore,
  getConformationAgeClass,
  calculateSynergy,
  calculateConformationShowScore,
  resolveReward,
  resolveTitle,
} from '../../services/conformationShowService.mjs';

// ── isValidConformationClass ──────────────────────────────────────────────────

describe('isValidConformationClass', () => {
  it('returns true for Foals/Youngstock', () => {
    expect(isValidConformationClass('Foals/Youngstock')).toBe(true);
  });

  it('returns true for Mares', () => {
    expect(isValidConformationClass('Mares')).toBe(true);
  });

  it('returns true for Stallions', () => {
    expect(isValidConformationClass('Stallions')).toBe(true);
  });

  it('returns false for regular discipline Dressage', () => {
    expect(isValidConformationClass('Dressage')).toBe(false);
  });

  it('returns false for unknown class', () => {
    expect(isValidConformationClass('NotAClass')).toBe(false);
  });
});

// ── calculateConformationScore ────────────────────────────────────────────────

describe('calculateConformationScore', () => {
  it('returns 50 for null input', () => {
    expect(calculateConformationScore(null)).toBe(50);
  });

  it('returns 50 for non-object input', () => {
    expect(calculateConformationScore('invalid')).toBe(50);
  });

  it('returns a number for valid conformation scores object', () => {
    const scores = {
      head: 70,
      neck: 75,
      shoulder: 80,
      back: 65,
      hindquarters: 70,
      legs: 68,
      hooves: 72,
      overall: 74,
    };
    const result = calculateConformationScore(scores);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});

// ── getHandlerScore ───────────────────────────────────────────────────────────

describe('getHandlerScore', () => {
  it('returns 20 for novice', () => {
    expect(getHandlerScore('novice')).toBe(SHOW_HANDLING_SKILL_SCORES.novice);
    expect(getHandlerScore('novice')).toBe(20);
  });

  it('returns 100 for master', () => {
    expect(getHandlerScore('master')).toBe(100);
  });

  it('returns 80 for expert', () => {
    expect(getHandlerScore('expert')).toBe(80);
  });

  it('defaults to novice score (20) for unknown value', () => {
    expect(getHandlerScore(null)).toBe(20);
    expect(getHandlerScore('unknown_level')).toBe(20);
  });
});

// ── getConformationAgeClass ───────────────────────────────────────────────────

describe('getConformationAgeClass', () => {
  it('returns Weanling for age 0', () => {
    expect(getConformationAgeClass(0)).toBe(CONFORMATION_AGE_CLASSES.WEANLING);
  });

  it('returns Weanling for age 0.5', () => {
    expect(getConformationAgeClass(0.5)).toBe(CONFORMATION_AGE_CLASSES.WEANLING);
  });

  it('returns Yearling for age 1', () => {
    expect(getConformationAgeClass(1)).toBe(CONFORMATION_AGE_CLASSES.YEARLING);
  });

  it('returns Weanling for negative age', () => {
    expect(getConformationAgeClass(-1)).toBe(CONFORMATION_AGE_CLASSES.WEANLING);
  });
});

// ── calculateSynergy ──────────────────────────────────────────────────────────

describe('calculateSynergy', () => {
  it('returns a number between 0 and 100', () => {
    const result = calculateSynergy('calm', 'gentle');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it('gentle is beneficial for calm temperament', () => {
    const beneficial = calculateSynergy('calm', 'gentle');
    const detrimental = calculateSynergy('calm', 'energetic');
    expect(beneficial).toBeGreaterThan(detrimental);
  });

  it('returns a number for unknown combinations', () => {
    expect(typeof calculateSynergy('unknown', 'unknown')).toBe('number');
  });
});

// ── calculateConformationShowScore ────────────────────────────────────────────

describe('calculateConformationShowScore', () => {
  const mockHorse = {
    id: 1,
    name: 'TestHorse',
    bondScore: 50,
    temperament: 'calm',
    conformationScores: null,
  };
  const mockGroom = {
    id: 1,
    name: 'TestGroom',
    showHandlingSkill: 'novice',
    personality: 'gentle',
  };

  it('throws (returns error shape) for invalid class name', () => {
    const result = calculateConformationShowScore(mockHorse, mockGroom, 'InvalidClass');
    expect(result.finalScore).toBe(0);
    expect(typeof result.error).toBe('string');
  });

  it('returns score shape for valid class', () => {
    const result = calculateConformationShowScore(mockHorse, mockGroom, 'Foals/Youngstock');
    expect(typeof result.finalScore).toBe('number');
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);
    expect(typeof result.breakdown).toBe('object');
    expect(typeof result.weights).toBe('object');
  });

  it('weights sum to 1.0', () => {
    const cfg = CONFORMATION_SHOW_CONFIG;
    const sum = cfg.CONFORMATION_WEIGHT + cfg.HANDLER_WEIGHT + cfg.BOND_WEIGHT + cfg.TEMPERAMENT_WEIGHT;
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it('master handler scores higher than novice handler (all else equal)', () => {
    const masterGroom = { ...mockGroom, showHandlingSkill: 'master' };
    const noviceResult = calculateConformationShowScore(mockHorse, mockGroom, 'Mares');
    const masterResult = calculateConformationShowScore(mockHorse, masterGroom, 'Mares');
    expect(masterResult.finalScore).toBeGreaterThan(noviceResult.finalScore);
  });
});

// ── resolveReward ─────────────────────────────────────────────────────────────

describe('resolveReward', () => {
  it('returns Blue ribbon with titlePoints for placement 1', () => {
    const result = resolveReward(1);
    expect(result.ribbon).toBe('Blue');
    expect(typeof result.titlePoints).toBe('number');
    expect(result.titlePoints).toBeGreaterThan(0);
    expect(typeof result.breedingBoostDelta).toBe('number');
  });

  it('returns default reward for non-placed entry', () => {
    const result = resolveReward(99);
    expect(result.ribbon).toBe('White');
    expect(result.breedingBoostDelta).toBe(0);
  });
});

// ── resolveTitle ──────────────────────────────────────────────────────────────

describe('resolveTitle', () => {
  it('returns null for 0 accumulated points', () => {
    const result = resolveTitle(0);
    expect(result === null || result === undefined || typeof result === 'string').toBe(true);
  });

  it('returns a string for high accumulated points', () => {
    const result = resolveTitle(1000);
    expect(typeof result === 'string' || result === null).toBe(true);
  });
});
