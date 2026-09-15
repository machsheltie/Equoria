/**
 * groomSalaryService branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * Pure-function tests (no DB):
 *   calculateWeeklyFee — $70 per assigned horse (Equoria-95yrv, owner ruling
 *   2026-09-14). The skill/specialty rate table these tests used to walk
 *   (50/75/100/150 + 0/10/15) no longer exists: the fee is priced per horse and
 *   no longer depends on who the groom is, so those branches were deleted with
 *   the code they covered rather than re-pointed at a number nobody charges.
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
  FEE_PER_HORSE_PER_WEEK,
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

// ── calculateWeeklyFee — pure branches (Equoria-95yrv) ───────────────────────

describe('calculateWeeklyFee — $70 per horse assigned', () => {
  it('charges the flat per-horse rate, whatever the groom is', () => {
    expect(FEE_PER_HORSE_PER_WEEK).toBe(70);
    expect(calculateWeeklyFee(1)).toBe(70);
    expect(calculateWeeklyFee(4)).toBe(280);
    expect(calculateWeeklyFee(MAX_HORSES_PER_GROOM)).toBe(700);
  });

  it('a groom on no horses costs nothing', () => {
    expect(calculateWeeklyFee(0)).toBe(0);
  });

  it('treats a missing or nonsense count as no horses rather than inventing a fee', () => {
    expect(calculateWeeklyFee(undefined)).toBe(0);
    expect(calculateWeeklyFee(null)).toBe(0);
    expect(calculateWeeklyFee(-3)).toBe(0);
    expect(calculateWeeklyFee('not a number')).toBe(0);
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

    gssUser = await prisma.user.create({
      data: {
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
        userId: gssUser.id,
      },
    });

    gssHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-GSS-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: gssUser.id,
      },
    });

    await prisma.groomAssignment.create({
      data: {
        foalId: gssHorse.id,
        groomId: gssGroom.id,
        userId: gssUser.id,
        isActive: true,
      },
    });

    // Scoped, fail-loud cleanup (Equoria-1ohys): swallowed catch arms replaced
    // by the tracker so a failed delete fails the suite. FK order — horse then
    // groom (each cascades the GroomAssignment child: foalId and groomId are
    // both onDelete: Cascade), then the user last (Horse.userId + Groom.userId
    // are Restrict).
    cleanup.add(() => prisma.horse.delete({ where: { id: gssHorse.id } }), 'horse');
    cleanup.add(() => prisma.groom.delete({ where: { id: gssGroom.id } }), 'groom');
    cleanup.add(() => prisma.user.delete({ where: { id: gssUser.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('charges one horse at the per-horse rate, whatever the skill of the groom', async () => {
    const result = await calculateUserSalaryCost(gssUser.id);
    // Equoria-95yrv: one assigned horse = $70. It used to be expert(100) +
    // showHandling(15) = 115; skill and specialty no longer price the fee.
    expect(result.totalWeeklyCost).toBe(70);
    expect(result.groomCount).toBe(1);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].groomId).toBe(gssGroom.id);
    expect(result.breakdown[0].groomName).toBe(gssGroom.name);
    expect(result.breakdown[0].skillLevel).toBe('expert');
    expect(result.breakdown[0].speciality).toBe('showHandling');
    expect(result.breakdown[0].assignedHorses).toBe(1);
    expect(result.breakdown[0].weeklyFee).toBe(70);
  });
});
