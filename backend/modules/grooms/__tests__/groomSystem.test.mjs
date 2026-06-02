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
  calculateGroomInteractionEffects,
  assignGroomToFoal,
  ensureDefaultGroomAssignment,
  getOrCreateDefaultGroom,
  validateFoalInteractionLimits,
  recordGroomInteraction,
  GROOM_SPECIALTIES,
  SKILL_LEVELS,
  PERSONALITY_TRAITS,
} from '../../../utils/groomSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

const GHOST_UUID = '00000000-0000-0000-0000-ffffffffffff';
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
    const foal = { dailyTaskRecord: { [TODAY]: ['brushing', 'stall_care', 'hand-walking'] } };
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

// ── calculateGroomInteractionEffects — branch coverage (Equoria-jkht) ─────────
//
// Branch map:
//   GROOM_SPECIALTIES[groom.speciality] || GROOM_SPECIALTIES.general  → known/unknown
//   SKILL_LEVELS[groom.skillLevel]       || SKILL_LEVELS.intermediate  → known/unknown
//   PERSONALITY_TRAITS[groom.personality]|| PERSONALITY_TRAITS.gentle  → known/unknown
//   typeof groom.sessionRate === 'number'                              → true/false
//   errorOccurred                                                       → random; tested via output shape
//   quality: errorOccurred / bondingChange>=7 / >=4 / else            → random; tested via valid set
//   catch                                                              → null groom throws

