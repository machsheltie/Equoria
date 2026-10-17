/**
 * The Eastern evening window — Equoria-4urzd.
 *
 * Owner ruling (Stacey, repeated 2026-10-09): every game day is an Eastern
 * calendar day. From 20:00 to 24:00 EDT (19:00–24:00 EST) the UTC calendar is
 * already on the next date, so any day count that reads one side on the UTC
 * calendar and the other on the Eastern one is off by one for those hours.
 * On 2026-10-17 at 00:00 UTC CI hit exactly that: ages, foal development days,
 * the dam cooldown and groom availability all failed, because test fixtures
 * wrote date-only columns from `Date.now() - N days` (the UTC date) while the
 * game reads them against today's Eastern date.
 *
 * This file pins the clock INSIDE that window, so it checks the evening at any
 * hour of the day the suite runs:
 *   - summer: 2026-10-17T00:30Z = Fri 2026-10-16 20:30 EDT (UTC already Saturday)
 *   - winter: 2026-12-12T03:30Z = Fri 2026-12-11 22:30 EST (UTC already Saturday)
 * Each case also proves the instant really is in the window: the UTC-date
 * fixture pattern reads one day short there.
 *
 * Only Date is faked; every timer Prisma and pg rely on stays real.
 * Real database, real job functions. No mocks.
 */

import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../packages/database/prismaClient.mjs';
import cronJobService from '../services/cronJobs.mjs';
import { isGroomAvailableToday } from '../utils/dailyCareAutomation.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';
import { birthDateForAge, getHorseAgeDays, getHorseAgeYears } from '../utils/horseAge.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { cleanupTestHorses } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const PREFIX = `TestFixture-4urzd-${randomBytes(4).toString('hex')}`;
const DAY_MS = 24 * 60 * 60 * 1000;

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

const createdHorseIds = [];
let owner;

async function makeHorse(data) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}-${createdHorseIds.length}`,
      sex: 'Filly',
      age: 0,
      bondScore: 50,
      stressLevel: 20,
      user: { connect: { id: owner.id } },
      ...data,
    },
  });
  createdHorseIds.push(horse.id);
  return horse;
}

function loadHorse(id) {
  return prisma.horse.findUnique({ where: { id }, include: { foalDevelopment: true } });
}

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      username: PREFIX,
      email: `${PREFIX}@example.com`,
      password: 'irrelevant-hash',
      firstName: 'Evening',
      lastName: 'Window',
    },
  });
});

afterAll(async () => {
  const cleanup = createCleanupTracker();
  cleanup.add(
    () => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: createdHorseIds } } }),
    'foalDevelopment',
  );
  cleanup.add(() => cleanupTestHorses(prisma, createdHorseIds), 'horses');
  if (owner) {
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
  }
  await cleanup.run();
}, 120000);

describe.each(EVENINGS)('the Eastern evening window (%s) — Equoria-4urzd', (_label, now) => {
  it('a horse written 3 game-years old reads 3 after the date-only round trip; a UTC-date dob reads one day short', async () => {
    const eastern = await makeHorse({ dateOfBirth: birthDateForAge(3, now) });
    const utcDated = await makeHorse({ dateOfBirth: new Date(now.getTime() - 21 * DAY_MS) });

    const stored = await loadHorse(eastern.id);
    const storedUtc = await loadHorse(utcDated.id);

    await at(now, () => {
      expect(getHorseAgeDays(stored.dateOfBirth)).toBe(21);
      expect(getHorseAgeYears(stored.dateOfBirth)).toBe(3);
      // Proof the instant is inside the window: the UTC date is a day later.
      expect(getHorseAgeDays(storedUtc.dateOfBirth)).toBe(20);
    });
  });

  // createFoal's dam cooldown (7 days, horseFoalingController) is
  // getHorseAgeDays(lastBredDate) read at request time.
  it('a dam bred 7 game days ago reads 7 days since breeding, one bred 6 days ago reads 6', async () => {
    const bred7 = await makeHorse({
      sex: 'Mare',
      dateOfBirth: birthDateForAge(5, now),
      lastBredDate: gameCalendarDate(now, -7),
    });
    const bred6 = await makeHorse({
      sex: 'Mare',
      dateOfBirth: birthDateForAge(5, now),
      lastBredDate: gameCalendarDate(now, -6),
    });

    const [dam7, dam6] = [await loadHorse(bred7.id), await loadHorse(bred6.id)];
    await at(now, () => {
      expect(getHorseAgeDays(dam7.lastBredDate)).toBe(7);
      expect(getHorseAgeDays(dam6.lastBredDate)).toBe(6);
    });
  });

  it('the nightly pass advances a foal born yesterday (Eastern) to day 1 and leaves a foal born today at day 0', async () => {
    const yesterday = await makeHorse({ dateOfBirth: gameCalendarDate(now, -1) });
    const today = await makeHorse({ dateOfBirth: gameCalendarDate(now) });
    await prisma.foalDevelopment.create({ data: { foalId: yesterday.id, currentDay: 0 } });
    await prisma.foalDevelopment.create({ data: { foalId: today.id, currentDay: 0 } });

    const [foalYesterday, foalToday] = [await loadHorse(yesterday.id), await loadHorse(today.id)];
    const [resultToday, resultYesterday] = await at(now, async () => [
      await cronJobService.evaluateFoalTraits(foalToday),
      await cronJobService.evaluateFoalTraits(foalYesterday),
    ]);

    expect(resultToday).toMatchObject({ traitsRevealed: 0, reason: 'day_not_elapsed' });
    // Day 0 elapsed: the pass evaluated it (reveals are random, so not pinned) and advanced.
    expect(resultYesterday.reason).not.toBe('day_not_elapsed');
    expect(resultYesterday).toMatchObject({ currentDay: 1 });
    expect((await loadHorse(today.id)).foalDevelopment.currentDay).toBe(0);
    expect((await loadHorse(yesterday.id)).foalDevelopment.currentDay).toBe(1);
  });

  it('a groom blocked on Friday is unavailable on Friday evening Eastern, though UTC is already Saturday', async () => {
    await at(now, () => {
      expect(now.getUTCDay()).toBe(6); // Saturday in UTC
      expect(isGroomAvailableToday({ is_active: true, availability: { friday: false } })).toBe(false);
      expect(isGroomAvailableToday({ is_active: true, availability: { saturday: false } })).toBe(true);
    });
  });
});
