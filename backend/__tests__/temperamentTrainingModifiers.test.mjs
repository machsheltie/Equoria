// Unit and integration tests for temperament training modifiers (Story 31D-2).
// Tests: getTemperamentTrainingModifiers() lookup, all 11 types, null/unknown handling,
// and integration with trainHorse() verifying XP + discipline score are modified correctly.

import { jest } from '@jest/globals';

// ── Mocks (must precede all dynamic imports) ──────────────────────────────

const mockPrisma = {
  horse: { update: jest.fn().mockResolvedValue({}) },
};
jest.unstable_mockModule('../db/index.mjs', () => ({ default: mockPrisma }));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));

const mockGetHorseAge = jest.fn();
const mockGetAnyRecentTraining = jest.fn();
const mockLogTrainingSession = jest.fn();
const mockGetLastTrainingDate = jest.fn();
jest.unstable_mockModule('../models/trainingModel.mjs', () => ({
  getHorseAge: mockGetHorseAge,
  getAnyRecentTraining: mockGetAnyRecentTraining,
  logTrainingSession: mockLogTrainingSession,
  getLastTrainingDate: mockGetLastTrainingDate,
}));

const mockGetHorseById = jest.fn();
const mockIncrementDisciplineScore = jest.fn();
const mockUpdateHorseStat = jest.fn();
jest.unstable_mockModule('../models/horseModel.mjs', () => ({
  getHorseById: mockGetHorseById,
  incrementDisciplineScore: mockIncrementDisciplineScore,
  updateHorseStat: mockUpdateHorseStat,
}));

const mockAddXpToUser = jest.fn();
const mockGetUserWithHorses = jest.fn();
jest.unstable_mockModule('../models/userModel.mjs', () => ({
  addXpToUser: mockAddXpToUser,
  getUserWithHorses: mockGetUserWithHorses,
}));

const mockLogXpEvent = jest.fn();
jest.unstable_mockModule('../models/xpLogModel.mjs', () => ({
  logXpEvent: mockLogXpEvent,
}));

const mockGetCombinedTraitEffects = jest.fn();
jest.unstable_mockModule('../utils/traitEffects.mjs', () => ({
  getCombinedTraitEffects: mockGetCombinedTraitEffects,
}));

const mockCheckTraitRequirements = jest.fn();
jest.unstable_mockModule('../utils/competitionLogic.mjs', () => ({
  checkTraitRequirements: mockCheckTraitRequirements,
}));

// ── Dynamic imports (after mocks) ─────────────────────────────────────────

const { getTemperamentTrainingModifiers, TEMPERAMENT_TRAINING_MODIFIERS } = await import(
  '../modules/horses/services/temperamentService.mjs'
);
const { TEMPERAMENT_TYPES } = await import('../modules/horses/data/breedGeneticProfiles.mjs');
const { trainHorse } = await import('../modules/training/controllers/trainingController.mjs');

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build a minimal horse object with a given temperament.
 * Eligible (age 5, no recent training).
 */
function makeHorse(temperament = null) {
  return {
    id: 42,
    name: 'Thunder',
    age: 5,
    userId: 'user-uuid-123',
    breedId: 1,
    temperament,
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    disciplineScores: { Racing: 20 },
    trainingCooldown: null,
  };
}

/**
 * Wire all training controller mocks so the horse is eligible with no trait effects.
 */
