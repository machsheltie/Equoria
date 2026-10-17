/**
 * Foal day counts in the Eastern evening window — Equoria-kha18 (items 3, 4).
 *
 * Owner ruling (Stacey, repeated 2026-10-09): every day count is an Eastern
 * calendar day, never a millisecond delta or the host clock. `dateOfBirth` is
 * a date-only column (UTC midnight of the Eastern birth date), so from 20:00
 * to 24:00 EDT (19:00–24:00 EST) `Date.now() - dateOfBirth` already holds one
 * more whole day than the Eastern calendar does.
 *
 *   - flagEvaluationEngine.getEligibleHorses pre-filters on
 *     `evaluationDate - 21 days`. That looked like it would drop a
 *     20-day-old (2 game-years, eligible) horse in the window, but Prisma
 *     binds a filter on a `@db.Date` column as the UTC DATE of the instant,
 *     which in the window is already the next Eastern date, so the bound lands
 *     on the right day. This case guards that behaviour; it is not a fix.
 *   - horseAgingSystem.processFoalMilestoneEvaluations aged a foal as
 *     floor((Date.now() - dob) / day), one day too old in that window, so
 *     milestone windows opened a day early and closed a day early.
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
import { getEligibleHorses } from '../utils/flagEvaluationEngine.mjs';
import { processFoalMilestoneEvaluations } from '../utils/horseAgingSystem.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';
import { getHorseAgeDays } from '../utils/horseAge.mjs';
import { cleanupTestHorses } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';

const PREFIX = `TestFixture-kha18-${randomBytes(4).toString('hex')}`;
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

async function makeHorse(dateOfBirth) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}-${createdHorseIds.length}`,
      sex: 'Filly',
      age: 0,
      dateOfBirth,
      user: { connect: { id: owner.id } },
    },
  });
  createdHorseIds.push(horse.id);
  return prisma.horse.findUnique({ where: { id: horse.id } });
}

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
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
  it('flag evaluation keeps a 20-game-day-old horse (2 game-years) and drops a 21-day-old (3 game-years)', async () => {
    const twenty = await makeHorse(gameCalendarDate(now, -20));
    const twentyOne = await makeHorse(gameCalendarDate(now, -21));
    // Proof the instant is in the window: the millisecond age is a day more.
    expect(Math.floor((now.getTime() - twenty.dateOfBirth.getTime()) / DAY_MS)).toBe(21);
    expect(getHorseAgeDays(twenty.dateOfBirth, now)).toBe(20);

    const eligible = await getEligibleHorses(now);

    expect(eligible).toContain(twenty.id);
    expect(eligible).not.toContain(twentyOne.id);
  });

  it('the milestone pass reads a foal born today (Eastern) as day 0: imprinting only', async () => {
    const foal = await makeHorse(gameCalendarDate(now));

    const result = await at(now, () => processFoalMilestoneEvaluations({ dryRun: true, specificHorseId: foal.id }));

    // Day 0 is inside imprinting (0-1) only; day 1 would also open socialization (1-7).
    expect(result).toMatchObject({ totalProcessed: 1, milestonesEvaluated: 1, errors: 0 });
  });

  it('the milestone pass reads a foal born 28 game days ago as day 28: confidence window still open', async () => {
    const foal = await makeHorse(gameCalendarDate(now, -28));

    const result = await at(now, () => processFoalMilestoneEvaluations({ dryRun: true, specificHorseId: foal.id }));

    // Day 28 is the last day of confidence/reactivity (22-28); day 29 is in no window.
    expect(result).toMatchObject({ totalProcessed: 1, milestonesEvaluated: 1, errors: 0 });
  });
});
