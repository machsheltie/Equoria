/**
 * Foal day counts in the Eastern evening window — Equoria-kha18 (items 3, 4).
 *
 * Owner ruling (Stacey, repeated 2026-10-09): every day count is an Eastern
 * calendar day, never a millisecond delta or the host clock. `dateOfBirth` is
 * a date-only column (UTC midnight of the Eastern birth date), so from 20:00
 * to 24:00 EDT (19:00–24:00 EST) `Date.now() - dateOfBirth` already holds one
 * more whole day than the Eastern calendar does.
 *
 *   - (flagEvaluationEngine.getEligibleHorses had a guard case here; the
 *     engine was deleted with no caller left, Equoria-1vep2.)
 *   - horseAgingSystem.processFoalMilestoneEvaluations aged a foal as
 *     floor((Date.now() - dob) / day), one day too old in that window, so
 *     milestone windows opened a day early and closed a day early. Since
 *     owner ruling q352 (2026-11-03, Equoria-gveno) a window is scored the
 *     night after it ends, so a day-ahead read would score it a day early.
 *   - horseAgingSystem.calculateAgeFromBirth (behind updateHorseAge, which
 *     writes Horse.age in game-years) was the same millisecond delta, so a
 *     6-game-day-old foal was written 1 game-year old in the evening.
 *
 * Instants pinned inside the window:
 *   - summer: 2026-10-17T00:30Z = Fri 2026-10-16 20:30 EDT
 *   - winter: 2026-12-12T03:30Z = Fri 2026-12-11 22:30 EST
 *
 * Only Date is faked; every timer Prisma and pg rely on stays real.
 * Real database, real functions. No mocks.
 */

import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../packages/database/prismaClient.mjs';
import { processFoalMilestoneEvaluations, updateHorseAge } from '../utils/horseAgingSystem.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';
import { cleanupTestHorses, testHorseData } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';

const PREFIX = `TestFixture-kha18-${randomBytes(4).toString('hex')}`;

const EVENINGS = [
  ['summer, 20:30 EDT', new Date('2026-10-17T00:30:00.000Z')],
  ['winter, 22:30 EST', new Date('2026-12-12T03:30:00.000Z')],
];

const realExceptDate = [
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
  jest.useFakeTimers({ now: instant, doNotFake: realExceptDate });
  try {
    return await fn();
  } finally {
    jest.useRealTimers();
  }
}

const createdHorseIds = [];
let owner;

async function makeHorse(dateOfBirth) {
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `${PREFIX}-${createdHorseIds.length}`,
      sex: 'Filly',
      age: 0,
      dateOfBirth,
      user: { connect: { id: owner.id } },
    }),
  });
  createdHorseIds.push(horse.id);
  return prisma.horse.findUnique({ where: { id: horse.id } });
}

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      emailVerified: true,
      username: PREFIX,
      email: `${PREFIX}@example.com`,
      password: 'irrelevant-hash',
      firstName: 'Evening',
      lastName: 'Counts',
    },
  });
});

afterAll(async () => {
  const cleanup = createCleanupTracker();
  cleanup.add(
    () => prisma.milestoneTraitLog.deleteMany({ where: { horseId: { in: createdHorseIds } } }),
    'milestoneTraitLog',
  );
  cleanup.add(() => cleanupTestHorses(prisma, createdHorseIds), 'horses');
  if (owner) {
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
  }
  await cleanup.run();
}, 120000);

describe.each(EVENINGS)('Eastern day counts for foals (%s) — Equoria-kha18', (_label, now) => {
  it('the milestone pass reads a foal born yesterday (Eastern) as day 1: no window has ended yet', async () => {
    const foal = await makeHorse(gameCalendarDate(now, -1));

    const result = await at(now, () => processFoalMilestoneEvaluations({ dryRun: true, specificHorseId: foal.id }));

    // Day 1 is still inside imprinting (0-1); read as day 2 it would score imprinting.
    expect(result).toMatchObject({ totalProcessed: 1, milestonesEvaluated: 0, errors: 0 });
  });

  it('the milestone pass reads a foal born 21 game days ago as day 21: trust window still open', async () => {
    const foal = await makeHorse(gameCalendarDate(now, -21));

    const result = await at(now, () => processFoalMilestoneEvaluations({ dryRun: true, specificHorseId: foal.id }));

    // Day 21 is the last day of trust/handling (15-21): imprinting, socialization
    // and curiosity/play have ended; read as day 22 trust/handling would be a fourth.
    expect(result).toMatchObject({ totalProcessed: 1, milestonesEvaluated: 3, errors: 0 });
  });

  it('the aging pass keeps a foal born 6 game days ago at 0 game-years and ages one born 7 days ago to 1', async () => {
    const six = await makeHorse(gameCalendarDate(now, -6));
    const seven = await makeHorse(gameCalendarDate(now, -7));

    const [sixResult, sevenResult] = await at(now, async () => [
      await updateHorseAge(six.id),
      await updateHorseAge(seven.id),
    ]);

    expect(sixResult).toMatchObject({ ageUpdated: false, newAge: 0 });
    expect(sevenResult).toMatchObject({ ageUpdated: true, newAge: 1 });
    const stored = await prisma.horse.findMany({
      where: { id: { in: [six.id, seven.id] } },
      select: { id: true, age: true },
    });
    expect(Object.fromEntries(stored.map(h => [h.id, h.age]))).toEqual({ [six.id]: 0, [seven.id]: 1 });
  });
});
