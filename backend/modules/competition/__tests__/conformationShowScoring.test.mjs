// Unit tests for conformation show scoring engine.
// Co-located per CONTRIBUTING.md convention (Epic 21-1):
//   backend/modules/competition/__tests__/conformationShowScoring.test.mjs
// Covers Story 31F-1 ACs: scoring formula (AC1), synergy table (AC2),
// entry validation (AC3), age class (AC4), handler mapping (AC5), and edge cases (AC6).
//
// Strategy: Pure scoring functions (no Prisma) are tested directly without mocks.
// Only validateConformationEntry requires Prisma mock (calls groomAssignment.findFirst).

// NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted from
// jest.unstable_mockModule of db + logger to a real-DB integration test.
// All scoring/age-class/synergy functions are pure (no DB) and tested without
// any mocks. validateConformationEntry queries prisma.groomAssignment.findFirst
// internally — that section creates real users + horses + grooms + assignments.

import { afterAll, beforeAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import {
  calculateConformationScore,
  getHandlerScore,
  getConformationAgeClass,
  calculateSynergy,
  calculateConformationShowScore,
  validateConformationEntry,
  CONFORMATION_SHOW_CONFIG,
  SHOW_HANDLING_SKILL_SCORES,
  CONFORMATION_AGE_CLASSES,
} from '../../../services/conformationShowService.mjs';
import { CONFORMATION_CLASSES } from '../../../constants/schema.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const SUITE_PREFIX = 'cfsco';

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

  // SENTINEL: error paths must throw — distinguishable from a legitimate zero score (Equoria-vc7v).
  // A horse that genuinely scored 0 returns { finalScore: 0 } with no error property.
  // A programming error (null inputs, invalid class) must throw, not silently return 0.
  test('throws for invalid class — error is distinguishable from a legitimate zero score', () => {
    expect(() => calculateConformationShowScore(horse, groom, 'InvalidClass')).toThrow(
      /not a valid conformation show class/i,
    );
  });

  test('throws for null horse — error is distinguishable from a legitimate zero score', () => {
    expect(() => calculateConformationShowScore(null, groom, validClass)).toThrow(/horse and groom are required/i);
  });

  test('throws for null groom — error is distinguishable from a legitimate zero score', () => {
    expect(() => calculateConformationShowScore(horse, null, validClass)).toThrow(/horse and groom are required/i);
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

describe('validateConformationEntry (real DB)', () => {
  // Suite-scoped fixtures: a real user + real horse + real groom + real
  // active assignment that's older than the 2-day timing requirement.
  // Each test uses these as the baseline; tests that need a different
  // shape mutate POJO copies (the function reads from POJOs but queries
  // assignment via prisma).
  let user;
  let horse; // POJO matching horse.id in DB
  let groom; // POJO matching groom.id in DB
  let validClass;

  beforeAll(async () => {
    await cleanupValidationFixtures();
    const uid = randomBytes(8).toString('hex');
    user = await prisma.user.create({
      data: {
        id: `${SUITE_PREFIX}-${uid}`,
        username: `${SUITE_PREFIX}_${uid}`,
        email: `${SUITE_PREFIX}-${uid}@example.com`,
        firstName: 'Cfsco',
        lastName: 'Test',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
        emailVerified: true,
      },
    });

    const dbHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'ValidHorse',
        sex: 'Mare',
        dateOfBirth: new Date('2022-01-01'),
        age: 3,
        healthStatus: 'Excellent',
        bondScore: 50,
        temperament: 'calm',
        conformationScores: FULL_CONFORMATION_SCORES,
        user: { connect: { id: user.id } },
      },
    });
    const dbGroom = await prisma.groom.create({
      data: {
        name: 'ValidGroom',
        speciality: 'show_handling',
        personality: 'gentle',
        skillLevel: 'expert',
        user: { connect: { id: user.id } },
      },
    });

    // Real groom assignment older than the 2-day timing requirement.
    await prisma.groomAssignment.create({
      data: {
        groom: { connect: { id: dbGroom.id } },
        foal: { connect: { id: dbHorse.id } },
        user: { connect: { id: user.id } },
        isActive: true,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    });

    // POJOs that the validation function consumes directly. IDs match
    // the real DB rows so the internal groomAssignment.findFirst query
    // resolves correctly.
    horse = {
      id: dbHorse.id,
      name: 'ValidHorse',
      userId: user.id,
      age: 3,
      health: 'Excellent',
      conformationScores: FULL_CONFORMATION_SCORES,
      bondScore: 50,
      temperament: 'calm',
    };
    groom = {
      id: dbGroom.id,
      name: 'ValidGroom',
      userId: user.id,
      showHandlingSkill: 'skilled',
      personality: 'gentle',
    };
    validClass = CONFORMATION_CLASSES.MARES;
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  afterAll(cleanupValidationFixtures, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  test('passes when all requirements are met', async () => {
    const result = await validateConformationEntry(horse, groom, validClass, user.id);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('assigns correct age class for valid horse', async () => {
    const result = await validateConformationEntry(horse, groom, validClass, user.id);
    expect(result.ageClass).toBe(CONFORMATION_AGE_CLASSES.JUNIOR);
  });

  test('rejects when groom is not assigned to horse', async () => {
    // Use POJO IDs that don't match any real assignment.
    const otherHorse = { ...horse, id: 999999998 };
    const otherGroom = { ...groom, id: 999999999 };
    const result = await validateConformationEntry(otherHorse, otherGroom, validClass, user.id);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Groom must be assigned to this horse before entering conformation shows');
  });

  test('rejects when groom assigned too recently (< 2 days)', async () => {
    // Create a fresh user/horse/groom with a recent assignment.
    const u = await prisma.user.create({
      data: {
        id: `${SUITE_PREFIX}-recent-${randomBytes(8).toString('hex')}`,
        username: `${SUITE_PREFIX}_recent_${randomBytes(4).toString('hex')}`,
        email: `${SUITE_PREFIX}-recent-${randomBytes(4).toString('hex')}@example.com`,
        firstName: 'Recent',
        lastName: 'Test',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
        emailVerified: true,
      },
    });
    const h = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'RecentHorse',
        sex: 'Mare',
        dateOfBirth: new Date('2022-01-01'),
        age: 3,
        healthStatus: 'Excellent',
        bondScore: 50,
        temperament: 'calm',
        user: { connect: { id: u.id } },
      },
    });
    const g = await prisma.groom.create({
      data: {
        name: 'RecentGroom',
        speciality: 'show_handling',
        personality: 'gentle',
        skillLevel: 'expert',
        user: { connect: { id: u.id } },
      },
    });
    await prisma.groomAssignment.create({
      data: {
        groom: { connect: { id: g.id } },
        foal: { connect: { id: h.id } },
        user: { connect: { id: u.id } },
        isActive: true,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      },
    });

    const result = await validateConformationEntry(
      {
        id: h.id,
        name: 'RecentHorse',
        userId: u.id,
        age: 3,
        health: 'Excellent',
        conformationScores: FULL_CONFORMATION_SCORES,
        bondScore: 50,
        temperament: 'calm',
      },
      { id: g.id, name: 'RecentGroom', userId: u.id, showHandlingSkill: 'skilled', personality: 'gentle' },
      validClass,
      u.id,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('at least'))).toBe(true);
  });

  test('rejects when horse health is not Excellent or Good', async () => {
    const sickHorse = { ...horse, health: 'Poor' };
    const result = await validateConformationEntry(sickHorse, groom, validClass, user.id);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('health'))).toBe(true);
  });

  test('rejects "Injured" health', async () => {
    const injuredHorse = { ...horse, health: 'Injured' };
    const result = await validateConformationEntry(injuredHorse, groom, validClass, user.id);
    expect(result.valid).toBe(false);
  });

  test('rejects "Fair" health', async () => {
    const fairHorse = { ...horse, health: 'Fair' };
    const result = await validateConformationEntry(fairHorse, groom, validClass, user.id);
    expect(result.valid).toBe(false);
  });

  test('accepts horse with age 0 (Weanling)', async () => {
    const weanling = { ...horse, age: 0, health: 'Excellent' };
    const result = await validateConformationEntry(weanling, groom, validClass, user.id);
    expect(result.valid).toBe(true);
    expect(result.ageClass).toBe(CONFORMATION_AGE_CLASSES.WEANLING);
  });

  test('rejects horse with age < 0 (invalid age)', async () => {
    const negativeAge = { ...horse, age: -1 };
    const result = await validateConformationEntry(negativeAge, groom, validClass, user.id);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('age'))).toBe(true);
  });

  // CWE-639 (Equoria-fspi): The 'You do not own this horse'/'You do not own
  // this groom' branches were removed from validateConformationEntry as
  // dead-code — ownership is enforced upstream by the controller via
  // findOwnedResource('horse'/'groom') before this service is called. Cross-
  // user enumeration is prevented at the route by returning 404, not 403,
  // for cross-user resources. The service no longer asserts ownership; it
  // trusts the caller to pass owned entities. These tests now document the
  // new architecture: when a service caller manually passes a foreign-owner
  // entity, no ownership error fires (because the rest of the validation
  // can still surface other failures, the test asserts the absence of the
  // ownership branch, not its presence).
  test('does not assert ownership — enforced upstream by controller (CWE-639 architecture)', async () => {
    const notMyHorse = { ...horse, userId: 'other-user' };
    const result = await validateConformationEntry(notMyHorse, groom, validClass, user.id);
    expect(result.errors).not.toContain('You do not own this horse');
    expect(result.errors).not.toContain('You do not own this groom');
  });

  test('does not assert groom ownership — enforced upstream (CWE-639 architecture)', async () => {
    const notMyGroom = { ...groom, userId: 'other-user' };
    const result = await validateConformationEntry(horse, notMyGroom, validClass, user.id);
    expect(result.errors).not.toContain('You do not own this groom');
    expect(result.errors).not.toContain('You do not own this horse');
  });

  test('rejects invalid conformation class', async () => {
    const result = await validateConformationEntry(horse, groom, 'Dressage', user.id);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not a valid conformation show class'))).toBe(true);
  });

  test('includes warning for missing conformationScores but does not reject', async () => {
    const horseNoScores = { ...horse, conformationScores: null };
    const result = await validateConformationEntry(horseNoScores, groom, validClass, user.id);
    expect(result.warnings.some(w => w.toLowerCase().includes('conformation scores'))).toBe(true);
  });

  test('returns assignment on success', async () => {
    const result = await validateConformationEntry(horse, groom, validClass, user.id);
    expect(result.assignment).toBeDefined();
    expect(result.assignment.groomId).toBe(groom.id);
    expect(result.assignment.foalId).toBe(horse.id);
  });
});

async function cleanupValidationFixtures() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  const grooms = await prisma.groom.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const groomIds = grooms.map(g => g.id);
  if (groomIds.length > 0) {
    await prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } });
  }
  await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.groom.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

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
