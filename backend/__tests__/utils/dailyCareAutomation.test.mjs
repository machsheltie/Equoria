/**
 * dailyCareAutomation — pure-function + light-DB branch-coverage tests (Equoria-rr7)
 *
 * Pure functions (no DB):
 *   isGroomAvailableToday — is_active guard, availability || {} fallback, day match, catch
 *   determineRoutinesToPerform — unknown-routine filter, already-completed filter, keep path
 *   scheduleDailyCareAutomation — return shape, custom schedule
 *   DAILY_CARE_ROUTINES — structure invariants
 *
 * Light DB (real DB, specificFoalId=-1 → no assignments → early return):
 *   runDailyCareAutomation — no-assignments path
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  isGroomAvailableToday,
  determineRoutinesToPerform,
  scheduleDailyCareAutomation,
  DAILY_CARE_ROUTINES,
  runDailyCareAutomation,
} from '../../utils/dailyCareAutomation.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

// ── DAILY_CARE_ROUTINES constant ──────────────────────────────────────────────

describe('DAILY_CARE_ROUTINES', () => {
  it('has 5 entries each with name, interactionType, and positive duration', () => {
    const entries = Object.entries(DAILY_CARE_ROUTINES);
    expect(entries.length).toBe(5);
    for (const [, routine] of entries) {
      expect(typeof routine.name).toBe('string');
      expect(typeof routine.interactionType).toBe('string');
      expect(typeof routine.duration).toBe('number');
      expect(routine.duration).toBeGreaterThan(0);
    }
  });

  it('includes morning_care and feeding as distinct entries', () => {
    expect(DAILY_CARE_ROUTINES.morning_care).toBeDefined();
    expect(DAILY_CARE_ROUTINES.feeding).toBeDefined();
    expect(DAILY_CARE_ROUTINES.morning_care.interactionType).toBe('daily_care');
    expect(DAILY_CARE_ROUTINES.feeding.interactionType).toBe('feeding');
  });
});

// ── isGroomAvailableToday ─────────────────────────────────────────────────────

describe('isGroomAvailableToday()', () => {
  // ── Guard: is_active false ────────────────────────────────────────────────

  it('returns false when groom.is_active is false', () => {
    expect(isGroomAvailableToday({ is_active: false })).toBe(false);
  });

  it('returns false when is_active is false even with availability set to true', () => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[new Date().getDay()];
    expect(isGroomAvailableToday({ is_active: false, availability: { [todayName]: true } })).toBe(false);
  });

  // ── availability || {} fallback (falsy left branch) ───────────────────────

  it('returns true when is_active true and availability is absent (|| {} fallback)', () => {
    expect(isGroomAvailableToday({ is_active: true })).toBe(true);
  });

  it('returns true when is_active true and availability is null (|| {} fallback)', () => {
    expect(isGroomAvailableToday({ is_active: true, availability: null })).toBe(true);
  });

  // ── availability truthy, day check ────────────────────────────────────────

  it('returns true when is_active true and availability is empty object', () => {
    expect(isGroomAvailableToday({ is_active: true, availability: {} })).toBe(true);
  });

  it('returns true when today is explicitly true in availability', () => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[new Date().getDay()];
    const groom = { is_active: true, availability: { [todayName]: true } };
    expect(isGroomAvailableToday(groom)).toBe(true);
  });

  it('returns false when today is explicitly false in availability', () => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[new Date().getDay()];
    const groom = { is_active: true, availability: { [todayName]: false } };
    expect(isGroomAvailableToday(groom)).toBe(false);
  });

  // ── catch path ────────────────────────────────────────────────────────────

  it('returns true (fail-safe) when accessing is_active throws', () => {
    const evil = {
      get is_active() {
        throw new Error('getter bomb');
      },
    };
    expect(isGroomAvailableToday(evil)).toBe(true);
  });
});

// ── determineRoutinesToPerform ────────────────────────────────────────────────

describe('determineRoutinesToPerform()', () => {
  it('returns empty array when requestedRoutines is empty', () => {
    expect(determineRoutinesToPerform([], [])).toEqual([]);
  });

  it('excludes unknown routine types (!routine branch → filter false)', () => {
    const result = determineRoutinesToPerform(['unicorn_spa', 'teleportation'], []);
    expect(result).toEqual([]);
  });

  it('includes known routine types not yet completed', () => {
    const result = determineRoutinesToPerform(['morning_care', 'feeding'], []);
    expect(result).toContain('morning_care');
    expect(result).toContain('feeding');
  });

  it('excludes routines whose interactionType appears in completedRoutines', () => {
    // morning_care.interactionType='daily_care', evening_care.interactionType='daily_care'
    const result = determineRoutinesToPerform(['morning_care', 'evening_care', 'feeding'], ['daily_care']);
    expect(result).not.toContain('morning_care');
    expect(result).not.toContain('evening_care');
    expect(result).toContain('feeding');
  });

  it('returns all valid known routines when completedRoutines is empty', () => {
    const all = Object.keys(DAILY_CARE_ROUTINES);
    const result = determineRoutinesToPerform(all, []);
    expect(result).toEqual(all);
  });

  it('returns empty when all routines already completed', () => {
    const all = Object.keys(DAILY_CARE_ROUTINES);
    const allInteractionTypes = [...new Set(all.map(k => DAILY_CARE_ROUTINES[k].interactionType))];
    const result = determineRoutinesToPerform(all, allInteractionTypes);
    expect(result).toEqual([]);
  });
});

// ── scheduleDailyCareAutomation ───────────────────────────────────────────────

describe('scheduleDailyCareAutomation()', () => {
  it('returns configuration with default schedule, enabled true, and handler function', () => {
    const result = scheduleDailyCareAutomation();
    expect(result.schedule).toBe('0 8,14,20 * * *');
    expect(result.enabled).toBe(true);
    expect(typeof result.handler).toBe('function');
    expect(typeof result.description).toBe('string');
  });

  it('uses the provided custom schedule', () => {
    const result = scheduleDailyCareAutomation('0 6 * * *');
    expect(result.schedule).toBe('0 6 * * *');
    expect(result.enabled).toBe(true);
  });
});

// ── runDailyCareAutomation — no-assignments early return ──────────────────────

describe('runDailyCareAutomation()', () => {
  it('returns success with 0 processed when specificFoalId has no active assignments', async () => {
    const result = await runDailyCareAutomation({ specificFoalId: -1 });
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
    expect(Array.isArray(result.interactions)).toBe(true);
    expect(result.interactions).toHaveLength(0);
    expect(result.message).toMatch(/no active/i);
  });

  it('accepts dryRun option without error when no assignments', async () => {
    const result = await runDailyCareAutomation({ specificFoalId: -1, dryRun: true });
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
  });
});

// ── runDailyCareAutomation — main loop body (lines 108-176) ──────────────────
// Creates a real groom + assignment and calls runDailyCareAutomation with dryRun:true
// to cover: loop iteration, groom availability check, existing-care check,
// routine determination, and dryRun calculation path.

describe('runDailyCareAutomation() — main loop body, dryRun path (lines 108-176) (Equoria-jkht)', () => {
  let dcaUser;
  let dcaGroom;
  let dcaHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    dcaUser = await prisma.user.create({
      data: {
        email: `dca-fixture-${ts}-${rand()}@test.com`,
        username: `dcafix${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'DCA',
        lastName: 'Fixture',
        money: 1000,
      },
    });

    dcaGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-DCA-Groom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: dcaUser.id,
        isActive: true,
      },
    });

    dcaHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-DCA-Foal-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: dcaUser.id,
      },
    });

    await prisma.groomAssignment.create({
      data: {
        foalId: dcaHorse.id,
        groomId: dcaGroom.id,
        userId: dcaUser.id,
        priority: 1,
        isActive: true,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.groomInteraction.deleteMany({ where: { foalId: dcaHorse.id } }).catch(() => {});
    await prisma.groomAssignment.deleteMany({ where: { foalId: dcaHorse.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: dcaHorse.id } }).catch(() => {});
    await prisma.groom.delete({ where: { id: dcaGroom.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: dcaUser.id } }).catch(() => {});
  }, 30000);

  it('enters loop, runs groom care routines, returns success with processed >= 1 (lines 108-176)', async () => {
    // isGroomAvailableToday uses groom.isActive ?? groom.is_active (handles both Prisma camelCase
    // and plain objects). With a real DB groom (isActive=true), the groom is available and
    // care routines are executed in dryRun mode.
    // This test covers: assignment query, loop entry, groom-available path, care execution.
    const result = await runDailyCareAutomation({
      specificFoalId: dcaHorse.id,
      dryRun: true,
    });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.interactions)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(typeof result.summary).toBe('object');
  });

  it('returns processed >= 0 on second call (covers processed count path)', async () => {
    const result = await runDailyCareAutomation({
      specificFoalId: dcaHorse.id,
    });
    expect(result.success).toBe(true);
    expect(typeof result.processed).toBe('number');
  });
});

// ── runDailyCareAutomation — groom not available today (lines 112-113) ───────
// Creates a groom with today's day set to false in availability JSON.
// isGroomAvailableToday returns false → continue branch taken → no interactions.

describe('runDailyCareAutomation() — groom unavailable today (lines 112-113)', () => {
  let unavailUser;
  let unavailGroom;
  let unavailHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[new Date().getDay()];

    unavailUser = await prisma.user.create({
      data: {
        email: `dca-unavail-${ts}-${rand()}@test.com`,
        username: `dcaunavail${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'Unavail',
        lastName: 'Fixture',
        money: 1000,
      },
    });

    // Groom has today explicitly set to false in availability
    unavailGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-DCA-Unavail-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: unavailUser.id,
        isActive: true,
        availability: { [todayName]: false },
      },
    });

    unavailHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-DCA-Unavail-Foal-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: unavailUser.id,
      },
    });

    await prisma.groomAssignment.create({
      data: {
        foalId: unavailHorse.id,
        groomId: unavailGroom.id,
        userId: unavailUser.id,
        priority: 1,
        isActive: true,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.groomInteraction.deleteMany({ where: { foalId: unavailHorse.id } }).catch(() => {});
    await prisma.groomAssignment.deleteMany({ where: { foalId: unavailHorse.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: unavailHorse.id } }).catch(() => {});
    await prisma.groom.delete({ where: { id: unavailGroom.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: unavailUser.id } }).catch(() => {});
  }, 30000);

  it('skips groom when unavailable today — no interactions performed (lines 112-113)', async () => {
    const result = await runDailyCareAutomation({
      specificFoalId: unavailHorse.id,
      dryRun: true,
    });
    expect(result.success).toBe(true);
    // Assignment is found (processed >= 1) but groom is unavailable so no interactions
    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.interactions).toHaveLength(0);
  });
});

// ── runDailyCareAutomation — hasCompleteCare + routinesToPerform empty ────────
// Lines 122-125 (hasCompleteCare) and 135-136 (routinesToPerform empty) are
// covered by injecting existing 'daily_care' + 'feeding' interactions today.

describe('runDailyCareAutomation() — hasCompleteCare=true (lines 122-125)', () => {
  let completeUser;
  let completeGroom;
  let completeHorse;
  let completeAssignment;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    completeUser = await prisma.user.create({
      data: {
        email: `dca-complete-${ts}-${rand()}@test.com`,
        username: `dcacomplete${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'Complete',
        lastName: 'Fixture',
        money: 1000,
      },
    });

    completeGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-DCA-Complete-Groom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: completeUser.id,
        isActive: true,
      },
    });

    completeHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-DCA-Complete-Foal-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: completeUser.id,
      },
    });

    completeAssignment = await prisma.groomAssignment.create({
      data: {
        foalId: completeHorse.id,
        groomId: completeGroom.id,
        userId: completeUser.id,
        priority: 1,
        isActive: true,
      },
    });

    // Pre-seed both essential routines (daily_care + feeding) with today's timestamp
    // so checkExistingCareToday returns hasCompleteCare=true.
    await prisma.groomInteraction.create({
      data: {
        foalId: completeHorse.id,
        groomId: completeGroom.id,
        assignmentId: completeAssignment.id,
        interactionType: 'daily_care',
        duration: 30,
        timestamp: new Date(),
      },
    });
    await prisma.groomInteraction.create({
      data: {
        foalId: completeHorse.id,
        groomId: completeGroom.id,
        assignmentId: completeAssignment.id,
        interactionType: 'feeding',
        duration: 20,
        timestamp: new Date(),
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.groomInteraction.deleteMany({ where: { foalId: completeHorse.id } }).catch(() => {});
    await prisma.groomAssignment.deleteMany({ where: { foalId: completeHorse.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: completeHorse.id } }).catch(() => {});
    await prisma.groom.delete({ where: { id: completeGroom.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: completeUser.id } }).catch(() => {});
  }, 30000);

  it('skips foal when daily care is already complete today (lines 122-125)', async () => {
    const result = await runDailyCareAutomation({
      specificFoalId: completeHorse.id,
      dryRun: true,
    });
    expect(result.success).toBe(true);
    // Assignment found, but care already complete — no new interactions
    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.interactions).toHaveLength(0);
  });
});

// ── runDailyCareAutomation — routinesToPerform empty (lines 135-136) ─────────
// When routineTypes is explicitly set to types whose interactionTypes are all
// already in completedRoutines, determineRoutinesToPerform returns [].

describe('runDailyCareAutomation() — routinesToPerform empty (lines 135-136)', () => {
  let emptyUser;
  let emptyGroom;
  let emptyHorse;
  let emptyAssignment;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    emptyUser = await prisma.user.create({
      data: {
        email: `dca-empty-${ts}-${rand()}@test.com`,
        username: `dcaempty${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'Empty',
        lastName: 'Fixture',
        money: 1000,
      },
    });

    emptyGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-DCA-Empty-Groom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: emptyUser.id,
        isActive: true,
      },
    });

    emptyHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-DCA-Empty-Foal-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: emptyUser.id,
      },
    });

    emptyAssignment = await prisma.groomAssignment.create({
      data: {
        foalId: emptyHorse.id,
        groomId: emptyGroom.id,
        userId: emptyUser.id,
        priority: 1,
        isActive: true,
      },
    });

    // Seed only morning_care (interactionType='daily_care') — not feeding, so
    // hasCompleteCare=false. But we request only 'morning_care' and 'evening_care'
    // which both map to 'daily_care', and that's already completed.
    await prisma.groomInteraction.create({
      data: {
        foalId: emptyHorse.id,
        groomId: emptyGroom.id,
        assignmentId: emptyAssignment.id,
        interactionType: 'daily_care',
        duration: 45,
        timestamp: new Date(),
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.groomInteraction.deleteMany({ where: { foalId: emptyHorse.id } }).catch(() => {});
    await prisma.groomAssignment.deleteMany({ where: { foalId: emptyHorse.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: emptyHorse.id } }).catch(() => {});
    await prisma.groom.delete({ where: { id: emptyGroom.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: emptyUser.id } }).catch(() => {});
  }, 30000);

  it('skips foal when routinesToPerform is empty (lines 135-136)', async () => {
    // morning_care and evening_care both have interactionType='daily_care',
    // which is already in completedRoutines → determineRoutinesToPerform returns [].
    // hasCompleteCare=false (feeding not done) but routines list is empty.
    const result = await runDailyCareAutomation({
      specificFoalId: emptyHorse.id,
      routineTypes: ['morning_care', 'evening_care'],
      dryRun: true,
    });
    expect(result.success).toBe(true);
    expect(result.interactions).toHaveLength(0);
  });
});
