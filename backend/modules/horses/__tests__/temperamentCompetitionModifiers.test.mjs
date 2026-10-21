// Tests for Story 31D-3: Competition Temperament Modifiers.
// Covers the TEMPERAMENT_COMPETITION_MODIFIERS constant and
// getTemperamentCompetitionModifiers(). (Its integration with the old
// utils/competitionScore.mjs scorer was removed with that dead file on
// 2026-10-21; no show ever scored through it.)

import { describe, it, expect } from '@jest/globals';
import {
  getTemperamentCompetitionModifiers,
  TEMPERAMENT_COMPETITION_MODIFIERS,
} from '../services/temperamentService.mjs';
import { TEMPERAMENT_TYPES } from '../data/breedGeneticProfiles.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Unit: TEMPERAMENT_COMPETITION_MODIFIERS shape
// ─────────────────────────────────────────────────────────────────────────────

describe('TEMPERAMENT_COMPETITION_MODIFIERS — constant shape', () => {
  it('exports an entry for every type in TEMPERAMENT_TYPES (data integrity — source of truth)', () => {
    for (const type of TEMPERAMENT_TYPES) {
      expect(TEMPERAMENT_COMPETITION_MODIFIERS).toHaveProperty(type);
    }
  });

  it('has no extra keys beyond TEMPERAMENT_TYPES (no orphan entries)', () => {
    for (const key of Object.keys(TEMPERAMENT_COMPETITION_MODIFIERS)) {
      expect(TEMPERAMENT_TYPES).toContain(key);
    }
  });

  it('every entry has riddenModifier and conformationModifier as numbers', () => {
    for (const [_type, mods] of Object.entries(TEMPERAMENT_COMPETITION_MODIFIERS)) {
      expect(typeof mods.riddenModifier).toBe('number');
      expect(typeof mods.conformationModifier).toBe('number');
      // Sanity bounds — modifiers should be small percentages
      expect(Math.abs(mods.riddenModifier)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(mods.conformationModifier)).toBeLessThanOrEqual(0.1);
    }
  });

  it('is deeply frozen — outer object and all nested entries', () => {
    expect(Object.isFrozen(TEMPERAMENT_COMPETITION_MODIFIERS)).toBe(true);
    for (const mods of Object.values(TEMPERAMENT_COMPETITION_MODIFIERS)) {
      expect(Object.isFrozen(mods)).toBe(true);
    }
  });

  it('matches PRD-03 §7.5 spot-check values', () => {
    expect(TEMPERAMENT_COMPETITION_MODIFIERS.Bold).toEqual({
      riddenModifier: 0.05,
      conformationModifier: 0.02,
    });
    expect(TEMPERAMENT_COMPETITION_MODIFIERS.Nervous).toEqual({
      riddenModifier: -0.05,
      conformationModifier: -0.05,
    });
    expect(TEMPERAMENT_COMPETITION_MODIFIERS.Calm).toEqual({
      riddenModifier: 0.02,
      conformationModifier: 0.05,
    });
    expect(TEMPERAMENT_COMPETITION_MODIFIERS.Lazy).toEqual({
      riddenModifier: -0.05,
      conformationModifier: 0,
    });
    expect(TEMPERAMENT_COMPETITION_MODIFIERS.Spirited).toEqual({
      riddenModifier: 0.03,
      conformationModifier: -0.02,
    });
    expect(TEMPERAMENT_COMPETITION_MODIFIERS.Steady).toEqual({
      riddenModifier: 0.03,
      conformationModifier: 0.03,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit: getTemperamentCompetitionModifiers()
// ─────────────────────────────────────────────────────────────────────────────

describe('getTemperamentCompetitionModifiers() — null / unknown guards', () => {
  it('returns zero modifiers for null', () => {
    expect(getTemperamentCompetitionModifiers(null)).toEqual({
      riddenModifier: 0,
      conformationModifier: 0,
    });
  });

  it('returns zero modifiers for undefined', () => {
    expect(getTemperamentCompetitionModifiers(undefined)).toEqual({
      riddenModifier: 0,
      conformationModifier: 0,
    });
  });

  it('returns zero modifiers for unknown string', () => {
    // NO MOCKS: the previous version asserted on logger.warn calls.
    // Without module mocking, observing logger calls cross-module is
    // unreliable due to ESM cache fragmentation. The behavioral
    // contract — "unknown temperament returns zero modifiers" — is
    // still verified. The logger emission is a side effect, not the
    // testable surface.
    expect(getTemperamentCompetitionModifiers('UnknownTemp')).toEqual({
      riddenModifier: 0,
      conformationModifier: 0,
    });
  });

  it('returns zero modifiers for non-string truthy input (typeof guard)', () => {
    // Arrays coerce to strings as object keys — typeof guard must reject them
    expect(getTemperamentCompetitionModifiers(['Bold'])).toEqual({
      riddenModifier: 0,
      conformationModifier: 0,
    });
    expect(getTemperamentCompetitionModifiers(123)).toEqual({
      riddenModifier: 0,
      conformationModifier: 0,
    });
  });

  it('returned object is a copy — mutating it does not affect the global constant', () => {
    const mods = getTemperamentCompetitionModifiers('Bold');
    mods.riddenModifier = 999;
    expect(TEMPERAMENT_COMPETITION_MODIFIERS.Bold.riddenModifier).toBe(0.05);
  });
});

describe('getTemperamentCompetitionModifiers() — all 11 valid types', () => {
  const cases = Object.entries(TEMPERAMENT_COMPETITION_MODIFIERS);

  it.each(cases)('%s returns correct modifiers', (temperament, expected) => {
    expect(getTemperamentCompetitionModifiers(temperament)).toEqual(expected);
  });
});
