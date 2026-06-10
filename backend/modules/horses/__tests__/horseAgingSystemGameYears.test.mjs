/**
 * Equoria-son6 / Equoria-j9ip — Horse aging cron writes game-years (not days)
 * to Horse.age.
 *
 * Per game design: 1 real-time week = 1 game year, so the stored value must
 * be `Math.floor(ageInDays / 7)`. The pre-fix bug was: cron wrote ageInDays
 * directly, producing 1111-year displays in the UI.
 *
 * These tests pin the corrected semantics literally:
 *   - DOB 14 days ago → Horse.age === 2 (game-years)
 *   - DOB 1107 days ago → Horse.age === 158 (game-years, NOT 1107)
 *   - calculateAgeInGameYears() helper exists and returns floor(days/7)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { calculateAgeInGameYears, updateHorseAge } from '../../../utils/horseAgingSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-dm1i: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const daysAgo = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

describe('calculateAgeInGameYears (Equoria-son6)', () => {
  it('returns 0 for DOB today', () => {
    expect(calculateAgeInGameYears(new Date())).toBe(0);
  });

  it('returns 0 for DOB 6 days ago (less than 1 game year)', () => {
    expect(calculateAgeInGameYears(daysAgo(6))).toBe(0);
  });

  it('returns 1 for DOB 7 days ago (exactly 1 game year)', () => {
    expect(calculateAgeInGameYears(daysAgo(7))).toBe(1);
  });

  it('returns 2 for DOB 14 days ago (AC literal)', () => {
    expect(calculateAgeInGameYears(daysAgo(14))).toBe(2);
  });

  it('returns 21 for DOB 147 days ago (retirement age)', () => {
    expect(calculateAgeInGameYears(daysAgo(147))).toBe(21);
  });

  it('returns 158 for DOB 1107 days ago (AC literal — NOT 1107)', () => {
    expect(calculateAgeInGameYears(daysAgo(1107))).toBe(158);
  });

  it('returns 0 for future birth date (fail-safe)', () => {
    const future = new Date(Date.now() + 86400000);
    expect(calculateAgeInGameYears(future)).toBe(0);
  });
});

describe('updateHorseAge writes game-years to Horse.age (Equoria-son6)', () => {
  let fixtureUser;
  let horse14d;
  let horse1107d;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    fixtureUser = await prisma.user.create({
      data: {
        email: `son6-${ts}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        username: `son6fix${ts}${Math.random().toString(36).slice(2, 6)}`,
        password: 'irrelevant-hash',
        firstName: 'son6',
        lastName: 'Fixture',
        money: 0,
      },
    });

    horse14d = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-son6-14d-${ts}`,
        sex: 'Filly',
        dateOfBirth: daysAgo(14),
        age: 0, // pretend cron hasn't run yet
        userId: fixtureUser.id,
      },
    });

    horse1107d = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-son6-1107d-${ts}`,
        sex: 'Mare',
        dateOfBirth: daysAgo(1107),
        age: 1107, // simulate the corrupted-DB state (cron wrote days)
        userId: fixtureUser.id,
      },
    });

    // Scoped, fail-loud cleanup (Equoria-pemoo): horses by name-prefix, then user.
    cleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-son6-' } } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: fixtureUser.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('writes 2 (game-years) for a horse with DOB 14 days ago', async () => {
    const result = await updateHorseAge(horse14d.id);
    expect(result.newAge).toBe(2);

    const persisted = await prisma.horse.findUnique({ where: { id: horse14d.id } });
    expect(persisted.age).toBe(2);
  });

  it('writes 158 (game-years) for a horse with DOB 1107 days ago — fixes the 1111-year bug', async () => {
    const result = await updateHorseAge(horse1107d.id);
    expect(result.newAge).toBe(158);

    const persisted = await prisma.horse.findUnique({ where: { id: horse1107d.id } });
    expect(persisted.age).toBe(158);
    // Sentinel: definitively NOT the day-count
    expect(persisted.age).not.toBe(1107);
  });

  it('is idempotent: re-running on an already-correct row makes no DB change', async () => {
    // After the previous test, horse14d has age=2 stored. Re-run should early-return.
    const result = await updateHorseAge(horse14d.id);
    expect(result.ageUpdated).toBe(false);
    expect(result.newAge).toBe(2);
  });
});
