/**
 * executeClosedShows — claim-the-work + transactional contract (Equoria-koodu).
 *
 * DEFECT: per-winner competitionResult.create + user.update were two separate
 * Prisma calls, NOT in a transaction. If user.update failed mid-flight the
 * result existed but money was never paid. Worse, show.status='completed' was
 * set AFTER entry processing, so a partial failure left the show in 'open' →
 * the next cron tick re-executed it → double pay.
 *
 * The fix (showController.mjs):
 *   1. CLAIM the show by setting status='completed' + executedAt BEFORE
 *      processing entries. A failed partial run no longer re-executes.
 *   2. Wrap each winner's competitionResult.create + user.update + (1st place)
 *      firstWin milestone + rider.update in a single $transaction.
 *      awardRiderCompetitionXP stays outside (fail-soft contract).
 *   3. The @@unique([showId, horseId]) on CompetitionResult backstops any
 *      claim-bypass with P2002 (already in schema + canonical DB).
 *
 * This suite proves the claim-the-work pattern end-to-end: running
 * executeClosedShows once distributes the prize correctly; running it AGAIN
 * does NOT re-process the show (no duplicate result rows, no double-pay).
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { executeClosedShows } from '../shows/showController.mjs';

const uid = () => `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;

let creator;
let entrant;
let entrantHorse;
let kooduShowId;
const showIds = [];
const cleanup = createCleanupTracker();

beforeAll(async () => {
  creator = await prisma.user.create({
    data: {
      email: `koodu-creator-${uid()}@test.com`,
      username: `kooduc${uid()}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Koodu',
      lastName: 'Creator',
      money: 100000,
    },
  });

  entrant = await prisma.user.create({
    data: {
      email: `koodu-entrant-${uid()}@test.com`,
      username: `kooduе${uid()}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Koodu',
      lastName: 'Entrant',
      money: 0,
    },
  });

  entrantHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-koodu-Horse-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: entrant.id,
      healthStatus: 'healthy',
      speed: 60,
      stamina: 60,
      agility: 60,
      balance: 60,
      precision: 60,
      boldness: 60,
    },
  });

  // Closeable show: 1 entrant takes 1st = 50% of 1000 = 500.
  const pastClose = new Date(Date.now() - 60 * 60 * 1000);
  const show = await prisma.show.create({
    data: {
      name: `TestFixture-koodu-Show-${uid()}`,
      discipline: 'Dressage',
      entryFee: 0,
      levelMin: 1,
      levelMax: 999,
      prize: 1000,
      runDate: pastClose,
      status: 'open',
      openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      closeDate: pastClose,
      createdByUserId: creator.id,
    },
  });
  kooduShowId = show.id;
  showIds.push(kooduShowId);

  await prisma.showEntry.create({
    data: { showId: kooduShowId, horseId: entrantHorse.id, userId: entrant.id, feePaid: 0 },
  });

  // Scoped, fail-loud cleanup (Equoria-9jv9c / rd899). Dependency-ordered:
  // results + entries before the show row; horse before its owner; entrant
  // and creator last. A failed delete now fails the suite instead of being
  // swallowed by a warning-only catch (the leak class behind Equoria-a429/lfj5).
  cleanup.add(
    () => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }),
    'competitionResult by showId',
  );
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'showEntry by showId');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'show by id');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: [entrantHorse.id] } } }), 'entrantHorse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [entrant.id] } } }), 'entrant');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [creator.id] } } }), 'creator');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('executeClosedShows — claim-the-work + transactional contract (Equoria-koodu)', () => {
  it('first run distributes the prize and marks show completed', async () => {
    const before = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });

    await executeClosedShows({}, null);

    const after = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });
    const show = await prisma.show.findUnique({
      where: { id: kooduShowId },
      select: { status: true, executedAt: true },
    });
    const results = await prisma.competitionResult.findMany({
      where: { showId: kooduShowId },
    });

    expect(show.status).toBe('completed');
    expect(show.executedAt).toBeTruthy();
    expect(results).toHaveLength(1);
    // Prize = floor(1000 * 0.5) = 500.
    expect(Number(after.money) - Number(before.money)).toBe(500);
  });

  it('SENTINEL: second run does NOT re-process the completed show (no duplicate result, no double-pay)', async () => {
    const moneyBeforeSecondRun = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });

    await executeClosedShows({}, null);

    const moneyAfterSecondRun = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });
    const results = await prisma.competitionResult.findMany({
      where: { showId: kooduShowId },
    });

    // Claim-the-work: status='completed' was set BEFORE entry processing on
    // the first run, so the second run's filter (which selects only open
    // shows) does NOT pick this show up. Money unchanged; still one result.
    expect(Number(moneyAfterSecondRun.money)).toBe(Number(moneyBeforeSecondRun.money));
    expect(results).toHaveLength(1);
  });
});
