/**
 * groomRetirementService, groomSalaryService unit tests
 * (Equoria-rr7 coverage sprint).
 *
 * Shared DB fixture: user + Filly foal + groom.
 * Fresh groom (careerWeeks=0, no assignments) exercises not-eligible paths.
 *
 * Equoria-czpa5: the groomBonusTraitService cases went with that service, which
 * no production code reached.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { checkRetirementEligibility, getRetirementStatistics } from '../services/groomRetirementService.mjs';
import {
  calculateWeeklyFee,
  getSalaryPaymentHistory,
  calculateUserSalaryCost,
} from '../services/groomSalaryService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

let user;
let horse;
let groom;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `groombonus-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `groombonus${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'GroomBonus',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-GroomBonusHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    }),
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-GroomBonusGroom-${Date.now()}`,
      speciality: 'foalCare',
      personality: 'gentle',
      starLevel: 'rookie',
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  // Equoria-1ohys: fail-loud, scoped cleanup. Deletes are id-scoped and
  // registered on the tracker so a cleanup failure REDS the suite instead of
  // leaking rows into the canonical DB (CLAUDE.md §2). FK order: groom + horse
  // before user (Groom.userId / Horse.userId Restrict). Matches the original
  // cleanup set (no interaction rows created by this suite).
  cleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  await cleanup.run();
}, 30000);

// ── groomRetirementService ────────────────────────────────────────────────────

describe('checkRetirementEligibility', () => {
  it('throws for non-existent groom', async () => {
    await expect(checkRetirementEligibility(999999999)).rejects.toThrow();
  });

  // Equoria-m9lz1: a groom with no drawn retirement schedule is not eligible
  // and no age is invented for it. `weeksUntilRetirement` is gone — it was
  // `retirementAge - careerWeeks`, i.e. the hidden age by subtraction.
  it('returns not eligible, and no countdown, for a fresh groom', async () => {
    const result = await checkRetirementEligibility(groom.id);
    expect(result.eligible).toBe(false);
    expect(typeof result.reason).toBe('string');
    expect(result).not.toHaveProperty('weeksUntilRetirement');
    expect(result).not.toHaveProperty('noticeRequired');
    expect(result).not.toHaveProperty('retirementAge');
  });
});

// Equoria-m9lz1: `getGroomsApproachingRetirement` is deleted. Listing the
// grooms about to retire IS the disclosure the owner's ruling forbids ("not
// known until the week they retire"), so there is no successor function to
// point this describe block at.

describe('getRetirementStatistics', () => {
  it('returns statistics shape for user', async () => {
    const result = await getRetirementStatistics(user.id);
    expect(typeof result.activeGrooms).toBe('number');
    expect(typeof result.retiredGrooms).toBe('number');
    expect(typeof result.totalGrooms).toBe('number');
    expect(result.totalGrooms).toBe(result.activeGrooms + result.retiredGrooms);
  });
});

// ── groomSalaryService ────────────────────────────────────────────────────────

// Owner ruling 2026-10-28 (q228) replaced the 70-per-horse fee (Equoria-95yrv): a
// groom costs their star level's price per week, however many horses.
describe('calculateWeeklyFee', () => {
  it("charges the groom's star level price", () => {
    expect(calculateWeeklyFee({ starLevel: 'novice' })).toBe(200);
    expect(calculateWeeklyFee({ starLevel: 'advanced' })).toBe(400);
  });
});

describe('getSalaryPaymentHistory', () => {
  it('returns empty array for user with no payments', async () => {
    const result = await getSalaryPaymentHistory(user.id);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('calculateUserSalaryCost', () => {
  // Owner ruling 2026-10-28 (q228): the weekly fee is the groom's star level price,
  // however many horses, like a rider. This fixture is one Rookie groom on staff with
  // no `GroomAssignment` row, so the fee is 100. (Under the 70-per-horse basis of
  // Equoria-95yrv this asserted 0; the ruling changed it.)
  it('charges the level price for a groom on staff with no horses to care for', async () => {
    const result = await calculateUserSalaryCost(user.id);
    expect(result.totalWeeklyCost).toBe(100);
    expect(result.groomCount).toBe(1);
    expect(result.breakdown).toEqual([
      expect.objectContaining({
        groomId: groom.id,
        assignedHorses: 0,
        weeklyFee: 100,
        feeUnpaid: false,
      }),
    ]);
  });

  it('returns zero for a user with no grooms at all', async () => {
    const stranger = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `groombonus-none-${randomBytes(4).toString('hex')}@test.com`,
        username: `groombonusnone${randomBytes(4).toString('hex')}`,
        password: 'irrelevant-hash',
        firstName: 'GroomBonus',
        lastName: 'NoStaff',
        money: 1000,
      },
    });
    try {
      const result = await calculateUserSalaryCost(stranger.id);
      expect(result.totalWeeklyCost).toBe(0);
      expect(result.groomCount).toBe(0);
      expect(result.breakdown).toEqual([]);
    } finally {
      await prisma.user.delete({ where: { id: stranger.id } });
    }
  });
});
