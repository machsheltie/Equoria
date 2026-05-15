/**
 * Horse Aging Weekly Regression — Integration Test (Equoria-j6jv)
 *
 * NOTE ON FILENAME: Equoria-j6jv requested `horseAging.spec.mjs`, but
 * backend/jest.config.mjs testMatch is ['**\/*.test.mjs','**\/*.test.js']
 * — a `.spec.mjs` file is silently NOT discovered by the runner, so it
 * would pass zero assertions and never act as a regression net. The
 * canonical, discoverable path is `.test.mjs`; that is used here so the
 * sentinel actually runs in CI (AC: "All 5 assertions pass", "<30s").
 *
 * 🎯 WHY THIS EXISTS
 * Two real defects shipped without a test that would have caught them:
 *   - Equoria-son6: the cron wrote ageInDays into Horse.age, which every
 *     other layer treats as game-YEARS (1 game year = 7 real-time days).
 *     A horse 1107 days old displayed as "1107 years".
 *   - Equoria-yzz5: the aging cron was never wired up at all.
 *
 * This is the sentinel-positive regression net for the unit semantics
 * (OPTIMAL_FIX_DISCIPLINE.md §2). The final assertion (1107 real-time
 * days → 158 game-years, NOT 1107) is the tripwire: any future commit
 * that restores `horse.age = ageInDays` makes assertion 5 fail loudly.
 *
 * 🧪 APPROACH (CLAUDE.md test discipline)
 * - REAL test DB, no Prisma mocking. Scoped fixtures (name startsWith
 *   'AgingRegression-') with a scoped where-clause cleanup so real game
 *   state is never touched (CLAUDE.md rule 2).
 * - No global Date mocking: production aging code calls
 *   calculateAgeFromBirth(dob) with the real `new Date()` default. We
 *   pin determinism by setting dateOfBirth = now - N days (+ a few hours
 *   buffer so we never land on a midnight floor boundary), then running
 *   the real cronJobService.manualHorseAging and reading Horse.age back.
 *   "now = dob + N days" and "dob = now - N days" are arithmetically the
 *   same input to floor((now-dob)/7); the latter avoids the brittle
 *   global.Date override.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../db/index.mjs';
import cronJobService from '../../services/cronJobs.mjs';

const NAME_PREFIX = 'AgingRegression-';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// A few hours of slack so a multi-second test run can never cross a
// floor(days) boundary between fixture creation and the cron read.
const BUFFER_MS = 6 * 60 * 60 * 1000;

describe('Horse weekly aging — integration regression (Equoria-j6jv)', () => {
  let testUser;
  let testBreed;
  const createdHorseIds = [];

  const scopedCleanup = async () => {
    // Scoped by name prefix AND by the ids we created — never a bare
    // deleteMany() (CLAUDE.md rule 2: scoped cleanup only).
    if (createdHorseIds.length > 0) {
      await prisma.horse.deleteMany({
        where: { id: { in: createdHorseIds }, name: { startsWith: NAME_PREFIX } },
      });
    }
    if (testBreed) {
      await prisma.breed.deleteMany({ where: { id: testBreed.id } });
    }
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  };

  beforeAll(async () => {
    const tag = `${randomBytes(6).toString('hex')}`;
    testUser = await prisma.user.create({
      data: {
        id: `agingreg-user-${tag}`,
        username: `agingreguser_${tag}`,
        email: `agingreg_${tag}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Aging',
        lastName: 'Regression',
        money: 1000,
      },
    });
    testBreed = await prisma.breed.create({
      data: { name: `${NAME_PREFIX}Breed ${tag}`, description: 'aging regression fixture' },
    });
  });

  afterAll(async () => {
    await scopedCleanup();
  });

  /**
   * Create a fixture horse aged `daysOld` real-time days, run the real
   * aging cron scoped to that horse, and return the persisted Horse.age.
   * Stored age starts at 0 so the cron always detects a change to write.
   */
  const ageHorseByDays = async (label, daysOld) => {
    const dateOfBirth = new Date(Date.now() - daysOld * MS_PER_DAY - BUFFER_MS);
    const horse = await prisma.horse.create({
      data: {
        name: `${NAME_PREFIX}${label}-${randomBytes(4).toString('hex')}`,
        sex: 'Colt',
        dateOfBirth,
        age: 0, // game-years; cron recomputes from dateOfBirth
        userId: testUser.id,
        breedId: testBreed.id,
      },
    });
    createdHorseIds.push(horse.id);

    const result = await cronJobService.manualHorseAging({ horseIds: [horse.id] });
    expect(result.errors).toBe(0);

    const refreshed = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { age: true },
    });
    return refreshed.age;
  };

  it('1) horse born today → age 0 game-years', async () => {
    expect(await ageHorseByDays('born-today', 0)).toBe(0);
  });

  it('2) horse 6 real-time days old → age 0 (not yet one full game-year week)', async () => {
    expect(await ageHorseByDays('six-days', 6)).toBe(0);
  });

  it('3) horse 7 real-time days old → age 1 game-year (weekly anniversary)', async () => {
    expect(await ageHorseByDays('seven-days', 7)).toBe(1);
  });

  it('4) horse 14 real-time days old → age 2 game-years', async () => {
    expect(await ageHorseByDays('fourteen-days', 14)).toBe(2);
  });

  it('5) SENTINEL: horse 1107 real-time days old → age 158 game-years (NOT 1107)', async () => {
    // floor(1107 / 7) = 158. If a future commit reintroduces
    // `horse.age = ageInDays`, this returns 1107 and the test fails —
    // exactly the Equoria-son6 defect, caught at the unit boundary.
    const age = await ageHorseByDays('sentinel-1107', 1107);
    expect(age).toBe(158);
    expect(age).not.toBe(1107);
  });
});
