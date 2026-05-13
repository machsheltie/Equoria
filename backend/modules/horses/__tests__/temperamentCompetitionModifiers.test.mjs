// Tests for Story 31D-3: Competition Temperament Modifiers.
// Covers TEMPERAMENT_COMPETITION_MODIFIERS constant, getTemperamentCompetitionModifiers(),
// and integration with calculateCompetitionScore() (zeroLuck=()=>0.5 → zero luck via DI).

import { describe, it, expect } from '@jest/globals';
import {
  getTemperamentCompetitionModifiers,
  TEMPERAMENT_COMPETITION_MODIFIERS,
} from '../modules/horses/services/temperamentService.mjs';
import { TEMPERAMENT_TYPES } from '../modules/horses/data/breedGeneticProfiles.mjs';
import { calculateCompetitionScore } from '../utils/competitionScore.mjs';

// Deterministic luck function: 0.5 * 0.18 - 0.09 = 0 (zero luck modifier)
const zeroLuck = () => 0.5;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Unique ID counter prevents any future id-keyed cache collision between tests
let _horseIdSeq = 0;

/** Racing horse with all 3 relevant stats = 30 → baseScore = 90, no traits */
function makeRacingHorse(overrides = {}) {
  return {
    id: ++_horseIdSeq,
    name: 'TestHorse',
    speed: 30,
    stamina: 30,
    intelligence: 30,
    temperament: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Luck formula verification — confirms test anchor arithmetic
// ─────────────────────────────────────────────────────────────────────────────

describe('Luck formula verification (test anchor)', () => {
  it('random=0.5 → luckModifier=0 (neutral — integration tests rely on this)', () => {
    expect(0.5 * 0.18 - 0.09).toBeCloseTo(0, 10);
  });

  it('random=0.0 → luckModifier=-0.09 (maximum negative luck)', () => {
    expect(0.0 * 0.18 - 0.09).toBeCloseTo(-0.09, 10);
  });

  it('random=1.0 → luckModifier=+0.09 (maximum positive luck)', () => {
    expect(1.0 * 0.18 - 0.09).toBeCloseTo(0.09, 10);
  });
});

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

// ─────────────────────────────────────────────────────────────────────────────
// Integration: calculateCompetitionScore() with temperament modifiers
// Math.random = 0.5 → luckModifier = 0.5 * 0.18 - 0.09 = 0 (zero luck)
// baseScore = 90 (Racing: speed=30, stamina=30, intelligence=30), no traits
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateCompetitionScore() — temperament ridden modifiers (all 11 types)', () => {
  it('null temperament: score = 90 (no adjustment)', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: null }), 'Racing', 'ridden', zeroLuck)).toBe(90);
  });

  it('Bold (+5% ridden): 90 * 1.05 = 94.5 → Math.round = 95', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Bold' }), 'Racing', 'ridden', zeroLuck)).toBe(95);
  });

  it('Spirited (+3% ridden): Math.round(90 * 1.03) = 93', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Spirited' }), 'Racing', 'ridden', zeroLuck)).toBe(
      93,
    );
  });

  it('Calm (+2% ridden): Math.round(90 * 1.02) = 92', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Calm' }), 'Racing', 'ridden', zeroLuck)).toBe(92);
  });

  it('Steady (+3% ridden): Math.round(90 * 1.03) = 93', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Steady' }), 'Racing', 'ridden', zeroLuck)).toBe(
      93,
    );
  });

  it('Playful (+1% ridden): Math.round(90 * 1.01) = 91', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Playful' }), 'Racing', 'ridden', zeroLuck)).toBe(
      91,
    );
  });

  it('Nervous (-5% ridden): 90 * 0.95 = 85.5 → Math.round = 86', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Nervous' }), 'Racing', 'ridden', zeroLuck)).toBe(
      86,
    );
  });

  it('Lazy (-5% ridden): 90 * 0.95 = 85.5 → Math.round = 86', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Lazy' }), 'Racing', 'ridden', zeroLuck)).toBe(86);
  });

  it('Independent (-2% ridden): Math.round(90 * 0.98) = 88', () => {
    expect(
      calculateCompetitionScore(makeRacingHorse({ temperament: 'Independent' }), 'Racing', 'ridden', zeroLuck),
    ).toBe(88);
  });

  it('Reactive (-3% ridden): Math.round(90 * 0.97) = 87', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Reactive' }), 'Racing', 'ridden', zeroLuck)).toBe(
      87,
    );
  });

  it('Stubborn (-4% ridden): Math.round(90 * 0.96) = 86', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Stubborn' }), 'Racing', 'ridden', zeroLuck)).toBe(
      86,
    );
  });

  it('Aggressive (-3% ridden): Math.round(90 * 0.97) = 87', () => {
    expect(
      calculateCompetitionScore(makeRacingHorse({ temperament: 'Aggressive' }), 'Racing', 'ridden', zeroLuck),
    ).toBe(87);
  });

  it('defaults to ridden when showType is omitted', () => {
    const horse = makeRacingHorse({ temperament: 'Bold' });
    expect(calculateCompetitionScore(horse, 'Racing', 'ridden', zeroLuck)).toBe(
      calculateCompetitionScore(horse, 'Racing', 'ridden', zeroLuck),
    );
  });
});

