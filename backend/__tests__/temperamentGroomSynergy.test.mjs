/**
 * Tests for Story 31D.4: Groom Temperament Synergy
 *
 * Covers:
 * - getTemperamentGroomSynergy() — all pairings from PRD-03 §7.6
 * - calculateBondingEffects() — synergy integration + regression (2-arg form)
 * - Data integrity — TEMPERAMENT_GROOM_SYNERGY keys match TEMPERAMENT_TYPES
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock logger BEFORE any dynamic imports (jest.unstable_mockModule rule)
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
};

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  default: mockLogger,
}));

// Dynamic imports (must come after mock declarations)
const { getTemperamentGroomSynergy, TEMPERAMENT_GROOM_SYNERGY } = await import(
  '../modules/horses/services/temperamentService.mjs'
);
const { calculateBondingEffects } = await import('../utils/groomBondingSystem.mjs');
const { GROOM_CONFIG } = await import('../config/groomConfig.mjs');
const { TEMPERAMENT_TYPES } = await import('../modules/horses/data/breedGeneticProfiles.mjs');

describe('Story 31D.4: Groom Temperament Synergy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Unit tests: getTemperamentGroomSynergy() ────────────────────────────

  describe('getTemperamentGroomSynergy() — explicit pairings (AC #3)', () => {
    // Task 4.1 — all 17 explicit pairings from the AC table

    it('Spirited + energetic → +0.20', () => {
      expect(getTemperamentGroomSynergy('Spirited', 'energetic')).toBe(0.2);
    });

    it('Nervous + patient → +0.25', () => {
      expect(getTemperamentGroomSynergy('Nervous', 'patient')).toBe(0.25);
    });

    it('Nervous + gentle → +0.25', () => {
      expect(getTemperamentGroomSynergy('Nervous', 'gentle')).toBe(0.25);
    });

    it('Nervous + strict → -0.15', () => {
      expect(getTemperamentGroomSynergy('Nervous', 'strict')).toBe(-0.15);
    });

    it('Bold + energetic → +0.15', () => {
      expect(getTemperamentGroomSynergy('Bold', 'energetic')).toBe(0.15);
    });

    it('Bold + strict → +0.15', () => {
      expect(getTemperamentGroomSynergy('Bold', 'strict')).toBe(0.15);
    });

    it('Independent + patient → +0.15', () => {
      expect(getTemperamentGroomSynergy('Independent', 'patient')).toBe(0.15);
    });

    it('Reactive + patient → +0.20', () => {
      expect(getTemperamentGroomSynergy('Reactive', 'patient')).toBe(0.2);
    });

    it('Reactive + gentle → +0.20', () => {
      expect(getTemperamentGroomSynergy('Reactive', 'gentle')).toBe(0.2);
    });

    it('Stubborn + strict → +0.15', () => {
      expect(getTemperamentGroomSynergy('Stubborn', 'strict')).toBe(0.15);
    });

    it('Playful + energetic → +0.15', () => {
      expect(getTemperamentGroomSynergy('Playful', 'energetic')).toBe(0.15);
    });

    it('Lazy + energetic → +0.10', () => {
      expect(getTemperamentGroomSynergy('Lazy', 'energetic')).toBe(0.1);
    });

    it('Lazy + strict → +0.10', () => {
      expect(getTemperamentGroomSynergy('Lazy', 'strict')).toBe(0.1);
    });

    it('Aggressive + strict → +0.10', () => {
      expect(getTemperamentGroomSynergy('Aggressive', 'strict')).toBe(0.1);
    });

    it('Aggressive + patient → +0.10', () => {
      expect(getTemperamentGroomSynergy('Aggressive', 'patient')).toBe(0.1);
    });
  });

  describe('getTemperamentGroomSynergy() — Calm universal bonus (AC #3)', () => {
    // Task 4.2 — Calm + any personality returns +0.10

    it('Calm + gentle → +0.10', () => {
      expect(getTemperamentGroomSynergy('Calm', 'gentle')).toBe(0.1);
    });

    it('Calm + energetic → +0.10', () => {
      expect(getTemperamentGroomSynergy('Calm', 'energetic')).toBe(0.1);
    });

    it('Calm + patient → +0.10', () => {
      expect(getTemperamentGroomSynergy('Calm', 'patient')).toBe(0.1);
    });

    it('Calm + strict → +0.10', () => {
      expect(getTemperamentGroomSynergy('Calm', 'strict')).toBe(0.1);
    });
  });

  describe('getTemperamentGroomSynergy() — Steady universal bonus (AC #3)', () => {
    // Task 4.3 — Steady + any personality returns +0.10

    it('Steady + gentle → +0.10', () => {
      expect(getTemperamentGroomSynergy('Steady', 'gentle')).toBe(0.1);
    });

    it('Steady + energetic → +0.10', () => {
      expect(getTemperamentGroomSynergy('Steady', 'energetic')).toBe(0.1);
    });

    it('Steady + patient → +0.10', () => {
      expect(getTemperamentGroomSynergy('Steady', 'patient')).toBe(0.1);
    });

    it('Steady + strict → +0.10', () => {
      expect(getTemperamentGroomSynergy('Steady', 'strict')).toBe(0.1);
    });
  });

  describe('getTemperamentGroomSynergy() — null/unknown inputs (AC #5, #6)', () => {
    // Task 4.4 — null temperament → 0
    it('null temperament → 0 (AC #5)', () => {
      expect(getTemperamentGroomSynergy(null, 'patient')).toBe(0);
    });

    it('undefined temperament → 0 (AC #5)', () => {
      expect(getTemperamentGroomSynergy(undefined, 'patient')).toBe(0);
    });

    // Task 4.5 — null groomPersonality → 0
    it('null groomPersonality → 0 (AC #6)', () => {
      expect(getTemperamentGroomSynergy('Nervous', null)).toBe(0);
    });

    it('undefined groomPersonality → 0 (AC #6)', () => {
      expect(getTemperamentGroomSynergy('Nervous', undefined)).toBe(0);
    });

    // Task 4.6 — unknown temperament → 0 + logs warn
    it('unknown temperament string → 0 and logs warn', () => {
      const result = getTemperamentGroomSynergy('UnknownBreed', 'patient');
      expect(result).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown temperament "UnknownBreed"'));
    });

    // Task 4.7 — unknown personality → 0 (no error)
    it('unknown personality string → 0 (no error)', () => {
      expect(() => getTemperamentGroomSynergy('Nervous', 'mystic')).not.toThrow();
      expect(getTemperamentGroomSynergy('Nervous', 'mystic')).toBe(0);
    });
  });

  // ─── Integration tests: calculateBondingEffects() ────────────────────────

  describe('calculateBondingEffects() — synergy integration', () => {
    const BASE_GAIN = GROOM_CONFIG.DAILY_BOND_GAIN; // 2

    // Task 4.8 — Nervous + patient → +25% → bondChange ≈ 2.5 (AC #1)
    it('Nervous + patient groom: bondChange = 2.5, synergyModifier = 0.25 (AC #1)', () => {
      const result = calculateBondingEffects(20, 'brushing', 'patient', 'Nervous');
      expect(result.eligible).toBe(true);
      expect(result.synergyModifier).toBe(0.25);
      expect(result.bondChange).toBeCloseTo(BASE_GAIN * 1.25, 5); // 2.5
      expect(result.newBondScore).toBeCloseTo(22.5, 5);
    });

    // Task 4.9 — Nervous + strict → -15% → bondChange ≈ 1.7 (AC #2)
    it('Nervous + strict groom: bondChange = 1.7, synergyModifier = -0.15 (AC #2)', () => {
      const result = calculateBondingEffects(20, 'brushing', 'strict', 'Nervous');
      expect(result.eligible).toBe(true);
      expect(result.synergyModifier).toBe(-0.15);
      expect(result.bondChange).toBeCloseTo(BASE_GAIN * 0.85, 5); // 1.7
      expect(result.newBondScore).toBeCloseTo(21.7, 5);
    });

    // Task 4.10 — 2-arg regression: bondChange = 2 (AC #7)
    it('2-arg call: bondChange = 2, newBondScore = 22 (regression AC #7)', () => {
      const result = calculateBondingEffects(20, 'brushing');
      expect(result.bondChange).toBe(2);
      expect(result.newBondScore).toBe(22);
      expect(result.eligible).toBe(true);
      expect(result.synergyModifier).toBe(0);
    });

    // Task 4.11 — null inputs → bondChange = 2
    it('calculateBondingEffects(20, brushing, null, null): bondChange = 2 (null = neutral)', () => {
      const result = calculateBondingEffects(20, 'brushing', null, null);
      expect(result.bondChange).toBe(2);
      expect(result.synergyModifier).toBe(0);
    });

    // Task 4.12 — enrichment task ineligible even with synergy supplied
    it('enrichment task (desensitization) with synergy: bondChange = 0, ineligible', () => {
      const result = calculateBondingEffects(20, 'desensitization', 'patient', 'Nervous');
      expect(result.eligible).toBe(false);
      expect(result.bondChange).toBe(0);
      expect(result.newBondScore).toBe(20);
    });

    // Bonus: verify logger.info is called when synergy is non-zero
    it('logs synergy info when modifier is non-zero', () => {
      calculateBondingEffects(20, 'brushing', 'patient', 'Nervous');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('synergy'));
    });

    // No logging when synergy is zero
    it('does not log synergy info when modifier is zero (2-arg form)', () => {
      calculateBondingEffects(20, 'brushing');
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  // ─── Data integrity test ──────────────────────────────────────────────────

  describe('TEMPERAMENT_GROOM_SYNERGY data integrity (Task 4.13)', () => {
    it('all 11 keys in TEMPERAMENT_GROOM_SYNERGY match TEMPERAMENT_TYPES array', () => {
      const synergyKeys = Object.keys(TEMPERAMENT_GROOM_SYNERGY).sort();
      const temperamentTypesKeys = [...TEMPERAMENT_TYPES].sort();
      expect(synergyKeys).toEqual(temperamentTypesKeys);
    });
  });
});
