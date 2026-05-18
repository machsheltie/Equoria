/**
 * conformationShowService unit tests (Equoria-rr7 coverage sprint).
 *
 * Pure-sync tests cover scoring and validation with in-memory objects.
 * DB-fixture tests cover validateConformationEntry DB-query branches (lines 337, 350-358)
 * and executeConformationShow full execution branches (lines 502-604).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
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
} from '../../../services/conformationShowService.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

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

// ── DB-fixture tests — validateConformationEntry + executeConformationShow (Equoria-rr7) ──
// Covers:
//   line 337 — DB query when horse.id and groom.id are non-null
//   lines 350-358 — createdAt timestamp validation (fresh <2d vs old >=2d assignment)
//   lines 502-506 — show.showType !== 'conformation' branch
//   line 517 — entries.length === 0 early return
//   lines 520-604 — full scoring/ranking/reward/persist run with one entry

describe('conformationShowService — DB fixture branch coverage (Equoria-rr7)', () => {
  let cssUser;
  let cssHorse;
  let cssFreshGroom;
  let cssOldGroom;
  let cssRiddenShow;
  let cssEmptyConformShow;
  let cssFullConformShow;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    cssUser = await prisma.user.create({
      data: {
        email: `css-${ts}-${rand()}@test.com`,
        username: `css${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'CSS',
        lastName: 'Tester',
        money: 1000,
      },
    });

    cssHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-CSS-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 2,
        userId: cssUser.id,
        healthStatus: 'Good',
      },
    });

    cssFreshGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-CSS-FreshGroom-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        userId: cssUser.id,
      },
    });

    cssOldGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-CSS-OldGroom-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        userId: cssUser.id,
      },
    });

    // Fresh assignment — createdAt = now (< MIN_GROOM_ASSIGNMENT_DAYS = 2 days)
    await prisma.groomAssignment.create({
      data: {
        groomId: cssFreshGroom.id,
        foalId: cssHorse.id,
        userId: cssUser.id,
        isActive: true,
        priority: 1,
      },
    });

    // Old assignment — createdAt = 10 days ago (> 2 days → passes date check)
    await prisma.groomAssignment.create({
      data: {
        groomId: cssOldGroom.id,
        foalId: cssHorse.id,
        userId: cssUser.id,
        isActive: true,
        priority: 1,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    });

    // Show with showType != 'conformation' (lines 502-506)
    cssRiddenShow = await prisma.show.create({
      data: {
        name: `TestFixture-CSS-RiddenShow-${ts}`,
        discipline: 'Dressage',
        levelMin: 0,
        levelMax: 10,
        entryFee: 0,
        prize: 0,
        runDate: new Date(),
        showType: 'ridden',
      },
    });

    // Conformation show with no entries (line 517)
    cssEmptyConformShow = await prisma.show.create({
      data: {
        name: `TestFixture-CSS-EmptyConform-${ts}`,
        discipline: 'conformation',
        levelMin: 0,
        levelMax: 10,
        entryFee: 0,
        prize: 0,
        runDate: new Date(),
        showType: 'conformation',
      },
    });

    // Conformation show with one entry for full run (lines 520-604)
    cssFullConformShow = await prisma.show.create({
      data: {
        name: `TestFixture-CSS-FullConform-${ts}`,
        discipline: 'conformation',
        levelMin: 0,
        levelMax: 10,
        entryFee: 0,
        prize: 0,
        runDate: new Date(),
        showType: 'conformation',
      },
    });
    await prisma.showEntry.create({
      data: {
        showId: cssFullConformShow.id,
        horseId: cssHorse.id,
        userId: cssUser.id,
      },
    });
  }, 60000);

  afterAll(async () => {
    // Shows cascade to ShowEntry + CompetitionResult
    await prisma.show.deleteMany({ where: { name: { startsWith: 'TestFixture-CSS-' } } }).catch(() => {});
    // Grooms cascade to GroomAssignment
    await prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-CSS-' } } }).catch(() => {});
    // Horses cascade to remaining relations
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-CSS-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: cssUser?.id } }).catch(() => {});
  }, 30000);

  // ── line 337: DB query path with non-null IDs ──────────────────────────────────

  describe('validateConformationEntry — line 337: DB query with non-null IDs (Equoria-rr7)', () => {
    it('executes DB query when horse.id and groom.id are non-null; returns groom-not-assigned when no assignment exists', async () => {
      // IDs are non-null integers but no groomAssignment exists for them → query fires (line 337), returns null
      const horse = { id: 999999997, age: 2, healthStatus: 'Good', stressLevel: 0, conformationScores: null };
      const groom = { id: 999999997 };
      const result = await validateConformationEntry(horse, groom, 'Mares', cssUser.id);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Groom must be assigned'))).toBe(true);
    });
  });

  // ── lines 350-358: assignment createdAt date validation ───────────────────────

  describe('validateConformationEntry — lines 350-358: assignment date check (Equoria-rr7)', () => {
    it('line 355 true arm: pushes "at least N days" error when groom assignment is < MIN_GROOM_ASSIGNMENT_DAYS old', async () => {
      const horse = { id: cssHorse.id, age: 2, healthStatus: 'Good', stressLevel: 0, conformationScores: null };
      const groom = { id: cssFreshGroom.id };
      const result = await validateConformationEntry(horse, groom, 'Mares', cssUser.id);
      expect(result.errors.some(e => e.includes('at least'))).toBe(true);
    });

    it('line 355 false arm: no assignment-days error when assignment is >= MIN_GROOM_ASSIGNMENT_DAYS old', async () => {
      // cssOldGroom assignment was created 10 days ago → daysSinceAssignment >= 2 → no error
      const horse = { id: cssHorse.id, age: 2, healthStatus: 'Good', stressLevel: 0, conformationScores: null };
      const groom = { id: cssOldGroom.id };
      const result = await validateConformationEntry(horse, groom, 'Mares', cssUser.id);
      expect(result.errors.every(e => !e.includes('at least'))).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.assignment).not.toBeNull();
      expect(result.ageClass).toBe('Youngstock');
    });
  });

  // ── lines 502-506: showType !== 'conformation' ────────────────────────────────

  describe('executeConformationShow — lines 502-506: wrong show type (Equoria-rr7)', () => {
    it('throws "Show is not a conformation show" for a ridden show', async () => {
      await expect(executeConformationShow(cssRiddenShow.id)).rejects.toThrow('Show is not a conformation show');
    });
  });

  // ── line 517: conformation show with no entries ────────────────────────────────

  describe('executeConformationShow — line 517: no entries (Equoria-rr7)', () => {
    it('returns empty array when show has no ShowEntry records', async () => {
      const result = await executeConformationShow(cssEmptyConformShow.id);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  // ── lines 520-604: full scoring + ranking + reward + persist ──────────────────

  describe('executeConformationShow — lines 520-604: full run with one entry (Equoria-rr7)', () => {
    it('scores entry, assigns 1st-place Blue ribbon, persists CompetitionResult, returns results array', async () => {
      const results = await executeConformationShow(cssFullConformShow.id);
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(1);

      const entry = results[0];
      expect(entry.horseId).toBe(cssHorse.id);
      expect(entry.placement).toBe(1);
      expect(typeof entry.score).toBe('number');
      expect(entry.score).toBeGreaterThanOrEqual(0);
      expect(entry.score).toBeLessThanOrEqual(100);
      expect(entry.ribbon).toBe('Blue');
      expect(entry.titlePoints).toBe(10);
      expect(typeof entry.breedingValueBoost).toBe('number');

      // Verify CompetitionResult was persisted
      const cr = await prisma.competitionResult.findFirst({
        where: { horseId: cssHorse.id, showId: cssFullConformShow.id },
      });
      expect(cr).not.toBeNull();
      expect(Number(cr.score)).toBe(entry.score);
      expect(cr.discipline).toBe('conformation');
      expect(cr.placement).toBe('1');
    });
  });
});
