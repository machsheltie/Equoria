/**
 * Groom bonus eligibility counts Eastern game days — Equoria-kha18 (item 1).
 *
 * Owner ruling (Stacey, repeated 2026-10-09): every day count is an Eastern
 * calendar day, never a millisecond delta. checkBonusEligibility sizes its
 * milestone window as the foal's Eastern age in days (capped at 30), but then
 * opened it at `now - days * 24h` and counted each assignment's coverage as
 * whole 24-hour spans. From 20:00 to 24:00 EDT (19:00–24:00 EST) that window
 * opens in the evening of the first game day, so assignments and interactions
 * from earlier that day fell outside it, and an assignment begun late on a
 * game day lost that day from its coverage.
 *
 * Instants pinned inside the window:
 *   - summer: 2026-10-17T00:30Z = Fri 2026-10-16 20:30 EDT
 *   - winter: 2026-12-12T03:30Z = Fri 2026-12-11 22:30 EST
 *
 * Only Date is faked; every timer Prisma and pg rely on stays real.
 * Real database, real service. No mocks.
 */

import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { checkBonusEligibility } from '../services/groomBonusTraitService.mjs';
import { gameCalendarDate, gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const PREFIX = `TestFixture-kha18g-${randomBytes(4).toString('hex')}`;
const HOUR_MS = 60 * 60 * 1000;

const EVENINGS = [
  ['summer, 20:30 EDT', new Date('2026-10-17T00:30:00.000Z')],
  ['winter, 22:30 EST', new Date('2026-12-12T03:30:00.000Z')],
];

const REAL_EXCEPT_DATE = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
];

/** Run `fn` with the wall clock (Date only) frozen at `instant`. */
async function at(instant, fn) {
  jest.useFakeTimers({ now: instant, doNotFake: REAL_EXCEPT_DATE });
  try {
    return await fn();
  } finally {
    jest.useRealTimers();
  }
}

/** The instant `hours` after 00:00 Eastern on the game day `offsetDays` from `now`'s. */
const easternHour = (now, offsetDays, hours) =>
  new Date(startOfGameDayIndex(gameDayIndex(now) + offsetDays).getTime() + hours * HOUR_MS);

const horseIds = [];
let owner;
let groomSeq = 0;

