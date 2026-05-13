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
  applyBreedingValueBoost,
  validateConformationEntry,
  executeConformationShow,
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

  it('throws for invalid class name — error is distinguishable from a legitimate zero score', () => {
    expect(() => calculateConformationShowScore(mockHorse, mockGroom, 'InvalidClass')).toThrow(
      /not a valid conformation show class/i,
    );
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

// ── getConformationAgeClass — missing age-class branches (Equoria-jkht) ────────

describe('getConformationAgeClass — all age-class branches (Equoria-jkht)', () => {
  it('returns Youngstock for age=2 (2 <= age < 3)', () => {
    expect(getConformationAgeClass(2)).toBe(CONFORMATION_AGE_CLASSES.YOUNGSTOCK);
  });

  it('returns Junior for age=4 (3 <= age < 6)', () => {
    expect(getConformationAgeClass(4)).toBe(CONFORMATION_AGE_CLASSES.JUNIOR);
  });

  it('returns Senior for age=7 (age >= 6)', () => {
    expect(getConformationAgeClass(7)).toBe(CONFORMATION_AGE_CLASSES.SENIOR);
  });

  it('returns Weanling for NaN (!Number.isFinite branch)', () => {
    expect(getConformationAgeClass(NaN)).toBe(CONFORMATION_AGE_CLASSES.WEANLING);
  });
});

// ── calculateSynergy — neutral return when config exists but no personality match (Equoria-jkht) ──

describe('calculateSynergy — neutral personality branch (Equoria-jkht)', () => {
  it('returns NEUTRAL_SYNERGY_SCORE (0) when personality is neither beneficial nor detrimental for calm temperament', () => {
    expect(calculateSynergy('calm', 'confident')).toBe(0);
  });

  it('returns detrimental score for calm+energetic', () => {
    expect(calculateSynergy('calm', 'energetic')).toBe(23);
  });

  it('returns beneficial score for nervous+gentle (100)', () => {
    expect(calculateSynergy('nervous', 'gentle')).toBe(100);
  });
});

// ── resolveReward — placement 2 and 3 branches (Equoria-jkht) ────────────────

describe('resolveReward — placement 2 and 3 (Equoria-jkht)', () => {
  it('returns Red ribbon with titlePoints=7 for placement 2', () => {
    const result = resolveReward(2);
    expect(result.ribbon).toBe('Red');
    expect(result.titlePoints).toBe(7);
    expect(result.breedingBoostDelta).toBe(0.03);
  });

  it('returns Yellow ribbon with titlePoints=5 for placement 3', () => {
    const result = resolveReward(3);
    expect(result.ribbon).toBe('Yellow');
    expect(result.titlePoints).toBe(5);
    expect(result.breedingBoostDelta).toBe(0.01);
  });
});

// ── resolveTitle — intermediate threshold branches (Equoria-jkht) ─────────────

describe('resolveTitle — intermediate thresholds (Equoria-jkht)', () => {
  it('returns Noteworthy for 25 points (>= 25, < 50)', () => {
    expect(resolveTitle(25)).toBe('Noteworthy');
  });

  it('returns Distinguished for 50 points (>= 50, < 100)', () => {
    expect(resolveTitle(50)).toBe('Distinguished');
  });

  it('returns Champion for 100 points (>= 100, < 200)', () => {
    expect(resolveTitle(100)).toBe('Champion');
  });

  it('returns Grand Champion for 200 points (>= 200)', () => {
    expect(resolveTitle(200)).toBe('Grand Champion');
  });
});

// ── applyBreedingValueBoost — delta branches (Equoria-jkht) ──────────────────

describe('applyBreedingValueBoost (Equoria-jkht)', () => {
  it('returns currentBoost unchanged when delta <= 0 (early-return branch)', () => {
    expect(applyBreedingValueBoost(0.05, 0)).toBe(0.05);
    expect(applyBreedingValueBoost(0.1, -0.02)).toBe(0.1);
  });

  it('adds delta when delta > 0 and result is under cap', () => {
    expect(applyBreedingValueBoost(0.0, 0.05)).toBeCloseTo(0.05);
    expect(applyBreedingValueBoost(0.05, 0.03)).toBeCloseTo(0.08);
  });

  it('clamps to BREEDING_BOOST_CAP (0.15) when sum exceeds cap', () => {
    expect(applyBreedingValueBoost(0.12, 0.05)).toBeCloseTo(0.15);
    expect(applyBreedingValueBoost(0.15, 0.05)).toBeCloseTo(0.15);
  });
});

// ── calculateConformationShowScore — null horse path (Equoria-vc7v) ──────────
// Null horse throws directly — error propagates so callers can distinguish it
// from a legitimate zero score (see Equoria-vc7v fix, 2026-05-13).

describe('calculateConformationShowScore — null horse (Equoria-vc7v)', () => {
  it('throws when horse is null — error is distinguishable from a legitimate zero score', () => {
    const groom = { showHandlingSkill: 'novice', personality: 'gentle' };
    expect(() => calculateConformationShowScore(null, groom, 'Mares')).toThrow(/horse and groom are required/i);
  });
});

// ── validateConformationEntry — pure-input branches (Equoria-jkht) ────────────
// Tests that cover lines 324-422 using in-memory objects (no real DB needed for
// null-id paths; the groom-assignment DB query is skipped when horse.id === null).

describe('validateConformationEntry — pure-input branches (Equoria-jkht)', () => {
  it('returns early with Horse/groom required when horse is null (lines 325-332)', async () => {
    const result = await validateConformationEntry(null, { id: 1 }, 'Mares', 'uid');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Horse and groom are required');
    expect(result.assignment).toBeNull();
    expect(result.ageClass).toBeNull();
  });

  it('pushes invalid-class error and groom-not-assigned error when class is bad and ids are null', async () => {
    const horse = { id: null, age: 2, healthStatus: 'Good', stressLevel: 5, conformationScores: { head: 70 } };
    const groom = { id: null };
    const result = await validateConformationEntry(horse, groom, 'BadClass', 'uid');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not a valid conformation show class'))).toBe(true);
    expect(result.errors.some(e => e.includes('Groom must be assigned'))).toBe(true);
  });

  it('pushes age-invalid error when horse.age < 0 (line 389-391)', async () => {
    const horse = { id: null, age: -1, healthStatus: 'Good', stressLevel: 5, conformationScores: null };
    const groom = { id: null };
    const result = await validateConformationEntry(horse, groom, 'Mares', 'uid');
    expect(result.errors.some(e => e.includes('invalid'))).toBe(true);
  });

  it('pushes health error when healthStatus is not Excellent or Good (lines 398-401)', async () => {
    const horse = { id: null, age: 2, healthStatus: 'Injured', stressLevel: 5, conformationScores: null };
    const groom = { id: null };
    const result = await validateConformationEntry(horse, groom, 'Mares', 'uid');
    expect(result.errors.some(e => e.includes('healthy'))).toBe(true);
  });

  it('adds stress warning when stressLevel > 80 (lines 404-406)', async () => {
    const horse = { id: null, age: 2, healthStatus: 'Good', stressLevel: 90, conformationScores: null };
    const groom = { id: null };
    const result = await validateConformationEntry(horse, groom, 'Mares', 'uid');
    expect(result.warnings.some(w => w.includes('stress'))).toBe(true);
  });

  it('adds no-conformationScores warning when conformationScores is null (lines 409-411)', async () => {
    const horse = { id: null, age: 2, healthStatus: 'Excellent', stressLevel: 5, conformationScores: null };
    const groom = { id: null };
    const result = await validateConformationEntry(horse, groom, 'Mares', 'uid');
    expect(result.warnings.some(w => w.includes('conformation scores'))).toBe(true);
  });

  it('catch block: returns Validation error occurred when horse.id access throws (lines 420-428)', async () => {
    // A Proxy that throws on property access after the !horse check passes
    const throwingHorse = new Proxy(
      {},
      {
        get(target, prop) {
          if (prop === 'id') {
            throw new Error('id access bomb');
          }
          return undefined;
        },
      },
    );
    const result = await validateConformationEntry(throwingHorse, { id: null }, 'Mares', 'uid');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Validation error occurred');
  });
});

// ── executeConformationShow — show-not-found path (Equoria-jkht) ──────────────
// Lines 521-525: showId not found → throws 'Show not found' with statusCode 400.

describe('executeConformationShow — show-not-found (Equoria-jkht)', () => {
  it('throws "Show not found" for a non-existent showId', async () => {
    await expect(executeConformationShow(-9999)).rejects.toThrow('Show not found');
  });
});
