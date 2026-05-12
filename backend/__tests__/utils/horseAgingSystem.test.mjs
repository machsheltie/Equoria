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
} from '../../utils/horseAgingSystem.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

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
        name: `TestFixture-HAS-Current-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: fixtureUser.id,
      },
    });

    // Horse born 1 day ago, stored age=0 → calculatedAge=1 !== storedAge → DB update (lines 109-135)
    staleAgeHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-HAS-Stale-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        age: 0,
        userId: fixtureUser.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-HAS-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: fixtureUser.id } }).catch(() => {});
  }, 30000);

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
// Covers the if(horse) block and both eligibility branches:
//   not-eligible (303-306): horse.age=0 → Math.floor(0/365)=0 → not in MILESTONE_AGES
//   eligible+success (254-296): horse.age=365 → Math.floor(365/365)=1 → in MILESTONE_AGES

describe('checkForMilestones() — milestone age 14 DB-fixture paths (lines 250-308) (Equoria-rr7)', () => {
  let masUser;
  let masHorseNotEligible;
  let masHorseEligible;

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
    // age=0: Math.floor(0/365)=0 → not in MILESTONE_AGES → eligible:false → not-eligible branch
    masHorseNotEligible = await prisma.horse.create({
      data: {
        name: `TestFixture-MAS-NotElig-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: masUser.id,
      },
    });
    // age=365: Math.floor(365/365)=1 → in MILESTONE_AGES, no prior milestone → eligible:true → success branch
    masHorseEligible = await prisma.horse.create({
      data: {
        name: `TestFixture-MAS-Eligible-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        age: 365,
        userId: masUser.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-MAS-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: masUser.id } }).catch(() => {});
  }, 30000);

  it('enters if(horse) block and not-eligible branch (lines 250, 303-306) when horse.age=0', async () => {
    const result = await checkForMilestones(masHorseNotEligible.id, 13, 14);
    expect(Array.isArray(result.milestonesTriggered)).toBe(true);
    expect(result.retirementTriggered).toBe(false);
    expect(result.traitsAssigned).toEqual([]);
  });

  it('enters if(horse) block and eligible+success branch (lines 254-296) when horse.age=365', async () => {
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
    // born 1 day ago, age=0 → calculatedAge(1) !== storedAge(0) → birthdaysFound++ then dryRun branch
    pbHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-PB-DryRun-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        age: 0,
        userId: pbUser.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-PB-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: pbUser.id } }).catch(() => {});
  }, 30000);

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
        name: `TestFixture-CM1-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        age: 0,
        userId: cm1User.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-CM1-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: cm1User.id } }).catch(() => {});
  }, 30000);

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
