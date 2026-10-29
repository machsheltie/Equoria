/**
 * groomSystem — pure-function branch-coverage tests (Equoria-jkht)
 *
 * Targets hasAlreadyCompletedFoalTaskToday — a pure predicate with multiple
 * guard conditions and a catch path. No DB calls. No mocks.
 *
 * Branch map (15 branches):
 *   Guard 1: !foal || !today || typeof today !== 'string' || today.trim() === ''
 *   Guard 2: !foal.dailyTaskRecord || typeof foal.dailyTaskRecord !== 'object'
 *   Guard 3: !todayLog || !Array.isArray(todayLog) || todayLog.length === 0
 *   some():  enrichment task found / grooming task found / nothing found
 *   catch:   getter throws
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  hasAlreadyCompletedFoalTaskToday,
  assignGroomToFoal,
  GROOM_SPECIALTIES,
  SKILL_LEVELS,
  PERSONALITY_TRAITS,
} from '../../../utils/groomSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

import { ELIGIBLE_FOAL_ENRICHMENT_TASKS, FOAL_GROOMING_TASKS } from '../../../config/groomConfig.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup — a cleanup delete that fails must
// turn the suite red so the leaked fixture is fixed at the source, not hidden
// behind a silent no-op catch arm (which leaks rows into the canonical DB).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const TODAY = '2026-05-12';

describe('hasAlreadyCompletedFoalTaskToday()', () => {
  // ── Guard 1: invalid first-arg or date string ────────────────────────────

  it('returns false when foal is null', () => {
    expect(hasAlreadyCompletedFoalTaskToday(null, TODAY)).toBe(false);
  });

  it('returns false when today is null', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ dailyTaskRecord: {} }, null)).toBe(false);
  });

  it('returns false when today is not a string (number)', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ dailyTaskRecord: {} }, 20260512)).toBe(false);
  });

  it('returns false when today is a blank/whitespace string', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ dailyTaskRecord: {} }, '   ')).toBe(false);
  });

  // ── Guard 2: missing or non-object dailyTaskRecord ───────────────────────

  it('returns false when foal has no dailyTaskRecord property', () => {
    expect(hasAlreadyCompletedFoalTaskToday({}, TODAY)).toBe(false);
  });

  it('returns false when dailyTaskRecord is null (!record is true)', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ dailyTaskRecord: null }, TODAY)).toBe(false);
  });

  it('returns false when dailyTaskRecord is a string (typeof !== object)', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ dailyTaskRecord: 'invalid' }, TODAY)).toBe(false);
  });

  // ── Guard 3: no tasks recorded for today ────────────────────────────────

  it('returns false when no entry for today in dailyTaskRecord (!todayLog)', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ dailyTaskRecord: {} }, TODAY)).toBe(false);
  });

  it('returns false when todayLog is not an array (!Array.isArray)', () => {
    const foal = { dailyTaskRecord: { [TODAY]: 'brushing' } };
    expect(hasAlreadyCompletedFoalTaskToday(foal, TODAY)).toBe(false);
  });

  it('returns false when todayLog is an empty array (length === 0)', () => {
    const foal = { dailyTaskRecord: { [TODAY]: [] } };
    expect(hasAlreadyCompletedFoalTaskToday(foal, TODAY)).toBe(false);
  });

  // ── some() — no foal-specific task in log ───────────────────────────────

  it('returns false when tasks today are none of the foal-specific lists', () => {
    const foal = { dailyTaskRecord: { [TODAY]: ['brushing', 'stallCare', 'handWalking'] } };
    expect(hasAlreadyCompletedFoalTaskToday(foal, TODAY)).toBe(false);
  });

  // ── some() — enrichment task present ────────────────────────────────────

  it('returns true when todayLog contains an ELIGIBLE_FOAL_ENRICHMENT_TASKS entry', () => {
    const foal = { dailyTaskRecord: { [TODAY]: [ELIGIBLE_FOAL_ENRICHMENT_TASKS[0]] } };
    expect(hasAlreadyCompletedFoalTaskToday(foal, TODAY)).toBe(true);
  });

  it('returns true when todayLog mixes non-foal and enrichment tasks', () => {
    const foal = { dailyTaskRecord: { [TODAY]: ['brushing', ELIGIBLE_FOAL_ENRICHMENT_TASKS[1]] } };
    expect(hasAlreadyCompletedFoalTaskToday(foal, TODAY)).toBe(true);
  });

  // ── some() — grooming task present ──────────────────────────────────────

  it('returns true when todayLog contains a FOAL_GROOMING_TASKS entry', () => {
    const foal = { dailyTaskRecord: { [TODAY]: [FOAL_GROOMING_TASKS[0]] } };
    expect(hasAlreadyCompletedFoalTaskToday(foal, TODAY)).toBe(true);
  });

  // ── catch path ───────────────────────────────────────────────────────────

  it('returns false (fail-safe) when accessing dailyTaskRecord throws', () => {
    const evil = {
      get dailyTaskRecord() {
        throw new Error('getter bomb');
      },
    };
    expect(hasAlreadyCompletedFoalTaskToday(evil, TODAY)).toBe(false);
  });
});

// ── assignGroomToFoal — foal-not-found path (lines 177-191) ──────────────────

describe('assignGroomToFoal() — foal not found', () => {
  it('rejects with "Foal with ID -1 not found" for a non-existent foal', async () => {
    let thrown = false;
    try {
      await assignGroomToFoal(-1, -1, 'any-user');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});

// ── assignGroomToFoal — groom-not-found path (lines 194-209) ─────────────────
//
// Foal exists, but groomId=-1 does not exist → lines 194-208 (groom lookup) +
// line 209 (throw "Groom with ID -1 not found") are covered.

let groomNotFoundUser;
let groomNotFoundHorse;
// Equoria-1ohys: fail-loud scoped cleanup. FK order: horse (Horse.userId
// Restrict) deleted before its owning user. Both scoped to the ids this suite
// created.
const groomNotFoundCleanup = createCleanupTracker();

beforeAll(async () => {
  // Register scoped, FK-ordered cleanup (horse before user — Horse.userId Restrict).
  groomNotFoundCleanup.add(() => prisma.horse.delete({ where: { id: groomNotFoundHorse.id } }), 'groomNotFound horse');
  groomNotFoundCleanup.add(() => prisma.user.delete({ where: { id: groomNotFoundUser.id } }), 'groomNotFound user');

  groomNotFoundUser = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `groomsys-gnf-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `groomsysgnf${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'GroomSys',
      lastName: 'GNFTester',
      money: 1000,
    },
  });
  groomNotFoundHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-GroomSysGNFHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: groomNotFoundUser.id,
    },
  });
}, 30000);

afterAll(() => groomNotFoundCleanup.run(), 30000);

describe('assignGroomToFoal() — groom not found (foal exists, groom=-1)', () => {
  it('rejects when foal exists but groomId=-1 does not (covers groom lookup lines 194-209)', async () => {
    let thrown = false;
    try {
      await assignGroomToFoal(groomNotFoundHorse.id, -1, groomNotFoundUser.id);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});

// ── assignGroomToFoal success path ────────
//
// Fixture set for the assignGroomToFoal success path. Owner ruling 2026-10-28
// (q153): no foal is given a default groom, so ensureDefaultGroomAssignment and
// getOrCreateDefaultGroom were deleted with the tests that specified them.

let successUser;
let groomForSuccessAssign;
let foalForSuccessAssign;
// Equoria-1ohys: fail-loud scoped cleanup. FK order: groom* children
// (groomInteraction, groomAssignment — Cascade on Groom*) deleted first, then
// the horses/groom (Horse.userId + Groom.userId Restrict), then the owning user
// last. All deletes scoped to ids/foalIds this suite created.
const successCleanup = createCleanupTracker();

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  // Register scoped, FK-ordered cleanup: groom* children first (cascade-owned
  // by groom/foal), then horses + groom (Restrict on Horse.userId/Groom.userId),
  // then the owning user last.
  successCleanup.add(
    () =>
      prisma.groomAssignment.deleteMany({
        where: { foalId: { in: [foalForSuccessAssign.id] } },
      }),
    'success groomAssignments',
  );
  successCleanup.add(
    () => prisma.horse.delete({ where: { id: foalForSuccessAssign.id } }),
    'success foalForSuccessAssign',
  );
  successCleanup.add(() => prisma.groom.delete({ where: { id: groomForSuccessAssign.id } }), 'success groom');
  successCleanup.add(() => prisma.user.delete({ where: { id: successUser.id } }), 'success user');

  successUser = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `groomsys-succ-${ts}-${rand()}@test.com`,
      username: `groomsyssucc${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'GroomSys',
      lastName: 'SuccTester',
      money: 1000,
    },
  });

  groomForSuccessAssign = await prisma.groom.create({
    data: {
      name: `TestFixture-SuccessAssignGroom-${ts}`,
      speciality: 'foalCare',
      personality: 'gentle',
      userId: successUser.id,
      isActive: true,
    },
  });

  foalForSuccessAssign = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-SuccessAssignFoal-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: successUser.id,
    },
  });
}, 30000);

afterAll(() => successCleanup.run(), 30000);

describe('assignGroomToFoal() — success path (lines 219 false-branch, 228-282) (Equoria-rr7)', () => {
  it('creates groomAssignment and returns success when groom owned by user is active (lines 219-278)', async () => {
    const result = await assignGroomToFoal(foalForSuccessAssign.id, groomForSuccessAssign.id, successUser.id);
    expect(result.success).toBe(true);
    expect(result.assignment).toBeDefined();
    expect(typeof result.message).toBe('string');
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// System-constant structural completeness. Pure (no DB).
describe('groomSystem — constants (merged from legacy backend/tests, Equoria-wvuin)', () => {
  describe('system constants completeness', () => {
    it('GROOM_SPECIALTIES has foalCare/general/training/medical with required fields', () => {
      ['foalCare', 'general', 'training', 'medical'].forEach(k => expect(GROOM_SPECIALTIES).toHaveProperty(k));
      Object.values(GROOM_SPECIALTIES).forEach(specialty => {
        expect(specialty).toHaveProperty('name');
        expect(specialty).toHaveProperty('description');
        expect(specialty).toHaveProperty('bondingModifier');
        expect(specialty).toHaveProperty('preferredActivities');
      });
    });

    it('SKILL_LEVELS has novice/intermediate/expert/master with required fields', () => {
      ['novice', 'intermediate', 'expert', 'master'].forEach(k => expect(SKILL_LEVELS).toHaveProperty(k));
      Object.values(SKILL_LEVELS).forEach(level => {
        expect(level).toHaveProperty('name');
        expect(level).toHaveProperty('bondingModifier');
        expect(level).toHaveProperty('costModifier');
        expect(level).toHaveProperty('errorChance');
        expect(level).toHaveProperty('description');
      });
    });

    it('PERSONALITY_TRAITS has gentle/energetic/patient/strict with required fields', () => {
      ['gentle', 'energetic', 'patient', 'strict'].forEach(k => expect(PERSONALITY_TRAITS).toHaveProperty(k));
      Object.values(PERSONALITY_TRAITS).forEach(trait => {
        expect(trait).toHaveProperty('name');
        expect(trait).toHaveProperty('bondingModifier');
        expect(trait).toHaveProperty('description');
      });
    });
  });
});
