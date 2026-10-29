/**
 * groomSalaryService branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * Pure-function tests (no DB):
 *   calculateWeeklyFee — the groom's star level price per week (owner ruling
 *   2026-10-28, q228, which replaced the 70-per-horse basis of Equoria-95yrv; these
 *   cases were rewritten to the new contract).
 *
 * DB-path tests (no fixture — non-existent IDs return empty / zero):
 *   getSalaryPaymentHistory — returns [] for non-existent user
 *   calculateUserSalaryCost — returns zero shape for non-existent user
 *
 * DB-fixture test:
 *   calculateUserSalaryCost with real GroomAssignment → returns non-zero breakdown
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  MAX_HORSES_PER_GROOM,
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

// ── calculateWeeklyFee — pure branches (owner ruling 2026-10-28, q228) ───────

describe('calculateWeeklyFee — the groom star level price, per groom per week', () => {
  it('charges the level price, whatever the groom is working', () => {
    expect(calculateWeeklyFee({ starLevel: 'rookie' })).toBe(100);
    expect(calculateWeeklyFee({ starLevel: 'expert' })).toBe(500);
    // Owner ruling 2026-10-26 (q68): the horse cap stays twenty.
    expect(MAX_HORSES_PER_GROOM).toBe(20);
  });

  it('refuses a missing or nonsense level rather than inventing a fee', () => {
    expect(() => calculateWeeklyFee(undefined)).toThrow('Unknown staff level');
    expect(() => calculateWeeklyFee({ starLevel: 'master' })).toThrow('Unknown staff level');
  });
});

// ── DB path tests — non-existent UUID returns empty results ───────────────────

describe('getSalaryPaymentHistory — non-existent user', () => {
  it('returns empty array for user id that does not exist', async () => {
    const result = await getSalaryPaymentHistory('00000000-0000-0000-0000-000000000099');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('respects limit parameter (no error for any positive limit)', async () => {
    const result = await getSalaryPaymentHistory('00000000-0000-0000-0000-000000000099', 10);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('calculateUserSalaryCost — non-existent user', () => {
  it('returns zero-cost shape when user has no active assignments', async () => {
    const result = await calculateUserSalaryCost('00000000-0000-0000-0000-000000000099');
    expect(result.totalWeeklyCost).toBe(0);
    expect(result.groomCount).toBe(0);
    expect(Array.isArray(result.breakdown)).toBe(true);
    expect(result.breakdown).toHaveLength(0);
  });
});

// ── DB fixture — calculateUserSalaryCost with real assignment ─────────────────

describe('calculateUserSalaryCost — DB fixture (Equoria-jkht)', () => {
  let gssUser;
  let gssGroom;
  let gssHorse;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    // Scoped, fail-loud cleanup (Equoria-1ohys): swallowed catch arms replaced
    // by the tracker so a failed delete fails the suite. FK order — horse then
    // groom (each cascades the GroomAssignment child: foalId and groomId are
    // both onDelete: Cascade), then the user last (Horse.userId + Groom.userId
    // are Restrict).
    cleanup.add(() => prisma.horse.delete({ where: { id: gssHorse.id } }), 'horse');
    cleanup.add(() => prisma.groom.delete({ where: { id: gssGroom.id } }), 'groom');
    cleanup.add(() => prisma.user.delete({ where: { id: gssUser.id } }), 'user');

    gssUser = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `gss-${ts}-${rand()}@test.com`,
        username: `gss${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GSS',
        lastName: 'Tester',
        money: 500,
      },
    });

    gssGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GSS-Groom-${ts}`,
        speciality: 'showHandling',
        personality: 'gentle',
        skillLevel: 'expert',
        starLevel: 'advanced',
        userId: gssUser.id,
      },
    });

    gssHorse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `TestFixture-GSS-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: gssUser.id,
      }),
    });

    await prisma.groomAssignment.create({
      data: {
        foalId: gssHorse.id,
        groomId: gssGroom.id,
        userId: gssUser.id,
        isActive: true,
      },
    });
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it("charges the groom's star level price, whatever the skill or horses (q228)", async () => {
    const result = await calculateUserSalaryCost(gssUser.id);
    // Owner ruling 2026-10-28 (q228): an Advanced groom = 400 a week. It was 70 per
    // horse under Equoria-95yrv; the ruling changed it.
    expect(result.totalWeeklyCost).toBe(400);
    expect(result.groomCount).toBe(1);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].groomId).toBe(gssGroom.id);
    expect(result.breakdown[0].groomName).toBe(gssGroom.name);
    expect(result.breakdown[0].skillLevel).toBe('expert');
    expect(result.breakdown[0].speciality).toBe('showHandling');
    expect(result.breakdown[0].assignedHorses).toBe(1);
    expect(result.breakdown[0].weeklyFee).toBe(400);
  });
});