async function makeFoal(now, ageDays) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}-foal-${horseIds.length}`,
      sex: 'Filly',
      age: 0,
      dateOfBirth: gameCalendarDate(now, -ageDays),
      userId: owner.id,
    },
  });
  horseIds.push(horse.id);
  return horse;
}

function makeGroom() {
  groomSeq += 1;
  return prisma.groom.create({
    data: {
      name: `${PREFIX}-groom-${groomSeq}`,
      speciality: 'foalCare',
      personality: 'gentle',
      userId: owner.id,
    },
  });
}

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      emailVerified: true,
      username: PREFIX,
      email: `${PREFIX}@example.com`,
      password: 'irrelevant-hash',
      firstName: 'Evening',
      lastName: 'Bonus',
    },
  });
});

afterAll(async () => {
  const cleanup = createCleanupTracker();
  cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { foalId: { in: horseIds } } }), 'interactions');
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { foalId: { in: horseIds } } }), 'assignments');
  if (owner) {
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: owner.id } }), 'grooms');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
  }
  await cleanup.run();
}, 120000);

describe.each(EVENINGS)('groom bonus eligibility on Eastern game days (%s) — Equoria-kha18', (_label, now) => {
  it("the milestone window opens at 00:00 Eastern on the foal's birth day, so that morning's assignment and interaction count", async () => {
    const foal = await makeFoal(now, 10);
    const groom = await makeGroom();
    const birthMorning = easternHour(now, -10, 9); // 09:00 Eastern on the birth day
    await prisma.groomAssignment.create({
      data: { foalId: foal.id, groomId: groom.id, startDate: birthMorning, isActive: true },
    });
    await prisma.groomInteraction.create({
      data: {
        foalId: foal.id,
        groomId: groom.id,
        interactionType: 'grooming',
        duration: 30,
        bondingChange: 10,
        timestamp: birthMorning,
      },
    });

    const result = await at(now, () => checkBonusEligibility(foal.id, groom.id));

    expect(result).toMatchObject({
      milestoneWindowDays: 10,
      totalCoverageDays: 10,
      interactionCount: 1,
      averageBondScore: 60,
      eligible: true,
    });
  });

  it('an assignment begun late on a game day covers that day', async () => {
    const foal = await makeFoal(now, 4);
    const groom = await makeGroom();
    // 23:00 Eastern three game days ago, still running: covers 3 game days.
    await prisma.groomAssignment.create({
      data: {
        foalId: foal.id,
        groomId: groom.id,
        startDate: easternHour(now, -3, 23),
        isActive: true,
      },
    });

    const result = await at(now, () => checkBonusEligibility(foal.id, groom.id));

    expect(result).toMatchObject({ milestoneWindowDays: 4, totalCoverageDays: 3 });
  });

  // An empty window (foal born today, Eastern) has no coverage to measure. The
  // result was 0 / 0 = NaN, which already failed the 75% check; it is now 0, so
  // the same "not eligible" outcome is stated instead of falling out of NaN.
  it('a foal born today has an empty window: coverage 0, not eligible', async () => {
    const foal = await makeFoal(now, 0);
    const groom = await makeGroom();
    const thisMorning = easternHour(now, 0, 9);
    await prisma.groomAssignment.create({
      data: { foalId: foal.id, groomId: groom.id, startDate: thisMorning, isActive: true },
    });
    await prisma.groomInteraction.create({
      data: {
        foalId: foal.id,
        groomId: groom.id,
        interactionType: 'grooming',
        duration: 30,
        bondingChange: 10,
        timestamp: thisMorning,
      },
    });

    const result = await at(now, () => checkBonusEligibility(foal.id, groom.id));

    expect(result).toMatchObject({
      milestoneWindowDays: 0,
      totalCoverageDays: 0,
      coveragePercentage: 0,
      averageBondScore: 60,
      eligible: false,
      reason: 'Insufficient assignment coverage',
    });
  });
});

// The change is not confined to the evening (Equoria-kha18 review). Calendar-day
// semantics shift eligibility at EVERY hour: the window used to open at
// now - N x 24h and coverage was floor(delta / 24h). This pins the reviewer's
// daytime scenario at 15:00 Eastern. Kept as the owner's day-boundary ruling;
// awaiting her confirmation.
const DAYTIMES = [
  ['summer, 15:00 EDT', new Date('2026-10-16T19:00:00.000Z')],
  ['winter, 15:00 EST', new Date('2026-12-11T20:00:00.000Z')],
];

describe.each(DAYTIMES)('groom bonus eligibility on Eastern game days at %s — the all-hours shift', (_label, now) => {
  it('a 4-game-day-old foal: a 23:00 assignment three game days ago covers 3 of 4 days (was 2, 50%), a 09:00 birth-day interaction counts (was outside), so eligible', async () => {
    const foal = await makeFoal(now, 4);
    const groom = await makeGroom();
    await prisma.groomAssignment.create({
      data: {
        foalId: foal.id,
        groomId: groom.id,
        startDate: easternHour(now, -3, 23),
        isActive: true,
      },
    });
    await prisma.groomInteraction.create({
      data: {
        foalId: foal.id,
        groomId: groom.id,
        interactionType: 'grooming',
        duration: 30,
        bondingChange: 10,
        timestamp: easternHour(now, -4, 9),
      },
    });

    const result = await at(now, () => checkBonusEligibility(foal.id, groom.id));

    // Old rolling count: floor(2d 16h / 24h) = 2 days = 50%; the window opened at
    // 15:00 on the birth day, after the 09:00 interaction (bond 50, not eligible).
    expect(result).toMatchObject({
      milestoneWindowDays: 4,
      totalCoverageDays: 3,
      coveragePercentage: 0.75,
      interactionCount: 1,
      averageBondScore: 60,
      eligible: true,
    });
  });
});