function setupEligibleMocks(horse) {
  mockGetHorseAge.mockResolvedValue(horse.age);
  mockGetAnyRecentTraining.mockResolvedValue(null); // no cooldown active
  mockGetLastTrainingDate.mockResolvedValue(null);
  mockGetHorseById.mockResolvedValue(horse);
  mockGetCombinedTraitEffects.mockReturnValue({}); // no trait modifiers
  mockCheckTraitRequirements.mockReturnValue(true);
  mockLogTrainingSession.mockResolvedValue({ id: 99 });
  mockIncrementDisciplineScore.mockResolvedValue({
    ...horse,
    disciplineScores: { Racing: 25 },
  });
  mockUpdateHorseStat.mockResolvedValue({});
  mockAddXpToUser.mockResolvedValue({ leveledUp: false, newLevel: 1 });
  mockLogXpEvent.mockResolvedValue({});
  mockPrisma.horse.update.mockResolvedValue({});
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Unit Tests: getTemperamentTrainingModifiers
// ═════════════════════════════════════════════════════════════════════════════

describe('getTemperamentTrainingModifiers — unit tests', () => {
  // 3.1 — all 11 temperament types return correct values
  const expected = [
    ['Spirited', { xpModifier: 0.1, scoreModifier: 0.05 }],
    ['Nervous', { xpModifier: -0.1, scoreModifier: -0.05 }],
    ['Calm', { xpModifier: 0.05, scoreModifier: 0.1 }],
    ['Bold', { xpModifier: 0.05, scoreModifier: 0.05 }],
    ['Steady', { xpModifier: 0.05, scoreModifier: 0.1 }],
    ['Independent', { xpModifier: -0.05, scoreModifier: 0.0 }],
    ['Reactive', { xpModifier: 0.0, scoreModifier: -0.05 }],
    ['Stubborn', { xpModifier: -0.15, scoreModifier: -0.1 }],
    ['Playful', { xpModifier: 0.05, scoreModifier: -0.05 }],
    ['Lazy', { xpModifier: -0.2, scoreModifier: -0.15 }],
    ['Aggressive', { xpModifier: -0.1, scoreModifier: -0.05 }],
  ];

  test.each(expected)('%s returns correct xpModifier and scoreModifier', (temperament, mods) => {
    const result = getTemperamentTrainingModifiers(temperament);
    expect(result.xpModifier).toBeCloseTo(mods.xpModifier, 10);
    expect(result.scoreModifier).toBeCloseTo(mods.scoreModifier, 10);
  });

  // 3.2 — null temperament returns zero modifiers
  test('null returns { xpModifier: 0, scoreModifier: 0 }', () => {
    expect(getTemperamentTrainingModifiers(null)).toEqual({ xpModifier: 0, scoreModifier: 0 });
  });

  // 3.2 — undefined returns zero modifiers (same path as null)
  test('undefined returns { xpModifier: 0, scoreModifier: 0 }', () => {
    expect(getTemperamentTrainingModifiers(undefined)).toEqual({ xpModifier: 0, scoreModifier: 0 });
  });

  // 3.3 — unknown string returns zero modifiers
  test('unknown string returns { xpModifier: 0, scoreModifier: 0 }', () => {
    expect(getTemperamentTrainingModifiers('Fiery')).toEqual({ xpModifier: 0, scoreModifier: 0 });
    expect(getTemperamentTrainingModifiers('')).toEqual({ xpModifier: 0, scoreModifier: 0 });
    expect(getTemperamentTrainingModifiers('CALM')).toEqual({ xpModifier: 0, scoreModifier: 0 }); // case sensitive
  });

  // 3.9 — data integrity: all 11 keys in constant match TEMPERAMENT_TYPES
  test('TEMPERAMENT_TRAINING_MODIFIERS contains exactly the 11 canonical types', () => {
    const constantKeys = Object.keys(TEMPERAMENT_TRAINING_MODIFIERS).sort();
    const canonicalKeys = [...TEMPERAMENT_TYPES].sort();
    expect(constantKeys).toEqual(canonicalKeys);
  });

  // 3.9 — every entry has numeric xpModifier and scoreModifier
  test.each(Object.entries(TEMPERAMENT_TRAINING_MODIFIERS))(
    '%s has numeric xpModifier and scoreModifier',
    (_type, mods) => {
      expect(typeof mods.xpModifier).toBe('number');
      expect(typeof mods.scoreModifier).toBe('number');
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. Integration Tests: temperament modifier applied inside trainHorse()
// ═════════════════════════════════════════════════════════════════════════════

describe('trainHorse() — temperament modifier integration', () => {
  let mathRandomSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress stat gain (random roll always > base 15% chance)
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  // 3.4 — Stubborn horse: -15% XP, -10% score (AC #1)
  // Uses trainingXpModifier: 1.0 to raise effective base to 10, avoiding the Math.round(4.5)=5
  // edge case at base=5 that would make the -10% score reduction unverifiable.
  test('Stubborn horse: XP and score both reduced with verifiable deltas (base boosted to 10)', async () => {
    const horse = makeHorse('Stubborn');
    setupEligibleMocks(horse);
    // Raise effective base to 10 via +100% trait modifier so both reductions are unambiguous
    mockGetCombinedTraitEffects.mockReturnValue({ trainingXpModifier: 1.0 });

    const result = await trainHorse(42, 'Racing');

    expect(result.success).toBe(true);

    // Score: Math.round(5 * (1 + 1.0)) = 10, then Math.round(10 * (1 - 0.10)) = Math.round(9.0) = 9
    expect(mockIncrementDisciplineScore).toHaveBeenCalledWith(42, 'Racing', 9);

    // XP: Math.round(5 * (1 + 1.0)) = 10, then Math.round(10 * (1 - 0.15)) = Math.round(8.5) = 9
    expect(mockAddXpToUser).toHaveBeenCalledWith('user-uuid-123', 9);

    expect(result.temperamentEffects).toEqual({
      temperament: 'Stubborn',
      xpModifier: -0.15,
      scoreModifier: -0.1,
    });
  });

  // 3.5 — Calm horse: +5% XP, +10% score (AC #2)
  test('Calm horse: XP stays 5 and discipline score increases to 6', async () => {
    const horse = makeHorse('Calm');
    setupEligibleMocks(horse);

    const result = await trainHorse(42, 'Dressage');

    expect(result.success).toBe(true);

    // XP: Math.round(5 * (1 + 0.05)) = Math.round(5.25) = 5
    expect(mockAddXpToUser).toHaveBeenCalledWith('user-uuid-123', 5);

    // Discipline score: Math.round(5 * (1 + 0.10)) = Math.round(5.5) = 6
    expect(mockIncrementDisciplineScore).toHaveBeenCalledWith(42, 'Dressage', 6);

    expect(result.temperamentEffects).toEqual({
      temperament: 'Calm',
      xpModifier: 0.05,
      scoreModifier: 0.1,
    });
  });

  // 3.6 — Lazy horse: minimum 1 XP and 1 score preserved (AC #7, #8)
  test('Lazy horse: result is successful and XP + score are each at least 1', async () => {
    const horse = makeHorse('Lazy');
    setupEligibleMocks(horse);

    const result = await trainHorse(42, 'Racing');

    expect(result.success).toBe(true);

    // XP: Math.round(5 * (1 - 0.20)) = Math.round(4.0) = 4, Math.max(1, 4) = 4
    expect(mockAddXpToUser).toHaveBeenCalledWith('user-uuid-123', 4);

    // Discipline score: Math.round(5 * (1 - 0.15)) = Math.round(4.25) = 4, Math.max(1, 4) = 4
    expect(mockIncrementDisciplineScore).toHaveBeenCalledWith(42, 'Racing', 4);

    expect(result.temperamentEffects).toEqual({
      temperament: 'Lazy',
      xpModifier: -0.2,
      scoreModifier: -0.15,
    });
  });

  // 3.7 — Temperament stacks with trait effects (both apply independently, AC #6)
  test('Spirited horse with +25% trait XP: both trait and temperament modifiers applied', async () => {
    const horse = makeHorse('Spirited');
    setupEligibleMocks(horse);

    // Trait effect: +25% XP modifier
    mockGetCombinedTraitEffects.mockReturnValue({ trainingXpModifier: 0.25 });

    const result = await trainHorse(42, 'Racing');

    expect(result.success).toBe(true);

    // Expected score (AC #6 — both trait and temperament apply independently):
    //   base = 5
    //   after trait: Math.round(5 * 1.25) = 6
    //   after Spirited +5%: Math.round(6 * 1.05) = Math.round(6.3) = 6
    //   Math.max(1, 6) = 6
    expect(mockIncrementDisciplineScore).toHaveBeenCalledWith(42, 'Racing', 6);

    // Expected XP:
    //   base = 5
    //   after trait: Math.round(5 * 1.25) = 6
    //   after Spirited +10%: Math.round(6 * 1.10) = Math.round(6.6) = 7
    //   Math.max(1, 7) = 7
    expect(mockAddXpToUser).toHaveBeenCalledWith('user-uuid-123', 7);

    expect(result.temperamentEffects).toEqual({
      temperament: 'Spirited',
      xpModifier: 0.1,
      scoreModifier: 0.05,
    });
  });

  // 3.8 — null temperament: no modifier, backward compatible (AC #4)
  test('null temperament: no modifier applied, temperamentEffects is null', async () => {
    const horse = makeHorse(null);
    setupEligibleMocks(horse);

    const result = await trainHorse(42, 'Racing');

    expect(result.success).toBe(true);

    // No modifier: XP = Math.max(1, 5) = 5
    expect(mockAddXpToUser).toHaveBeenCalledWith('user-uuid-123', 5);

    // Discipline score = 5 (no modifier)
    expect(mockIncrementDisciplineScore).toHaveBeenCalledWith(42, 'Racing', 5);

    // temperamentEffects is null when horse has no temperament
    expect(result.temperamentEffects).toBeNull();
  });

  // F5 — Reactive (xpModifier=0): zero-modifier guard skips XP branch,
  // temperamentEffects still returned non-null (AC #3, #4)
  test('Reactive horse: xpModifier=0 guard skips XP branch, temperamentEffects still returned', async () => {
    const horse = makeHorse('Reactive');
    setupEligibleMocks(horse);

    const result = await trainHorse(42, 'Racing');

    expect(result.success).toBe(true);

    // xpModifier=0: guard `if (temperamentMods.xpModifier !== 0)` skips, XP stays at 5
    expect(mockAddXpToUser).toHaveBeenCalledWith('user-uuid-123', 5);

    // scoreModifier=-0.05: Math.round(5 * 0.95) = Math.round(4.75) = 5 (rounding neutralizes at base=5)
    expect(mockIncrementDisciplineScore).toHaveBeenCalledWith(42, 'Racing', 5);

    // temperamentEffects is non-null even when xpModifier is 0
    expect(result.temperamentEffects).toEqual({
      temperament: 'Reactive',
      xpModifier: 0.0,
      scoreModifier: -0.05,
    });
  });

  // F6 — Stat gain branch + temperament interaction: both fire correctly when random < 0.15
  // Verifies stat gain and temperament modifier are independent and both applied
  test('Spirited horse triggers stat gain when Math.random < 0.15 and both paths succeed', async () => {
    const horse = makeHorse('Spirited');
    setupEligibleMocks(horse);

    // Mock Math.random to return 0.05 — below 0.15 stat gain threshold
    mathRandomSpy.mockReturnValue(0.05);

    const result = await trainHorse(42, 'Racing');

    expect(result.success).toBe(true);

    // Stat gain should have occurred (random 0.05 < 0.15 threshold)
    expect(result.statGain).not.toBeNull();
    expect(result.statGain.stat).toBeTruthy(); // one of the Racing stats
    expect(result.statGain.amount).toBeGreaterThanOrEqual(1);
    expect(result.statGain.amount).toBeLessThanOrEqual(10); // capped at 10

    // Spirited +5% score: Math.round(5 * 1.05) = Math.round(5.25) = 5
    expect(mockIncrementDisciplineScore).toHaveBeenCalledWith(42, 'Racing', 5);

    // Spirited +10% XP: Math.round(5 * 1.10) = Math.round(5.5) = 6
    expect(mockAddXpToUser).toHaveBeenCalledWith('user-uuid-123', 6);

    // temperamentEffects still reported
    expect(result.temperamentEffects).toEqual({
      temperament: 'Spirited',
      xpModifier: 0.1,
      scoreModifier: 0.05,
    });
  });
});
