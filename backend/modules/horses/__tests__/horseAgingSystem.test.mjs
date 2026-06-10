/**
 * horseAgingSystem — branch-coverage tests (Equoria-rr7)
 *
 * Pure functions:
 *   calculateAgeFromBirth — date arithmetic, catch path
 *
 * Safe DB ("not found" / early-return paths only):
 *   updateHorseAge          — horse-not-found → rejects
 *   checkForMilestones      — no milestones / age-1 / additionalMilestone / retirement paths
 *   processHorseBirthdays   — horseIds array branch (returns empty when all IDs missing)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  calculateAgeFromBirth,
  updateHorseAge,
  checkForMilestones,
  processHorseBirthdays,
} from '../../../utils/horseAgingSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const daysAgo = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

describe('calculateAgeFromBirth', () => {
  it('returns 0 for a horse born today', () => {
    expect(calculateAgeFromBirth(new Date())).toBe(0);
  });

  it('returns 1 for a horse born yesterday', () => {
    expect(calculateAgeFromBirth(daysAgo(1))).toBe(1);
  });

  it('returns 365 for a horse born 365 days ago', () => {
    const result = calculateAgeFromBirth(daysAgo(365));
    // allow ±1 for DST/leap boundaries
    expect(result).toBeGreaterThanOrEqual(364);
    expect(result).toBeLessThanOrEqual(366);
  });

  it('returns 0 for a future birth date', () => {
    const future = new Date(Date.now() + 86400000);
    expect(calculateAgeFromBirth(future)).toBe(0);
  });

  it('accepts ISO date string', () => {
    expect(calculateAgeFromBirth(daysAgo(10).toISOString())).toBe(10);
  });

  it('accepts a custom currentDate as second argument', () => {
    const dob = new Date('2020-01-01');
    const current = new Date('2020-01-11');
    expect(calculateAgeFromBirth(dob, current)).toBe(10);
  });

  it('returns 0 for identical birth and current date', () => {
    const d = new Date('2024-06-15');
    expect(calculateAgeFromBirth(d, d)).toBe(0);
  });

  it('returns a large number for an ancient date (year 1900)', () => {
    const ancient = new Date('1900-01-01');
    const result = calculateAgeFromBirth(ancient);
    expect(result).toBeGreaterThan(40000); // 100+ years in days
  });

  it('returns 0 (fail-safe) when dateOfBirth.valueOf() throws (catch branch)', () => {
    const evil = {
      valueOf() {
        throw new Error('valueOf bomb');
      },
    };
    expect(calculateAgeFromBirth(evil)).toBe(0);
  });
});

// ── processHorseBirthdays — no-horses early return ────────────────────────────

describe('processHorseBirthdays()', () => {
  it('returns totalProcessed=0 when specificHorseId does not exist in DB', async () => {
    const result = await processHorseBirthdays({ specificHorseId: -1 });
    expect(result.totalProcessed).toBe(0);
    expect(result.birthdaysFound).toBe(0);
    expect(result.milestonesTriggered).toBe(0);
    expect(result.errors).toBe(0);
    expect(typeof result.duration).toBe('number');
  });

  it('accepts dryRun option without error when specificHorseId has no match', async () => {
    const result = await processHorseBirthdays({ specificHorseId: -1, dryRun: true });
    expect(result.totalProcessed).toBe(0);
  });

  it('accepts horseIds array and returns 0 when all IDs are missing (horseIds branch)', async () => {
    const result = await processHorseBirthdays({ horseIds: [-1, -2] });
    expect(result.totalProcessed).toBe(0);
    expect(result.birthdaysFound).toBe(0);
    expect(typeof result.duration).toBe('number');
  });
});

// ── updateHorseAge — horse-not-found error path ───────────────────────────────

describe('updateHorseAge()', () => {
  it('rejects with "Horse with ID -1 not found" for a non-existent horse', async () => {
    await expect(updateHorseAge(-1)).rejects.toThrow('Horse with ID -1 not found');
  });
});

// ── checkForMilestones — various milestone branch paths ───────────────────────

describe('checkForMilestones()', () => {
  it('returns empty arrays when no age threshold is crossed (previousAge=newAge=0)', async () => {
    const result = await checkForMilestones(-1, 0, 0);
    expect(result.milestonesTriggered).toEqual([]);
    expect(result.traitsAssigned).toEqual([]);
    expect(result.retirementTriggered).toBe(false);
  });

  it('pushes age_1_trait_evaluation milestone when crossing 7-day threshold (horse not found → no-op)', async () => {
    const result = await checkForMilestones(-1, 0, 7);
    expect(result.milestonesTriggered).toContain('age_1_trait_evaluation');
  });

  it('enters additionalMilestone loop for 14-day threshold (horse not found → no-op)', async () => {
    const result = await checkForMilestones(-1, 13, 14);
    expect(Array.isArray(result.milestonesTriggered)).toBe(true);
  });

  it('enters additionalMilestone loop for 21-day threshold (horse not found → no-op)', async () => {
    const result = await checkForMilestones(-1, 20, 21);
    expect(Array.isArray(result.milestonesTriggered)).toBe(true);
  });

  it('triggers retirement milestone when crossing 147-day threshold', async () => {
    const result = await checkForMilestones(-1, 146, 147);
    expect(result.retirementTriggered).toBe(true);
    expect(result.milestonesTriggered).toContain('retirement');
  });

  it('returns shape with all expected keys', async () => {
    const result = await checkForMilestones(-1, 0, 0);
    expect(result).toHaveProperty('milestonesTriggered');
    expect(result).toHaveProperty('traitsAssigned');
    expect(result).toHaveProperty('retirementTriggered');
  });

  it('returns fallback when newAge comparison throws (outer catch path lines 337-338)', async () => {
    // previousAge=0 < 7 is true → short-circuit evaluates newAge >= 7
    // evil.valueOf() throws → propagates past inner try (not wrapped) → outer catch fires
    const evil = {
      valueOf() {
        throw new Error('evil valueOf');
      },
    };
    const result = await checkForMilestones(-1, 0, evil);
    expect(result.milestonesTriggered).toEqual([]);
    expect(result.traitsAssigned).toEqual([]);
    expect(result.retirementTriggered).toBe(false);
  });
});

// ── updateHorseAge — DB-fixture paths (lines 95-135) ─────────────────────────
// Covers the age-up-to-date early-return (calculatedAge === storedAge → ageUpdated:false)
// and the age-update path (calculatedAge !== storedAge → DB update → ageUpdated:true).

describe('updateHorseAge() — DB-fixture paths (lines 95-135) (Equoria-jkht)', () => {
  let fixtureUser;
  let currentAgeHorse;
  let staleAgeHorse;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    fixtureUser = await prisma.user.create({
      data: {
        email: `has-fixture-${ts}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        username: `hasfix${ts}${Math.random().toString(36).slice(2, 6)}`,
        password: 'irrelevant-hash',
        firstName: 'HAS',
        lastName: 'Fixture',
        money: 1000,
      },
    });

    // Horse born today, stored age=0 → calculatedAge=0 === storedAge → early return (lines 95-107)
    currentAgeHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-HAS-Current-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: fixtureUser.id,
      },
    });

    // Horse born 7 days ago (1 game-year), stored age=0 → calculatedAge=1 !== storedAge → DB update
    // Updated for Equoria-son6 game-year semantics (1 week = 1 game year)
    staleAgeHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-HAS-Stale-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        age: 0,
        userId: fixtureUser.id,
      },
    });

    // Scoped, fail-loud cleanup (Equoria-n7qa3): horses by name-prefix BEFORE
    // the user (Horse.userId onDelete:Restrict, schema:282).
    cleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-HAS-' } } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: fixtureUser.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('returns { ageUpdated:false } when calculated age equals stored age (lines 95-107)', async () => {
    const result = await updateHorseAge(currentAgeHorse.id);
    expect(result.ageUpdated).toBe(false);
    expect(result.hadBirthday).toBe(false);
    expect(result.horseId).toBe(currentAgeHorse.id);
    expect(typeof result.newAge).toBe('number');
    expect(Array.isArray(result.milestonesTriggered)).toBe(true);
  });

  it('returns { ageUpdated:true } when calculated age differs from stored age (lines 109-135)', async () => {
    const result = await updateHorseAge(staleAgeHorse.id);
    expect(result.ageUpdated).toBe(true);
    expect(result.newAge).toBeGreaterThanOrEqual(1);
    expect(result.horseId).toBe(staleAgeHorse.id);
    expect(Array.isArray(result.milestonesTriggered)).toBe(true);
  });
});

// ── checkForMilestones — milestone age 14 DB-fixture (lines 250-308) ─────────────
// Covers the if(horse) block and both eligibility branches. Post Equoria-son6 /
// Equoria-nxga: horse.age stores GAME YEARS. milestoneTraitEvaluator no longer
// divides by 365 — milestoneAge IS horse.age.
//   not-eligible (303-306): horse.age=0 → milestoneAge 0 → not in MILESTONE_AGES
//   eligible+success (254-296): horse.age=2 → milestoneAge 2 → in MILESTONE_AGES
//   (checkForMilestones(id,13,14) crosses the 14-day threshold = game-year 2)

describe('checkForMilestones() — milestone age 14 DB-fixture paths (lines 250-308) (Equoria-rr7)', () => {
  let masUser;
  let masHorseNotEligible;
  let masHorseEligible;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);
    masUser = await prisma.user.create({
      data: {
        email: `mas-fixture-${ts}-${rand()}@test.com`,
        username: `masfix${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'MAS',
        lastName: 'Fixture',
        money: 1000,
      },
    });
    // age=0 (game-years): milestoneAge 0 → not in MILESTONE_AGES → eligible:false → not-eligible branch
    masHorseNotEligible = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-MAS-NotElig-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: masUser.id,
      },
    });
    // age=2 (game-years): milestoneAge 2 → in MILESTONE_AGES, no prior milestone → eligible:true → success branch
    masHorseEligible = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-MAS-Eligible-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        age: 2,
        userId: masUser.id,
      },
    });

    // Scoped, fail-loud cleanup (Equoria-n7qa3): horses by name-prefix BEFORE
    // the user (Horse.userId onDelete:Restrict, schema:282).
    cleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-MAS-' } } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: masUser.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('enters if(horse) block and not-eligible branch (lines 250, 303-306) when horse.age=0', async () => {
    const result = await checkForMilestones(masHorseNotEligible.id, 13, 14);
    expect(Array.isArray(result.milestonesTriggered)).toBe(true);
    expect(result.retirementTriggered).toBe(false);
    expect(result.traitsAssigned).toEqual([]);
  });

  it('enters if(horse) block and eligible+success branch (lines 254-296) when horse.age=2 game-years', async () => {
    const result = await checkForMilestones(masHorseEligible.id, 13, 14);
    expect(Array.isArray(result.milestonesTriggered)).toBe(true);
    expect(result.retirementTriggered).toBe(false);
    expect(Array.isArray(result.traitsAssigned)).toBe(true);
  });
});

// ── processHorseBirthdays — dryRun else-branch (lines 416-417) ───────────────────
// Requires: specificHorseId with calculatedAge > storedAge + dryRun:true

describe('processHorseBirthdays() — dryRun else-branch (lines 416-417) (Equoria-rr7)', () => {
  let pbUser;
  let pbHorse;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);
    pbUser = await prisma.user.create({
      data: {
        email: `pb-fixture-${ts}-${rand()}@test.com`,
        username: `pbfix${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'PB',
        lastName: 'Fixture',
        money: 1000,
      },
    });
    // born 7 days ago (1 game-year), age=0 → calculatedAge(1) !== storedAge(0) → birthdaysFound++
    // Updated for Equoria-son6 game-year semantics (1 week = 1 game year)
    pbHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-PB-DryRun-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        age: 0,
        userId: pbUser.id,
      },
    });

    // Scoped, fail-loud cleanup (Equoria-n7qa3): horses by name-prefix BEFORE
    // the user (Horse.userId onDelete:Restrict, schema:282).
    cleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-PB-' } } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: pbUser.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('covers dryRun else-branch (lines 416-417): birthdaysFound>=1, results=[] when dryRun:true', async () => {
    const result = await processHorseBirthdays({ specificHorseId: pbHorse.id, dryRun: true });
    expect(result.birthdaysFound).toBeGreaterThanOrEqual(1);
    expect(result.totalProcessed).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results).toHaveLength(0);
    expect(typeof result.duration).toBe('number');
  });
});

// ── checkForMilestones age_1 — if(horse) true path (Equoria-jkht) ─────────────
// Lines 181-213: horse found → evaluateEpigeneticTagsFromFoalTasks with empty
// taskLog → assignedTraits=[] → else branch (lines 209-213) fires.

describe('checkForMilestones() — age_1 if(horse) true path, empty traits (Equoria-jkht)', () => {
  let cm1User;
  let cm1Horse;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    cm1User = await prisma.user.create({
      data: {
        email: `cm1-${ts}-${rand()}@test.com`,
        username: `cm1fix${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'CM1',
        lastName: 'Fixture',
        money: 0,
      },
    });

    cm1Horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-CM1-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        age: 0,
        userId: cm1User.id,
      },
    });

    // Scoped, fail-loud cleanup (Equoria-n7qa3): horses by name-prefix BEFORE
    // the user (Horse.userId onDelete:Restrict, schema:282).
    cleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-CM1-' } } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: cm1User.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('if(horse) true path: empty taskLog → assignedTraits=[] → else branch (lines 181, 183-187, 209-213)', async () => {
    // previousAge=0 < 7, newAge=8 >= 7 → age_1 condition fires
    // horse has no taskLog entries → evaluateEpigeneticTagsFromFoalTasks returns []
    // → else branch at line 209 fires (no prisma.horse.update called)
    const result = await checkForMilestones(cm1Horse.id, 0, 8);
    expect(result.milestonesTriggered).toContain('age_1_trait_evaluation');
    expect(result.traitsAssigned).toEqual([]);
    expect(result.retirementTriggered).toBe(false);
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// calculateAgeFromBirth leap-year and time-of-day edge cases not covered by the
// day-delta tests above. Pure (no DB), explicit dates.
describe('calculateAgeFromBirth — leap-year & time-of-day edge cases (merged from legacy backend/tests, Equoria-wvuin)', () => {
  it('counts a leap day: Feb 29 2024 → Mar 1 2025 is 366 days', () => {
    const birth = new Date('2024-02-29T12:00:00Z');
    const now = new Date('2025-03-01T12:00:00Z');
    expect(calculateAgeFromBirth(birth, now)).toBe(366);
  });

  it('returns 0 when birth and now are the same calendar day at different times', () => {
    const birth = new Date('2025-06-01T01:00:00Z');
    const now = new Date('2025-06-01T23:00:00Z');
    expect(calculateAgeFromBirth(birth, now)).toBe(0);
  });
});
