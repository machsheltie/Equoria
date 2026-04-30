// Unit tests for conformation show scoring engine.
// Co-located per CONTRIBUTING.md convention (Epic 21-1):
//   backend/modules/competition/__tests__/conformationShowScoring.test.mjs
// Covers Story 31F-1 ACs: scoring formula (AC1), synergy table (AC2),
// entry validation (AC3), age class (AC4), handler mapping (AC5), and edge cases (AC6).
//
// Strategy: Pure scoring functions (no Prisma) are tested directly without mocks.
// Only validateConformationEntry requires Prisma mock (calls groomAssignment.findFirst).

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock Prisma (external DB) and logger — balanced mocking per project standards
// ---------------------------------------------------------------------------

jest.unstable_mockModule('../../../db/index.mjs', () => ({
  default: {
    groomAssignment: {
      findFirst: jest.fn(),
    },
  },
}));

jest.unstable_mockModule('../../../utils/logger.mjs', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import AFTER mocks are registered
const {
  calculateConformationScore,
  getHandlerScore,
  getConformationAgeClass,
  calculateSynergy,
  calculateConformationShowScore,
  validateConformationEntry,
  CONFORMATION_SHOW_CONFIG,
  SHOW_HANDLING_SKILL_SCORES,
  CONFORMATION_AGE_CLASSES,
} = await import('../../../services/conformationShowService.mjs');

const { default: prisma } = await import('../../../db/index.mjs');
const { CONFORMATION_CLASSES } = await import('../../../constants/schema.mjs');

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const FULL_CONFORMATION_SCORES = {
  head: 70,
  neck: 80,
  shoulders: 60,
  back: 75,
  hindquarters: 65,
  legs: 85,
  hooves: 70,
  topline: 75,
};

/** Arithmetic mean of FULL_CONFORMATION_SCORES = (70+80+60+75+65+85+70+75) / 8 = 580/8 = 72.5 → rounded = 73 */
const EXPECTED_CONFORMATION_MEAN = Math.round((70 + 80 + 60 + 75 + 65 + 85 + 70 + 75) / 8);

// ---------------------------------------------------------------------------
// Task 4.2: calculateConformationScore — arithmetic mean of 8 regions
// ---------------------------------------------------------------------------

describe('calculateConformationScore', () => {
  test('returns arithmetic mean of all 8 regions (integer)', () => {
    const score = calculateConformationScore(FULL_CONFORMATION_SCORES);
    expect(score).toBe(EXPECTED_CONFORMATION_MEAN);
    expect(Number.isInteger(score)).toBe(true);
  });

  test('returns 50 (neutral) when conformationScores is null', () => {
    const score = calculateConformationScore(null);
    expect(score).toBe(50);
  });

  test('returns 50 (neutral) when conformationScores is undefined', () => {
    const score = calculateConformationScore(undefined);
    expect(score).toBe(50);
  });

  test('returns 50 (neutral) when conformationScores is not an object', () => {
    expect(calculateConformationScore('invalid')).toBe(50);
    expect(calculateConformationScore(42)).toBe(50);
  });

  test('handles partial scores — treats missing regions as 0', () => {
    // Only one region provided; the rest default to 0
    const partial = { head: 80 };
    // calculateOverallConformation maps missing keys as ?? 0
    const score = calculateConformationScore(partial);
    // (80 + 0*7) / 8 = 10
    expect(score).toBe(10);
  });

  test('works when all regions are 0', () => {
    const zeros = { head: 0, neck: 0, shoulders: 0, back: 0, hindquarters: 0, legs: 0, hooves: 0, topline: 0 };
    expect(calculateConformationScore(zeros)).toBe(0);
  });

  test('works when all regions are 100', () => {
    const maxes = {
      head: 100,
      neck: 100,
      shoulders: 100,
      back: 100,
      hindquarters: 100,
      legs: 100,
      hooves: 100,
      topline: 100,
    };
    expect(calculateConformationScore(maxes)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Task 4.3: getHandlerScore — showHandlingSkill → 0-100 map
// ---------------------------------------------------------------------------

describe('getHandlerScore', () => {
  test('novice maps to 20', () => {
    expect(getHandlerScore('novice')).toBe(20);
  });

  test('competent maps to 40', () => {
    expect(getHandlerScore('competent')).toBe(40);
  });

  test('skilled maps to 60', () => {
    expect(getHandlerScore('skilled')).toBe(60);
  });

  test('expert maps to 80', () => {
    expect(getHandlerScore('expert')).toBe(80);
  });

  test('master maps to 100', () => {
    expect(getHandlerScore('master')).toBe(100);
  });

  test('unknown value defaults to novice (20)', () => {
    expect(getHandlerScore('legendary')).toBe(20);
    expect(getHandlerScore(null)).toBe(20);
    expect(getHandlerScore(undefined)).toBe(20);
    expect(getHandlerScore('')).toBe(20);
  });

  test('SHOW_HANDLING_SKILL_SCORES exported constant has all 5 skills', () => {
    expect(Object.keys(SHOW_HANDLING_SKILL_SCORES)).toEqual(
      expect.arrayContaining(['novice', 'competent', 'skilled', 'expert', 'master']),
    );
  });
});

// ---------------------------------------------------------------------------
// Task 4.4: getConformationAgeClass — all 5 bands + boundary values
// ---------------------------------------------------------------------------

describe('getConformationAgeClass', () => {
  test('age 0 → Weanling', () => {
    expect(getConformationAgeClass(0)).toBe(CONFORMATION_AGE_CLASSES.WEANLING);
  });

  test('age 0.5 → Weanling', () => {
    expect(getConformationAgeClass(0.5)).toBe(CONFORMATION_AGE_CLASSES.WEANLING);
  });

  test('age 1 → Yearling (boundary: exactly 1)', () => {
    expect(getConformationAgeClass(1)).toBe(CONFORMATION_AGE_CLASSES.YEARLING);
  });

  test('age 1.5 → Yearling', () => {
    expect(getConformationAgeClass(1.5)).toBe(CONFORMATION_AGE_CLASSES.YEARLING);
  });

  test('age 2 → Youngstock (boundary: exactly 2)', () => {
    expect(getConformationAgeClass(2)).toBe(CONFORMATION_AGE_CLASSES.YOUNGSTOCK);
  });

  test('age 2.9 → Youngstock', () => {
    expect(getConformationAgeClass(2.9)).toBe(CONFORMATION_AGE_CLASSES.YOUNGSTOCK);
  });

  test('age 3 → Junior (boundary: exactly 3)', () => {
    expect(getConformationAgeClass(3)).toBe(CONFORMATION_AGE_CLASSES.JUNIOR);
  });

  test('age 5 → Junior (upper boundary of Junior band)', () => {
    expect(getConformationAgeClass(5)).toBe(CONFORMATION_AGE_CLASSES.JUNIOR);
  });

  test('age 5.9 → Junior', () => {
    expect(getConformationAgeClass(5.9)).toBe(CONFORMATION_AGE_CLASSES.JUNIOR);
  });

  test('age 6 → Senior (boundary: exactly 6)', () => {
    expect(getConformationAgeClass(6)).toBe(CONFORMATION_AGE_CLASSES.SENIOR);
  });

  test('age 20 → Senior', () => {
    expect(getConformationAgeClass(20)).toBe(CONFORMATION_AGE_CLASSES.SENIOR);
  });

  test('CONFORMATION_AGE_CLASSES has 5 entries', () => {
    expect(Object.keys(CONFORMATION_AGE_CLASSES)).toHaveLength(5);
  });

  test('age -1 (negative) → Weanling (guarded, not SENIOR)', () => {
    expect(getConformationAgeClass(-1)).toBe(CONFORMATION_AGE_CLASSES.WEANLING);
  });

  test('NaN → Weanling (guarded, not SENIOR)', () => {
    expect(getConformationAgeClass(NaN)).toBe(CONFORMATION_AGE_CLASSES.WEANLING);
  });

  test('Infinity → Weanling (guarded, not SENIOR)', () => {
    expect(getConformationAgeClass(Infinity)).toBe(CONFORMATION_AGE_CLASSES.WEANLING);
  });
});

// ---------------------------------------------------------------------------
// calculateSynergy — PRD-03 §3.6 table values (AC2)
// ---------------------------------------------------------------------------

describe('calculateSynergy', () => {
  // Calm temperament
  // Synergy values are on a [0, 100] scale (normalized from PRD-03 §3.6 0.80–1.15 range).
  // Formula: Math.round((oldMultiplier * 100 - 80) / 35 * 100)

  test('calm + gentle → 86 (beneficial)', () => {
    expect(calculateSynergy('calm', 'gentle')).toBe(86);
  });

  test('calm + patient → 86 (beneficial)', () => {
    expect(calculateSynergy('calm', 'patient')).toBe(86);
  });

  test('calm + calm → 86 (beneficial)', () => {
    expect(calculateSynergy('calm', 'calm')).toBe(86);
  });

  test('calm + energetic → 23 (detrimental)', () => {
    expect(calculateSynergy('calm', 'energetic')).toBe(23);
  });

  test('calm + strict → 23 (detrimental)', () => {
    expect(calculateSynergy('calm', 'strict')).toBe(23);
  });

  // Title-case temperament (as stored in DB) should match lowercase table
  test('Calm (title-case from DB) + gentle → 86 (beneficial)', () => {
    expect(calculateSynergy('Calm', 'gentle')).toBe(86);
  });

  // Spirited temperament
  test('spirited + energetic → 91 (beneficial)', () => {
    expect(calculateSynergy('spirited', 'energetic')).toBe(91);
  });

  test('spirited + confident → 91 (beneficial)', () => {
    expect(calculateSynergy('spirited', 'confident')).toBe(91);
  });

  test('spirited + strict → 91 (beneficial)', () => {
    expect(calculateSynergy('spirited', 'strict')).toBe(91);
  });

  test('spirited + gentle → 23 (detrimental)', () => {
    expect(calculateSynergy('spirited', 'gentle')).toBe(23);
  });

  test('spirited + patient → 23 (detrimental)', () => {
    expect(calculateSynergy('spirited', 'patient')).toBe(23);
  });

  // Nervous temperament
  test('nervous + gentle → 100 (beneficial)', () => {
    expect(calculateSynergy('nervous', 'gentle')).toBe(100);
  });

  test('nervous + patient → 100 (beneficial)', () => {
    expect(calculateSynergy('nervous', 'patient')).toBe(100);
  });

  test('nervous + calm → 100 (beneficial)', () => {
    expect(calculateSynergy('nervous', 'calm')).toBe(100);
  });

  test('nervous + energetic → 14 (detrimental)', () => {
    expect(calculateSynergy('nervous', 'energetic')).toBe(14);
  });

  test('nervous + strict → 14 (detrimental)', () => {
    expect(calculateSynergy('nervous', 'strict')).toBe(14);
  });

  test('nervous + confident → 14 (detrimental)', () => {
    expect(calculateSynergy('nervous', 'confident')).toBe(14);
  });

  // Aggressive temperament
  test('aggressive + strict → 80 (beneficial)', () => {
    expect(calculateSynergy('aggressive', 'strict')).toBe(80);
  });

  test('aggressive + confident → 80 (beneficial)', () => {
    expect(calculateSynergy('aggressive', 'confident')).toBe(80);
  });

  test('aggressive + gentle → 34 (detrimental)', () => {
    expect(calculateSynergy('aggressive', 'gentle')).toBe(34);
  });

  test('aggressive + patient → 34 (detrimental)', () => {
    expect(calculateSynergy('aggressive', 'patient')).toBe(34);
  });

  // Neutral
  test('calm + unknown personality → 0 (neutral)', () => {
    expect(calculateSynergy('calm', 'mysterious')).toBe(0);
  });

  test('unknown temperament → 0 (neutral)', () => {
    expect(calculateSynergy('stoic', 'gentle')).toBe(0);
  });

  test('null/undefined temperament → 0 (neutral)', () => {
    expect(calculateSynergy(null, 'gentle')).toBe(0);
    expect(calculateSynergy(undefined, 'patient')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 4.5: calculateConformationShowScore — end-to-end with known inputs
// ---------------------------------------------------------------------------

describe('calculateConformationShowScore', () => {
  const horse = {
    id: 1,
    name: 'Stardust',
    conformationScores: FULL_CONFORMATION_SCORES, // mean = EXPECTED_CONFORMATION_MEAN = 73
    bondScore: 60,
    temperament: 'calm',
  };

  const groom = {
    id: 10,
    name: 'Alice',
    showHandlingSkill: 'expert', // → 80
    personality: 'gentle', // calm + gentle → 110
  };

  // Use the schema constant instead of a string literal — immune to schema renames
  const validClass = CONFORMATION_CLASSES.MARES;

  test('produces an integer finalScore in [0, 100]', () => {
    const result = calculateConformationShowScore(horse, groom, validClass);
    expect(Number.isInteger(result.finalScore)).toBe(true);
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);
  });

  test('finalScore matches expected arithmetic with known inputs', () => {
    /**
     * conformationScore = 73 (mean of FULL_CONFORMATION_SCORES)
     * handlerScore      = 80 (expert)
     * bondScore         = 60
     * synergyScore      = 86 (calm + gentle, normalized [0,100])
     *
     * rawScore = 73*0.65 + 80*0.20 + 60*0.08 + 86*0.07
     *          = 47.45   + 16.00   + 4.80    + 6.02
     *          = 74.27
     * finalScore = Math.round(74.27) = 74
     */
    const result = calculateConformationShowScore(horse, groom, validClass);
    expect(result.finalScore).toBe(74);
  });

  test('breakdown contains all expected fields', () => {
    const result = calculateConformationShowScore(horse, groom, validClass);
    expect(result.breakdown).toMatchObject({
      conformationScore: expect.any(Number),
      handlerScore: expect.any(Number),
      bondScore: expect.any(Number),
      synergyScore: expect.any(Number),
    });
  });

  test('zero bond score is correctly applied (not a multiplier)', () => {
    const horseNoBond = { ...horse, bondScore: 0 };
    const result = calculateConformationShowScore(horseNoBond, groom, validClass);
    /**
     * rawScore = 73*0.65 + 80*0.20 + 0*0.08 + 86*0.07
     *          = 47.45   + 16.00   + 0.00   + 6.02
     *          = 69.47 → 69
     */
    expect(result.finalScore).toBe(69);
    expect(result.breakdown.bondScore).toBe(0);
  });

  test('maximum possible score (all 100, master handler, nervous+gentle → 100)', () => {
    const perfectHorse = {
      id: 2,
      name: 'Perfect',
      conformationScores: {
        head: 100,
        neck: 100,
        shoulders: 100,
        back: 100,
        hindquarters: 100,
        legs: 100,
        hooves: 100,
        topline: 100,
      },
      bondScore: 100,
      temperament: 'nervous',
    };
    const perfectGroom = { id: 11, name: 'Bob', showHandlingSkill: 'master', personality: 'gentle' };
    /**
     * rawScore = 100*0.65 + 100*0.20 + 100*0.08 + 100*0.07
     *          = 65 + 20 + 8 + 7 = 100
     */
    const result = calculateConformationShowScore(perfectHorse, perfectGroom, validClass);
    expect(result.finalScore).toBe(100);
  });

  test('null conformationScores defaults gracefully (returns 50 neutral)', () => {
    const horseNoScores = { ...horse, conformationScores: null };
    const result = calculateConformationShowScore(horseNoScores, groom, validClass);
    // conformationScore = 50, handler = 80, bond = 60, synergy = 86 (calm+gentle)
    // 50*0.65 + 80*0.20 + 60*0.08 + 86*0.07 = 32.5+16+4.8+6.02 = 59.32 → 59
    expect(result.finalScore).toBe(59);
  });

  test('returns finalScore 0 with error field for invalid class name', () => {
    const result = calculateConformationShowScore(horse, groom, 'InvalidClass');
    expect(result.finalScore).toBe(0);
    expect(result.error).toMatch(/not a valid conformation show class/i);
  });

  test('returns finalScore 0 with error field for null horse', () => {
    const result = calculateConformationShowScore(null, groom, validClass);
    expect(result.finalScore).toBe(0);
    expect(typeof result.error).toBe('string');
  });

  test('returns finalScore 0 with error field for null groom', () => {
    const result = calculateConformationShowScore(horse, null, validClass);
    expect(result.finalScore).toBe(0);
    expect(typeof result.error).toBe('string');
  });

  test('success path has no error field', () => {
    const result = calculateConformationShowScore(horse, groom, validClass);
    expect(result.error).toBeUndefined();
  });

  test('no random factor — same inputs always produce same score', () => {
    const r1 = calculateConformationShowScore(horse, groom, validClass);
    const r2 = calculateConformationShowScore(horse, groom, validClass);
    const r3 = calculateConformationShowScore(horse, groom, validClass);
    expect(r1.finalScore).toBe(r2.finalScore);
    expect(r2.finalScore).toBe(r3.finalScore);
  });
});

// ---------------------------------------------------------------------------
// Task 4.6: validateConformationEntry — missing groom, bad health, age < 1
// ---------------------------------------------------------------------------

describe('validateConformationEntry', () => {
  const userId = 'user-1';

  const horse = {
    id: 100,
    name: 'ValidHorse',
    userId,
    age: 3,
    health: 'Excellent',
    conformationScores: FULL_CONFORMATION_SCORES,
    bondScore: 50,
    temperament: 'calm',
  };

  const groom = {
    id: 200,
    name: 'ValidGroom',
    userId,
    showHandlingSkill: 'skilled',
    personality: 'gentle',
  };

  const validClass = CONFORMATION_CLASSES.MARES;

  const mockAssignment = {
    id: 999,
    groomId: 200,
    foalId: 100,
    userId,
    isActive: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.groomAssignment.findFirst.mockResolvedValue(mockAssignment);
  });

  test('passes when all requirements are met', async () => {
    const result = await validateConformationEntry(horse, groom, validClass, userId);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('assigns correct age class for valid horse', async () => {
    const result = await validateConformationEntry(horse, groom, validClass, userId);
    // horse.age = 3 → Junior
    expect(result.ageClass).toBe(CONFORMATION_AGE_CLASSES.JUNIOR);
  });

  test('rejects when groom is not assigned to horse', async () => {
    prisma.groomAssignment.findFirst.mockResolvedValue(null);
    const result = await validateConformationEntry(horse, groom, validClass, userId);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Groom must be assigned to this horse before entering conformation shows');
  });

  test('rejects when groom assigned too recently (< 2 days)', async () => {
    const recentAssignment = { ...mockAssignment, createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000) }; // 1 hour ago
    prisma.groomAssignment.findFirst.mockResolvedValue(recentAssignment);
    const result = await validateConformationEntry(horse, groom, validClass, userId);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('at least'))).toBe(true);
  });

  test('rejects when horse health is not Excellent or Good', async () => {
    const sickHorse = { ...horse, health: 'Poor' };
    const result = await validateConformationEntry(sickHorse, groom, validClass, userId);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('health'))).toBe(true);
  });

  test('rejects "Injured" health', async () => {
    const injuredHorse = { ...horse, health: 'Injured' };
    const result = await validateConformationEntry(injuredHorse, groom, validClass, userId);
    expect(result.valid).toBe(false);
  });

  test('rejects "Fair" health', async () => {
    const fairHorse = { ...horse, health: 'Fair' };
    const result = await validateConformationEntry(fairHorse, groom, validClass, userId);
    expect(result.valid).toBe(false);
  });

  test('accepts horse with age 0 (Weanling)', async () => {
    const weanling = { ...horse, age: 0, health: 'Excellent' };
    const result = await validateConformationEntry(weanling, groom, validClass, userId);
    expect(result.valid).toBe(true);
    expect(result.ageClass).toBe(CONFORMATION_AGE_CLASSES.WEANLING);
  });

  test('rejects horse with age < 0 (invalid age)', async () => {
    const negativeAge = { ...horse, age: -1 };
    const result = await validateConformationEntry(negativeAge, groom, validClass, userId);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('age'))).toBe(true);
  });

  test('rejects when horse is not owned by userId', async () => {
    const notMyHorse = { ...horse, userId: 'other-user' };
    const result = await validateConformationEntry(notMyHorse, groom, validClass, userId);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('You do not own this horse');
  });

  test('rejects when groom is not owned by userId', async () => {
    const notMyGroom = { ...groom, userId: 'other-user' };
    const result = await validateConformationEntry(horse, notMyGroom, validClass, userId);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('You do not own this groom');
  });

  test('rejects invalid conformation class', async () => {
    const result = await validateConformationEntry(horse, groom, 'Dressage', userId);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not a valid conformation show class'))).toBe(true);
  });

  test('includes warning for missing conformationScores but does not reject', async () => {
    const horseNoScores = { ...horse, conformationScores: null };
    const result = await validateConformationEntry(horseNoScores, groom, validClass, userId);
    // Should NOT fail validation — only a warning
    expect(result.warnings.some(w => w.toLowerCase().includes('conformation scores'))).toBe(true);
  });

  test('returns assignment on success', async () => {
    const result = await validateConformationEntry(horse, groom, validClass, userId);
    expect(result.assignment).toEqual(mockAssignment);
  });
});

// ---------------------------------------------------------------------------
// CONFORMATION_SHOW_CONFIG — structural checks
// ---------------------------------------------------------------------------

describe('CONFORMATION_SHOW_CONFIG', () => {
  test('weights sum to 1.00', () => {
    const total =
      CONFORMATION_SHOW_CONFIG.CONFORMATION_WEIGHT +
      CONFORMATION_SHOW_CONFIG.HANDLER_WEIGHT +
      CONFORMATION_SHOW_CONFIG.BOND_WEIGHT +
      CONFORMATION_SHOW_CONFIG.TEMPERAMENT_WEIGHT;
    expect(total).toBeCloseTo(1.0, 10);
  });

  test('CONFORMATION_WEIGHT is 0.65', () => {
    expect(CONFORMATION_SHOW_CONFIG.CONFORMATION_WEIGHT).toBe(0.65);
  });

  test('HANDLER_WEIGHT is 0.20', () => {
    expect(CONFORMATION_SHOW_CONFIG.HANDLER_WEIGHT).toBe(0.2);
  });

  test('BOND_WEIGHT is 0.08', () => {
    expect(CONFORMATION_SHOW_CONFIG.BOND_WEIGHT).toBe(0.08);
  });

  test('TEMPERAMENT_WEIGHT is 0.07', () => {
    expect(CONFORMATION_SHOW_CONFIG.TEMPERAMENT_WEIGHT).toBe(0.07);
  });

  test('MIN_AGE is 0 (Weanlings allowed)', () => {
    expect(CONFORMATION_SHOW_CONFIG.MIN_AGE).toBe(0);
  });

  test('config is frozen — cannot be mutated at runtime', () => {
    expect(Object.isFrozen(CONFORMATION_SHOW_CONFIG)).toBe(true);
  });
});
