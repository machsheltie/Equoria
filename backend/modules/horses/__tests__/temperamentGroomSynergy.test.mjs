/**
 * Tests for Story 31D.4: Groom Temperament Synergy
 *
 * Covers:
 * - getTemperamentGroomSynergy() — all pairings from PRD-03 §7.6
 * - Data integrity — TEMPERAMENT_GROOM_SYNERGY keys match TEMPERAMENT_TYPES
 */

import { describe, it, expect } from '@jest/globals';

// NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): the
// previous logger mock was used to assert on logger.warn / logger.info
// calls. Per doctrine, observing logger calls cross-module is dropped
// in favor of behavioural assertions on the function return values.

import { getTemperamentGroomSynergy, TEMPERAMENT_GROOM_SYNERGY } from '../services/temperamentService.mjs';
import { TEMPERAMENT_TYPES } from '../data/temperamentTypes.mjs';

describe('Story 31D.4: Groom Temperament Synergy', () => {
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

    // Owner ruling 2026-10-21: Playful renamed Driven, Willing added (12 temperaments).
    // Old contract: Playful + energetic → +0.15. Driven keeps that cell; Willing is new.
    it('Driven + energetic → +0.15', () => {
      expect(getTemperamentGroomSynergy('Driven', 'energetic')).toBe(0.15);
    });

    it('Willing + gentle → +0.15', () => {
      expect(getTemperamentGroomSynergy('Willing', 'gentle')).toBe(0.15);
    });

    it('Willing + patient → +0.10', () => {
      expect(getTemperamentGroomSynergy('Willing', 'patient')).toBe(0.1);
    });

    it('Playful is no longer a temperament → 0', () => {
      expect(getTemperamentGroomSynergy('Playful', 'energetic')).toBe(0);
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

    // Task 4.6 — unknown temperament → 0 (logger.warn assertion dropped per no-mocks doctrine)
    it('unknown temperament string → 0', () => {
      const result = getTemperamentGroomSynergy('UnknownBreed', 'patient');
      expect(result).toBe(0);
    });

    // Task 4.7 — unknown personality → 0 (no error)
    it('unknown personality string → 0 (no error)', () => {
      expect(() => getTemperamentGroomSynergy('Nervous', 'mystic')).not.toThrow();
      expect(getTemperamentGroomSynergy('Nervous', 'mystic')).toBe(0);
    });

    // Review: _any bypass only fires for canonical personalities (Calm/Steady)
    it('Calm + invalid personality (e.g. "methodical") → 0 (not a canonical personality)', () => {
      expect(getTemperamentGroomSynergy('Calm', 'methodical')).toBe(0);
    });

    it('Steady + invalid personality (e.g. "balanced") → 0 (not a canonical personality)', () => {
      expect(getTemperamentGroomSynergy('Steady', 'balanced')).toBe(0);
    });

    // Review: whitespace in personality is trimmed correctly
    it('personality with leading/trailing whitespace is normalised (e.g. " patient ")', () => {
      expect(getTemperamentGroomSynergy('Nervous', ' patient ')).toBe(0.25);
    });

    // Review: whitespace in temperament is trimmed correctly
    it('temperament with leading/trailing whitespace is normalised (e.g. " Nervous ")', () => {
      expect(getTemperamentGroomSynergy(' Nervous ', 'patient')).toBe(0.25);
    });
  });

  // ─── Data integrity test ──────────────────────────────────────────────────

  describe('TEMPERAMENT_GROOM_SYNERGY data integrity (Task 4.13)', () => {
    // Old contract: 11 keys. Owner ruling 2026-10-21: Playful renamed Driven, Willing added (12 temperaments).
    it('all 12 keys in TEMPERAMENT_GROOM_SYNERGY match TEMPERAMENT_TYPES array', () => {
      const synergyKeys = Object.keys(TEMPERAMENT_GROOM_SYNERGY).sort();
      const temperamentTypesKeys = [...TEMPERAMENT_TYPES].sort();
      expect(synergyKeys).toEqual(temperamentTypesKeys);
    });
  });
});
