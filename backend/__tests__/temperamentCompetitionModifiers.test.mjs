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

const { TEMPERAMENT_TYPES } = await import('../modules/horses/data/breedGeneticProfiles.mjs');

const { calculateCompetitionScore } = await import('../utils/competitionScore.mjs');

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

  it('returns zero modifiers and logs warn for unknown string', () => {
    mockLogger.warn.mockClear();
    expect(getTemperamentCompetitionModifiers('UnknownTemp')).toEqual({
      riddenModifier: 0,
      conformationModifier: 0,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown temperament "UnknownTemp"'));
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
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: null }), 'Racing')).toBe(90);
  });

  // Positive ridden modifiers
  it('Bold (+5% ridden): 90 * 1.05 = 94.5 → Math.round = 95', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Bold' }), 'Racing')).toBe(95);
  });

  it('Bold temperament: logger.info emitted with modifier percentage "5.0%"', () => {
    mockLogger.info.mockClear();
    calculateCompetitionScore(makeRacingHorse({ temperament: 'Bold' }), 'Racing');
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Temperament "Bold" ridden modifier: 5.0%'));
  });

  it('Spirited (+3% ridden): Math.round(90 * 1.03) = 93', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Spirited' }), 'Racing')).toBe(93);
  });

  it('Calm (+2% ridden): Math.round(90 * 1.02) = 92', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Calm' }), 'Racing')).toBe(92);
  });

  it('Steady (+3% ridden): Math.round(90 * 1.03) = 93', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Steady' }), 'Racing')).toBe(93);
  });

  it('Playful (+1% ridden): Math.round(90 * 1.01) = 91', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Playful' }), 'Racing')).toBe(91);
  });

  // Negative ridden modifiers
  it('Nervous (-5% ridden): 90 * 0.95 = 85.5 → Math.round = 86', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Nervous' }), 'Racing')).toBe(86);
  });

  it('Lazy (-5% ridden): 90 * 0.95 = 85.5 → Math.round = 86', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Lazy' }), 'Racing')).toBe(86);
  });

  it('Independent (-2% ridden): Math.round(90 * 0.98) = 88', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Independent' }), 'Racing')).toBe(88);
  });

  it('Reactive (-3% ridden): Math.round(90 * 0.97) = 87', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Reactive' }), 'Racing')).toBe(87);
  });

  it('Stubborn (-4% ridden): Math.round(90 * 0.96) = 86', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Stubborn' }), 'Racing')).toBe(86);
  });

  it('Aggressive (-3% ridden): Math.round(90 * 0.97) = 87', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Aggressive' }), 'Racing')).toBe(87);
  });

  it('defaults to ridden when showType is omitted', () => {
    const horse = makeRacingHorse({ temperament: 'Bold' });
    expect(calculateCompetitionScore(horse, 'Racing')).toBe(calculateCompetitionScore(horse, 'Racing', 'ridden'));
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

  it('Calm conformation (+5%): Math.round(90 * 1.05) = 95', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Calm' }), 'Racing', 'conformation')).toBe(95);
  });

  it('Spirited conformation (-2%): Math.round(90 * 0.98) = 88', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Spirited' }), 'Racing', 'conformation')).toBe(88);
  });

  it('Lazy conformation (0%): score = 90 (no change)', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Lazy' }), 'Racing', 'conformation')).toBe(90);
  });

  it('Aggressive conformation (-5%): Math.round(90 * 0.95) = 86', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Aggressive' }), 'Racing', 'conformation')).toBe(
      86,
    );
  });

  it('Nervous conformation (-5%): Math.round(90 * 0.95) = 86 (AC #2 — any competition)', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: 'Nervous' }), 'Racing', 'conformation')).toBe(86);
  });

  it('null temperament conformation: score = 90 (no adjustment)', () => {
    expect(calculateCompetitionScore(makeRacingHorse({ temperament: null }), 'Racing', 'conformation')).toBe(90);
  });
});

describe('calculateCompetitionScore() — showType validation', () => {
  let mathRandomSpy;

  beforeEach(() => {
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    mockLogger.warn.mockClear();
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('invalid showType: falls back to ridden modifiers and emits warn', () => {
    const horse = makeRacingHorse({ temperament: 'Bold' });
    const scoreInvalid = calculateCompetitionScore(horse, 'Racing', 'halter');
    const scoreRidden = calculateCompetitionScore(horse, 'Racing', 'ridden');
    expect(scoreInvalid).toBe(scoreRidden);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Unrecognized showType "halter"'));
  });
});

describe('calculateCompetitionScore() — minimum score floor (AC #7)', () => {
  let mathRandomSpy;

  beforeEach(() => {
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    mockLogger.warn.mockClear();
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('score is never negative — zero-stat horse with negative temperament returns 0', () => {
    const horse = makeRacingHorse({
      speed: 0,
      stamina: 0,
      intelligence: 0,
      temperament: 'Nervous',
    });
    expect(calculateCompetitionScore(horse, 'Racing')).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateCompetitionScore() — edge cases', () => {
  let mathRandomSpy;

  beforeEach(() => {
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    mockLogger.warn.mockClear();
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('blank-after-trim eventType throws', () => {
    expect(() => calculateCompetitionScore(makeRacingHorse(), '   ')).toThrow('Event type cannot be blank');
  });

  it('Infinity stat is clamped to 0 and emits warn', () => {
    const horse = makeRacingHorse({ speed: Infinity });
    expect(calculateCompetitionScore(horse, 'Racing')).toBe(0);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Non-finite base score'));
  });

  it('Show Jumping: precision=0 uses precision (not agility fallback)', () => {
    // Verify ?? fix — precision=0 is a valid stat value, not a missing stat
    // baseScore = (0 ?? 30) + 30 + 30 = 0 + 60 = 60; zero luck, no temperament
    const horse = makeRacingHorse({ precision: 0, agility: 30, focus: 30, stamina: 30 });
    expect(calculateCompetitionScore(horse, 'Show Jumping')).toBe(60);
  });
});

describe('calculateCompetitionScore() — temperament + trait stacking', () => {
  let mathRandomSpy;

  beforeEach(() => {
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
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