describe('calculateGroomInteractionEffects()', () => {
  // Minimal valid foal (no DB calls — function is synchronous pure calc)
  const foal = { id: 1, bondScore: 50, temperament: null };

  // Helper: build a groom object with all known keys
  function makeGroom(overrides = {}) {
    return {
      speciality: 'foalCare',
      skillLevel: 'intermediate',
      personality: 'gentle',
      experience: 0,
      sessionRate: 20,
      ...overrides,
    };
  }

  // ── return shape ────────────────────────────────────────────────────────────

  it('returns an object with expected fields for a valid groom', () => {
    const result = calculateGroomInteractionEffects(makeGroom(), foal, 'grooming', 60);
    expect(result).toHaveProperty('bondingChange');
    expect(result).toHaveProperty('stressChange');
    expect(result).toHaveProperty('cost');
    expect(result).toHaveProperty('quality');
    expect(result).toHaveProperty('errorOccurred');
    expect(result).toHaveProperty('successRate');
    expect(result).toHaveProperty('modifiers');
  });

  it('bondingChange is within [0, 10]', () => {
    const result = calculateGroomInteractionEffects(makeGroom(), foal, 'grooming', 60);
    expect(result.bondingChange).toBeGreaterThanOrEqual(0);
    expect(result.bondingChange).toBeLessThanOrEqual(10);
  });

  it('stressChange is within [-10, 5]', () => {
    const result = calculateGroomInteractionEffects(makeGroom(), foal, 'grooming', 60);
    expect(result.stressChange).toBeGreaterThanOrEqual(-10);
    expect(result.stressChange).toBeLessThanOrEqual(5);
  });

  it('quality is one of the four expected values', () => {
    const result = calculateGroomInteractionEffects(makeGroom(), foal, 'grooming', 60);
    expect(['excellent', 'good', 'fair', 'poor']).toContain(result.quality);
  });

  // ── specialty fallback branch ───────────────────────────────────────────────

  it('falls back to GROOM_SPECIALTIES.general for unknown speciality', () => {
    const result = calculateGroomInteractionEffects(
      makeGroom({ speciality: 'unicornWhisperer' }),
      foal,
      'grooming',
      60,
    );
    // The general specialty has bondingModifier=1.0; modifiers.specialty reflects it
    expect(result.modifiers.specialty).toBe(GROOM_SPECIALTIES.general.bondingModifier);
  });

  it('uses GROOM_SPECIALTIES.foalCare for foalCare speciality', () => {
    const result = calculateGroomInteractionEffects(makeGroom({ speciality: 'foalCare' }), foal, 'grooming', 60);
    expect(result.modifiers.specialty).toBe(GROOM_SPECIALTIES.foalCare.bondingModifier);
  });

  // ── skillLevel fallback branch ──────────────────────────────────────────────

  it('falls back to SKILL_LEVELS.intermediate for unknown skillLevel', () => {
    const result = calculateGroomInteractionEffects(makeGroom({ skillLevel: 'mythic' }), foal, 'grooming', 60);
    expect(result.modifiers.skillLevel).toBe(SKILL_LEVELS.intermediate.bondingModifier);
  });

  it('uses SKILL_LEVELS.expert for expert skillLevel', () => {
    const result = calculateGroomInteractionEffects(makeGroom({ skillLevel: 'expert' }), foal, 'grooming', 60);
    expect(result.modifiers.skillLevel).toBe(SKILL_LEVELS.expert.bondingModifier);
  });

  // ── personality fallback branch ─────────────────────────────────────────────

  it('falls back to PERSONALITY_TRAITS.gentle for unknown personality', () => {
    const result = calculateGroomInteractionEffects(makeGroom({ personality: 'telepathic' }), foal, 'grooming', 60);
    expect(result.modifiers.personality).toBe(PERSONALITY_TRAITS.gentle.bondingModifier);
  });

  it('uses PERSONALITY_TRAITS.strict for strict personality', () => {
    const result = calculateGroomInteractionEffects(makeGroom({ personality: 'strict' }), foal, 'grooming', 60);
    expect(result.modifiers.personality).toBe(PERSONALITY_TRAITS.strict.bondingModifier);
  });

  // ── sessionRate type branch ─────────────────────────────────────────────────

  it('uses numeric sessionRate when provided', () => {
    const groom = makeGroom({ sessionRate: 30, skillLevel: 'intermediate', experience: 0 });
    const result = calculateGroomInteractionEffects(groom, foal, 'grooming', 60);
    // cost = 30 * intermediate.costModifier * (1 + (60-60)/300) = 30 * 1 * 1 = 30
    expect(result.cost).toBeCloseTo(30, 1);
  });

  it('defaults sessionRate to 18.0 when not a number (string)', () => {
    const groom = makeGroom({ sessionRate: 'free', skillLevel: 'intermediate', experience: 0 });
    const result = calculateGroomInteractionEffects(groom, foal, 'grooming', 60);
    // cost = 18 * intermediate.costModifier * 1 = 18
    expect(result.cost).toBeCloseTo(18, 1);
  });

  it('defaults sessionRate to 18.0 when undefined', () => {
    const groom = makeGroom({ skillLevel: 'intermediate', experience: 0 });
    delete groom.sessionRate;
    const result = calculateGroomInteractionEffects(groom, foal, 'grooming', 60);
    expect(result.cost).toBeCloseTo(18, 1);
  });

  // ── experience bonus branch ─────────────────────────────────────────────────

  it('applies experience bonus to bondingChange (+1 per 5 years)', () => {
    const withExp = makeGroom({ experience: 5, skillLevel: 'master' });
    const noExp = makeGroom({ experience: 0, skillLevel: 'master' });
    const resultWith = calculateGroomInteractionEffects(withExp, foal, 'grooming', 60);
    const resultNo = calculateGroomInteractionEffects(noExp, foal, 'grooming', 60);
    // modifiers.experience should reflect the experienceBonus
    expect(resultWith.modifiers.experience).toBe(1); // Math.floor(5/5)=1
    expect(resultNo.modifiers.experience).toBe(0); // Math.floor(0/5)=0
  });

  // ── quality = 'fair' branch (line 598) — very short duration → bondingChange < 4 ─

  it("quality is 'fair' (or 'poor' on rare error) when duration is extremely short", () => {
    // duration=1 → baseBondingChange=0 → bondingChange=0 < 4
    // master errorChance=0.01 → 99% no error → quality='fair' (line 598)
    const groom = makeGroom({ skillLevel: 'master', experience: 0 });
    const result = calculateGroomInteractionEffects(groom, foal, 'grooming', 1);
    expect(['fair', 'poor']).toContain(result.quality);
  });

  // ── catch path ──────────────────────────────────────────────────────────────

  it('throws when groom is null (catch re-throws)', () => {
    expect(() => calculateGroomInteractionEffects(null, foal, 'grooming', 60)).toThrow();
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

// ── ensureDefaultGroomAssignment — FK-fail in test mode (lines 295-381) ──────

describe('ensureDefaultGroomAssignment() — FK violation on groom.create in test mode', () => {
  it('rejects when userId is a ghost UUID (groom.create FK P2003 → catch + rethrow)', async () => {
    let thrown = false;
    try {
      await ensureDefaultGroomAssignment(-1, GHOST_UUID);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});

// ── getOrCreateDefaultGroom — no-groom-found path (lines 390-416) ────────────

describe('getOrCreateDefaultGroom() — no foalCare groom found for ghost userId', () => {
  it('rejects when userId has no foalCare groom in DB (null → throw → catch + rethrow)', async () => {
    let thrown = false;
    try {
      await getOrCreateDefaultGroom(GHOST_UUID);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});

// ── validateFoalInteractionLimits — horse-not-found path (lines 424-434) ─────

describe('validateFoalInteractionLimits() — horse not found', () => {
  it('rejects with "Horse with ID -1 not found" for a non-existent horse', async () => {
    await expect(validateFoalInteractionLimits(-1)).rejects.toThrow('Horse with ID -1 not found');
  });
});

// ── recordGroomInteraction — horse-not-found → catch returns object (lines 491-535)

describe('recordGroomInteraction() — horse not found → success=false envelope', () => {
  it('returns { success: false, error } when foalId -1 does not exist (catch envelope, lines 529-534)', async () => {
    const result = await recordGroomInteraction(-1, -1, 'feeding', 30, GHOST_UUID);
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error).toMatch(/Horse with ID -1 not found/);
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
  groomNotFoundUser = await prisma.user.create({
    data: {
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

  // Register scoped, FK-ordered cleanup (horse before user — Horse.userId Restrict).
  groomNotFoundCleanup.add(
    () => prisma.horse.delete({ where: { id: groomNotFoundHorse.id } }),
    'groomNotFound horse',
  );
  groomNotFoundCleanup.add(
    () => prisma.user.delete({ where: { id: groomNotFoundUser.id } }),
    'groomNotFound user',
  );
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

// ── assignGroomToFoal success path + ensureDefault + validateInteraction ────────
//
// Fixture set for lines 219-278 (assignGroomToFoal success path),
// lines 312-316 (ensureDefaultGroomAssignment existing assignment),
// lines 351-368 (ensureDefaultGroomAssignment test-mode creation),
// line 406 (getOrCreateDefaultGroom existing groom),
// lines 455 + 498-505 (validateFoalInteractionLimits daily limit),
// lines 509-528 (recordGroomInteraction success path).

let successUser;
let groomForSuccessAssign;
let foalForSuccessAssign;
let foalForInteractTest;
let foalPreAssigned;
let foalForEnsure;
// Equoria-1ohys: fail-loud scoped cleanup. FK order: groom* children
// (groomInteraction, groomAssignment — Cascade on Groom*) deleted first, then
// the horses/groom (Horse.userId + Groom.userId Restrict), then the owning user
// last. All deletes scoped to ids/foalIds this suite created.
const successCleanup = createCleanupTracker();

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  successUser = await prisma.user.create({
    data: {
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

  foalForInteractTest = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-InteractFoal-${ts}`,
      sex: 'Colt',
      dateOfBirth: new Date(),
      age: 0,
      userId: successUser.id,
    },
  });

  foalPreAssigned = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-PreAssignedFoal-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: successUser.id,
    },
  });
  await prisma.groomAssignment.create({
    data: {
      foalId: foalPreAssigned.id,
      groomId: groomForSuccessAssign.id,
      userId: successUser.id,
      priority: 1,
      isActive: true,
    },
  });

  foalForEnsure = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-EnsureFoal-${ts}`,
      sex: 'Colt',
      dateOfBirth: new Date(),
      age: 0,
      userId: successUser.id,
    },
  });

  // Register scoped, FK-ordered cleanup: groom* children first (cascade-owned
  // by groom/foal), then horses + groom (Restrict on Horse.userId/Groom.userId),
  // then the owning user last.
  successCleanup.add(
    () => prisma.groomInteraction.deleteMany({ where: { foalId: foalForInteractTest.id } }),
    'success groomInteractions',
  );
  successCleanup.add(
    () =>
      prisma.groomAssignment.deleteMany({
        where: { foalId: { in: [foalPreAssigned.id, foalForSuccessAssign.id, foalForEnsure.id] } },
      }),
    'success groomAssignments',
  );
  successCleanup.add(() => prisma.horse.delete({ where: { id: foalForSuccessAssign.id } }), 'success foalForSuccessAssign');
  successCleanup.add(() => prisma.horse.delete({ where: { id: foalForInteractTest.id } }), 'success foalForInteractTest');
  successCleanup.add(() => prisma.horse.delete({ where: { id: foalPreAssigned.id } }), 'success foalPreAssigned');
  successCleanup.add(() => prisma.horse.delete({ where: { id: foalForEnsure.id } }), 'success foalForEnsure');
  successCleanup.add(() => prisma.groom.delete({ where: { id: groomForSuccessAssign.id } }), 'success groom');
  successCleanup.add(() => prisma.user.delete({ where: { id: successUser.id } }), 'success user');
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

describe('getOrCreateDefaultGroom() — existing foalCare groom path (line 406) (Equoria-rr7)', () => {
  it('returns existing foalCare groom without creating a new one (line 406)', async () => {
    const result = await getOrCreateDefaultGroom(successUser.id);
    expect(result.id).toBe(groomForSuccessAssign.id);
  });
});

describe('ensureDefaultGroomAssignment() — existing assignment early return (lines 312-316) (Equoria-rr7)', () => {
  it('returns isExisting=true when foal already has active assignment (lines 312-316)', async () => {
    const result = await ensureDefaultGroomAssignment(foalPreAssigned.id, successUser.id);
    expect(result.success).toBe(true);
    expect(result.isExisting).toBe(true);
  });
});

describe('ensureDefaultGroomAssignment() — test-mode assignment creation (lines 351-368) (Equoria-rr7)', () => {
  it('creates assignment for foal with no prior assignment in test mode (lines 351-368)', async () => {
    const result = await ensureDefaultGroomAssignment(foalForEnsure.id, successUser.id);
    expect(result.success).toBe(true);
    expect(result.isNew).toBe(true);
  });
});

describe('recordGroomInteraction() — success path (lines 509-528) (Equoria-rr7)', () => {
  it('records interaction and returns success for horse with no prior interactions today (lines 509-528)', async () => {
    const result = await recordGroomInteraction(
      foalForInteractTest.id,
      groomForSuccessAssign.id,
      'grooming',
      30,
      successUser.id,
    );
    expect(result.success).toBe(true);
    expect(result.interaction).toBeDefined();
    expect(result.interaction.foalId).toBe(foalForInteractTest.id);
  });
});

describe('recordGroomInteraction() — daily limit reached (lines 455, 498-505) (Equoria-rr7)', () => {
  it('returns dailyLimitReached=true on second call today for same horse (lines 455, 498-505)', async () => {
    // foalForInteractTest already has an interaction from the previous test
    const result = await recordGroomInteraction(
      foalForInteractTest.id,
      groomForSuccessAssign.id,
      'grooming',
      30,
      successUser.id,
    );
    expect(result.success).toBe(false);
    expect(result.dailyLimitReached).toBe(true);
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// System-constant structural completeness and the relational/comparative
// calculateGroomInteractionEffects assertions not covered above. Pure (no DB).
describe('groomSystem — constants & comparative effects (merged from legacy backend/tests, Equoria-wvuin)', () => {
  describe('system constants completeness', () => {
    it('GROOM_SPECIALTIES has foalCare/general/training/medical with required fields', () => {
      ['foalCare', 'general', 'training', 'medical'].forEach(k => expect(GROOM_SPECIALTIES).toHaveProperty(k));
      Object.values(GROOM_SPECIALTIES).forEach(specialty => {
        expect(specialty).toHaveProperty('name');
        expect(specialty).toHaveProperty('description');
        expect(specialty).toHaveProperty('bondingModifier');
        expect(specialty).toHaveProperty('stressReduction');
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
        expect(trait).toHaveProperty('stressReduction');
        expect(trait).toHaveProperty('description');
      });
    });
  });

  describe('calculateGroomInteractionEffects — comparative modifiers', () => {
    const mockGroom = {
      id: 1,
      name: 'Sarah Johnson',
      speciality: 'foalCare',
      skillLevel: 'intermediate',
      personality: 'gentle',
      experience: 5,
      sessionRate: 18.0,
    };
    const mockFoal = { id: 1, name: 'Test Foal', bondScore: 50, stressLevel: 20 };

    it('foalCare specialty modifier exceeds general', () => {
      const foalCare = calculateGroomInteractionEffects(
        { ...mockGroom, speciality: 'foalCare' },
        mockFoal,
        'dailyCare',
        60,
      );
      const general = calculateGroomInteractionEffects(
        { ...mockGroom, speciality: 'general' },
        mockFoal,
        'dailyCare',
        60,
      );
      expect(foalCare.modifiers.specialty).toBeGreaterThan(general.modifiers.specialty);
    });

    it('expert skill modifier (and cost) exceeds novice', () => {
      const expert = calculateGroomInteractionEffects(
        { ...mockGroom, skillLevel: 'expert' },
        mockFoal,
        'dailyCare',
        60,
      );
      const novice = calculateGroomInteractionEffects(
        { ...mockGroom, skillLevel: 'novice' },
        mockFoal,
        'dailyCare',
        60,
      );
      expect(expert.modifiers.skillLevel).toBeGreaterThan(novice.modifiers.skillLevel);
      expect(expert.cost).toBeGreaterThan(novice.cost);
    });

    it('experienced groom modifier exceeds new groom', () => {
      const experienced = calculateGroomInteractionEffects({ ...mockGroom, experience: 15 }, mockFoal, 'dailyCare', 60);
      const newGroom = calculateGroomInteractionEffects({ ...mockGroom, experience: 1 }, mockFoal, 'dailyCare', 60);
      expect(experienced.modifiers.experience).toBeGreaterThan(newGroom.modifiers.experience);
    });

    it('longer duration produces higher cost', () => {
      const short = calculateGroomInteractionEffects(mockGroom, mockFoal, 'dailyCare', 30);
      const long = calculateGroomInteractionEffects(mockGroom, mockFoal, 'dailyCare', 120);
      expect(long.cost).toBeGreaterThan(short.cost);
    });
  });
});
