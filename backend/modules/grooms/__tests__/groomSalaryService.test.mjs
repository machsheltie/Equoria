/**
 * groomSalaryService branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * Pure-function tests (no DB):
 *   calculateWeeklySalary — all skill levels, specialty bonuses, unknown-key fallbacks, catch-block
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
  SALARY_CONFIG,
  calculateWeeklySalary,
  getSalaryPaymentHistory,
  calculateUserSalaryCost,
} from '../services/groomSalaryService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

// ── calculateWeeklySalary — pure branches ─────────────────────────────────────

describe('calculateWeeklySalary — all skill-level branches', () => {
  it('novice → 50', () => {
    expect(calculateWeeklySalary({ skillLevel: 'novice', speciality: 'general' })).toBe(50);
  });

  it('intermediate → 75', () => {
    expect(calculateWeeklySalary({ skillLevel: 'intermediate', speciality: 'general' })).toBe(75);
  });

  it('expert → 100', () => {
    expect(calculateWeeklySalary({ skillLevel: 'expert', speciality: 'general' })).toBe(100);
  });

  it('master → 150', () => {
    expect(calculateWeeklySalary({ skillLevel: 'master', speciality: 'general' })).toBe(150);
  });

  it('unknown skillLevel falls back to novice (50)', () => {
    // SALARY_CONFIG.WEEKLY_SALARIES['unknown'] = undefined → || novice branch
    expect(calculateWeeklySalary({ skillLevel: 'unknown', speciality: 'general' })).toBe(50);
  });
});

describe('calculateWeeklySalary — specialty bonus branches', () => {
  it('foalCare specialty adds 10', () => {
    expect(calculateWeeklySalary({ skillLevel: 'novice', speciality: 'foalCare' })).toBe(
      SALARY_CONFIG.WEEKLY_SALARIES.novice + SALARY_CONFIG.SPECIALTY_BONUSES.foalCare,
    );
    expect(calculateWeeklySalary({ skillLevel: 'novice', speciality: 'foalCare' })).toBe(60);
  });

  it('showHandling specialty adds 15', () => {
    expect(calculateWeeklySalary({ skillLevel: 'novice', speciality: 'showHandling' })).toBe(65);
  });

  it('general specialty adds 0 (falsy path of || 0)', () => {
    // SPECIALTY_BONUSES.general = 0 → falsy → || 0 branch taken
    expect(calculateWeeklySalary({ skillLevel: 'novice', speciality: 'general' })).toBe(50);
  });

  it('unknown specialty falls back to 0 (|| 0 branch)', () => {
    expect(calculateWeeklySalary({ skillLevel: 'novice', speciality: 'unknown' })).toBe(50);
  });

  it('master + showHandling combination = 165', () => {
    expect(calculateWeeklySalary({ skillLevel: 'master', speciality: 'showHandling' })).toBe(165);
  });
});

describe('calculateWeeklySalary — catch-block branch', () => {
  it('returns novice salary when skillLevel access throws (catch block at line 50)', () => {
    // Proxy: id is accessible (for logger in catch), but skillLevel throws
    // → try block fails → catch branch taken → returns WEEKLY_SALARIES.novice
    const throwingGroom = new Proxy(
      { id: 'test-groom-id' },
      {
        get(target, prop) {
          if (prop === 'skillLevel') {
            throw new Error('skillLevel access bomb');
          }
          return target[prop];
        },
      },
    );
    expect(calculateWeeklySalary(throwingGroom)).toBe(SALARY_CONFIG.WEEKLY_SALARIES.novice);
    expect(calculateWeeklySalary(throwingGroom)).toBe(50);
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

  it('returns non-zero totalWeeklyCost and one breakdown entry for expert+showHandling', async () => {
    const result = await calculateUserSalaryCost(gssUser.id);
    // expert(100) + showHandling(15) = 115
    expect(result.totalWeeklyCost).toBe(115);
    expect(result.groomCount).toBe(1);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].groomId).toBe(gssGroom.id);
    expect(result.breakdown[0].groomName).toBe(gssGroom.name);
    expect(result.breakdown[0].skillLevel).toBe('expert');
    expect(result.breakdown[0].speciality).toBe('showHandling');
    expect(result.breakdown[0].weeklySalary).toBe(115);
  });
});
