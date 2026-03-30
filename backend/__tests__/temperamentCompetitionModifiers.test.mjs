// Tests for Story 31D-3: Competition Temperament Modifiers.
// Covers TEMPERAMENT_COMPETITION_MODIFIERS constant, getTemperamentCompetitionModifiers(),
// and integration with calculateCompetitionScore() (Math.random=0.5 → zero luck).

import { jest } from '@jest/globals';

// ── Mocks (must precede all dynamic imports) ──────────────────────────────────
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));

// ── Dynamic imports (after mocks) ────────────────────────────────────────────
const { getTemperamentCompetitionModifiers, TEMPERAMENT_COMPETITION_MODIFIERS } = await import(
  '../modules/horses/services/temperamentService.mjs'
);

const { calculateCompetitionScore } = await import('../utils/competitionScore.mjs');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Racing horse with all 3 relevant stats = 30 → baseScore = 90, no traits */
function makeRacingHorse(overrides = {}) {
  return {
    id: 1,
    name: 'TestHorse',
    speed: 30,
    stamina: 30,
    intelligence: 30,
    temperament: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit: TEMPERAMENT_COMPETITION_MODIFIERS shape
// ─────────────────────────────────────────────────────────────────────────────

describe('TEMPERAMENT_COMPETITION_MODIFIERS — constant shape', () => {
  const EXPECTED_TYPES = [
    'Spirited',
    'Nervous',
    'Calm',
    'Bold',
    'Steady',
    'Independent',
    'Reactive',
    'Stubborn',
    'Playful',
    'Lazy',
    'Aggressive',
  ];

  it('exports an entry for all 11 temperament types', () => {
    for (const type of EXPECTED_TYPES) {
      expect(TEMPERAMENT_COMPETITION_MODIFIERS).toHaveProperty(type);
    }
  });

  it('every entry has riddenModifier and conformationModifier as numbers', () => {
    for (const [_type, mods] of Object.entries(TEMPERAMENT_COMPETITION_MODIFIERS)) {
      expect(typeof mods.riddenModifier).toBe('number');
      expect(typeof mods.conformationModifier).toBe('number');
      // Values should be small decimals — sanity bounds check
      expect(Math.abs(mods.riddenModifier)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(mods.conformationModifier)).toBeLessThanOrEqual(0.1);
    }
  });

  it('matches PRD-03 §7.5 values', () => {
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
      conformationModifier: 0.0,
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

  it('returns zero modifiers and logs warn for unknown string', () => {
    mockLogger.warn.mockClear();
    expect(getTemperamentCompetitionModifiers('UnknownTemp')).toEqual({
      riddenModifier: 0,
      conformationModifier: 0,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown temperament "UnknownTemp"'));
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

describe('calculateCompetitionScore() — temperament ridden modifiers', () => {
  let mathRandomSpy;

  beforeEach(() => {
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('null temperament: score = 90 (no adjustment)', () => {
    const horse = makeRacingHorse({ temperament: null });
    expect(calculateCompetitionScore(horse, 'Racing')).toBe(90);
  });

  it('Bold (+5% ridden): score = Math.round(90 * 1.05) = 95', () => {
    const horse = makeRacingHorse({ temperament: 'Bold' });
    expect(calculateCompetitionScore(horse, 'Racing')).toBe(95);
  });

  it('Nervous (-5% ridden): score = Math.round(90 * 0.95) = 86', () => {
    const horse = makeRacingHorse({ temperament: 'Nervous' });
    expect(calculateCompetitionScore(horse, 'Racing')).toBe(86);
  });

  it('Calm (+2% ridden): score = Math.round(90 * 1.02) = 92', () => {
    const horse = makeRacingHorse({ temperament: 'Calm' });
    expect(calculateCompetitionScore(horse, 'Racing')).toBe(92);
  });

  it('Lazy (-5% ridden): score = Math.round(90 * 0.95) = 86', () => {
    const horse = makeRacingHorse({ temperament: 'Lazy' });
    expect(calculateCompetitionScore(horse, 'Racing')).toBe(86);
  });

  it('explicit showType="ridden" produces same result as omitting showType', () => {
    const horse = makeRacingHorse({ temperament: 'Bold' });
    // Both must equal 95 — verifies the parameter is wired correctly, not just a tautological comparison
    expect(calculateCompetitionScore(horse, 'Racing', 'ridden')).toBe(95);
    expect(calculateCompetitionScore(horse, 'Racing')).toBe(95);
  });

  it('unrecognized showType logs a warning and defaults to ridden behavior', () => {
    const horse = makeRacingHorse({ temperament: 'Bold' });
    mockLogger.warn.mockClear();
    // 'invalid' is not 'conformation', so riddenModifier (+5%) is used → 95
    expect(calculateCompetitionScore(horse, 'Racing', 'invalid')).toBe(95);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Unrecognized showType "invalid"'));
  });
});

describe('calculateCompetitionScore() — temperament conformation modifiers', () => {
  let mathRandomSpy;

  beforeEach(() => {
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('Calm conformation (+5%): score = Math.round(90 * 1.05) = 95', () => {
    const horse = makeRacingHorse({ temperament: 'Calm' });
    expect(calculateCompetitionScore(horse, 'Racing', 'conformation')).toBe(95);
  });

  it('Spirited conformation (-2%): score = Math.round(90 * 0.98) = 88', () => {
    const horse = makeRacingHorse({ temperament: 'Spirited' });
    expect(calculateCompetitionScore(horse, 'Racing', 'conformation')).toBe(88);
  });

  it('Lazy conformation (0%): score = 90 (no change)', () => {
    const horse = makeRacingHorse({ temperament: 'Lazy' });
    expect(calculateCompetitionScore(horse, 'Racing', 'conformation')).toBe(90);
  });

  it('Aggressive conformation (-5%): score = Math.round(90 * 0.95) = 86', () => {
    const horse = makeRacingHorse({ temperament: 'Aggressive' });
    expect(calculateCompetitionScore(horse, 'Racing', 'conformation')).toBe(86);
  });

  it('null temperament conformation: score = 90 (no adjustment)', () => {
    const horse = makeRacingHorse({ temperament: null });
    expect(calculateCompetitionScore(horse, 'Racing', 'conformation')).toBe(90);
  });
});

describe('calculateCompetitionScore() — temperament + trait stacking', () => {
  let mathRandomSpy;

  beforeEach(() => {
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    mockLogger.info.mockClear();
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('Bold + racing affinity trait: (90+5) * 1.05 = Math.round(99.75) = 100', () => {
    const horse = makeRacingHorse({
      temperament: 'Bold',
      epigeneticModifiers: { positive: ['discipline_affinity_racing'] },
    });
    // baseScore=90, traitBonus=+5 → scoreWithTraitBonus=95
    // Bold ridden +5% → 95 * 1.05 = 99.75 → Math.round = 100
    expect(calculateCompetitionScore(horse, 'Racing')).toBe(100);
  });

  it('Nervous + racing affinity trait: (90+5) * 0.95 = Math.round(90.25) = 90', () => {
    const horse = makeRacingHorse({
      temperament: 'Nervous',
      epigeneticModifiers: { positive: ['discipline_affinity_racing'] },
    });
    // scoreWithTraitBonus=95, Nervous ridden -5% → 95 * 0.95 = 90.25 → 90
    expect(calculateCompetitionScore(horse, 'Racing')).toBe(90);
  });
});