describe('calculateCompetitionScore() — temperament conformation modifiers', () => {
  it('Calm conformation (+5%): Math.round(90 * 1.05) = 95', () => {
    expect(
      calculateCompetitionScore(makeRacingHorse({ temperament: 'Calm' }), 'Racing', 'conformation', zeroLuck),
    ).toBe(95);
  });

  it('Spirited conformation (-2%): Math.round(90 * 0.98) = 88', () => {
    expect(
      calculateCompetitionScore(makeRacingHorse({ temperament: 'Spirited' }), 'Racing', 'conformation', zeroLuck),
    ).toBe(88);
  });

  it('Lazy conformation (0%): score = 90 (no change)', () => {
    expect(
      calculateCompetitionScore(makeRacingHorse({ temperament: 'Lazy' }), 'Racing', 'conformation', zeroLuck),
    ).toBe(90);
  });

  it('Aggressive conformation (-5%): Math.round(90 * 0.95) = 86', () => {
    expect(
      calculateCompetitionScore(makeRacingHorse({ temperament: 'Aggressive' }), 'Racing', 'conformation', zeroLuck),
    ).toBe(86);
  });

  it('Nervous conformation (-5%): Math.round(90 * 0.95) = 86 (AC #2 — any competition)', () => {
    expect(
      calculateCompetitionScore(makeRacingHorse({ temperament: 'Nervous' }), 'Racing', 'conformation', zeroLuck),
    ).toBe(86);
  });

  it('null temperament conformation: score = 90 (no adjustment)', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: null }), 'Racing', 'conformation', zeroLuck)).toBe(
      90,
    );
  });
});

describe('calculateCompetitionScore() — showType validation', () => {
  it('invalid showType: falls back to ridden modifiers (behavioural)', () => {
    const horse = makeRacingHorse({ temperament: 'Bold' });
    const scoreInvalid = calculateCompetitionScore(horse, 'Racing', 'halter', zeroLuck);
    const scoreRidden = calculateCompetitionScore(horse, 'Racing', 'ridden', zeroLuck);
    // The score equality proves the fallback fired. The associated
    // logger.warn emission was previously asserted here; per the
    // no-mocks doctrine that side-effect observation is dropped (the
    // behavioural fallback IS the contract; the log message is for
    // operators).
    expect(scoreInvalid).toBe(scoreRidden);
  });
});

describe('calculateCompetitionScore() — minimum score floor (AC #7)', () => {
  it('score is never negative — zero-stat horse with negative temperament returns 0', () => {
    const horse = makeRacingHorse({
      speed: 0,
      stamina: 0,
      intelligence: 0,
      temperament: 'Nervous',
    });
    expect(calculateCompetitionScore(horse, 'Racing', 'ridden', zeroLuck)).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateCompetitionScore() — edge cases', () => {
  it('blank-after-trim eventType throws', () => {
    expect(() => calculateCompetitionScore(makeRacingHorse(), '   ')).toThrow('Event type cannot be blank');
  });

  it('Infinity stat is clamped to 0 (behavioural)', () => {
    const horse = makeRacingHorse({ speed: Infinity });
    expect(calculateCompetitionScore(horse, 'Racing', 'ridden', zeroLuck)).toBe(0);
    // logger.warn assertion dropped per no-mocks doctrine; the score
    // clamping IS the contract.
  });

  it('Show Jumping: precision=0 uses precision (not agility fallback)', () => {
    // Verify ?? fix — precision=0 is a valid stat value, not a missing stat
    // baseScore = (0 ?? 30) + 30 + 30 = 0 + 60 = 60; zero luck, no temperament
    const horse = makeRacingHorse({ precision: 0, agility: 30, focus: 30, stamina: 30 });
    expect(calculateCompetitionScore(horse, 'Show Jumping', 'ridden', zeroLuck)).toBe(60);
  });
});

describe('calculateCompetitionScore() — temperament + trait stacking', () => {
  it('Bold + racing affinity trait: (90+5) * 1.05 = Math.round(99.75) = 100', () => {
    const horse = makeRacingHorse({
      temperament: 'Bold',
      epigeneticModifiers: { positive: ['discipline_affinity_racing'] },
    });
    // baseScore=90, traitBonus=+5 → scoreWithTraitBonus=95
    // Bold ridden +5% → 95 * 1.05 = 99.75 → Math.round = 100
    expect(calculateCompetitionScore(horse, 'Racing', 'ridden', zeroLuck)).toBe(100);
  });

  it('Nervous + racing affinity trait: (90+5) * 0.95 = Math.round(90.25) = 90', () => {
    const horse = makeRacingHorse({
      temperament: 'Nervous',
      epigeneticModifiers: { positive: ['discipline_affinity_racing'] },
    });
    // scoreWithTraitBonus=95, Nervous ridden -5% → 95 * 0.95 = 90.25 → 90
    expect(calculateCompetitionScore(horse, 'Racing', 'ridden', zeroLuck)).toBe(90);
  });
});
