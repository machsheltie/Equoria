/**
 * executeClosedShows concurrent-invocation double-score race (Equoria-dyj3y).
 *
 * DEFECT: executeClosedShows used a non-atomic check-then-set on show status —
 * findMany({ status: 'open', closeDate <= now }) then, per show,
 * update({ status: 'executing' }). Two concurrent invocations (two cron ticks,
 * or cron + a manual POST /shows/execute) both read the same show as 'open'
 * before either wrote 'executing', so BOTH scored it → duplicate
 * competitionResult rows and a DOUBLE prize payout.
 *
 * This suite fires TWO executeClosedShows() calls concurrently (Promise.all)
 * against the SAME closeable show and asserts:
 *   - exactly ONE competitionResult per entry (no duplicate rows), and
 *   - the entrant is paid the prize EXACTLY ONCE (no double-pay).
 *
 * Sentinel-positive: against the pre-fix code this fails (2 result rows / 2x
 * payout); against the atomic-claim fix it passes. Real DB, no mocks, scoped
 * fixtures (TestFixture- names, cleanup by collected ids only).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { executeClosedShows } from '../shows/showController.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const uid = () => `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;

let creator;
let entrant;
let entrantHorse;
let raceShowId;
const showIds = [];
const cleanup = createCleanupTracker();

beforeAll(async () => {
  creator = await prisma.user.create({
    data: {
      email: `dyj3y-creator-${uid()}@test.com`,
      username: `dyj3yc${uid()}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Race',
      lastName: 'Creator',
      money: 100000,
    },
  });

  entrant = await prisma.user.create({
    data: {
      email: `dyj3y-entrant-${uid()}@test.com`,
      username: `dyj3ye${uid()}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Race',
      lastName: 'Entrant',
      money: 0,
    },
  });

  entrantHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-dyj3y-Horse-${uid()}`,
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

  // A closeable show: status 'open' with a past closeDate, so executeClosedShows
  // will pick it up. Prize 1000 → single entrant takes 1st place = 50% = 500.
  const pastClose = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
  const show = await prisma.show.create({
    data: {
      name: `TestFixture-dyj3y-RaceShow-${uid()}`,
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
  raceShowId = show.id;
  showIds.push(raceShowId);

  await prisma.showEntry.create({
    data: { showId: raceShowId, horseId: entrantHorse.id, userId: entrant.id, feePaid: 0 },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys) — only the rows this suite
  // created. FK order: per-show results + entries -> show (createdByUserId FK)
  // -> horse -> users (Horse.userId is onDelete:Restrict). A cleanup failure now
  // fails the suite instead of being swallowed.
  cleanup.add(async () => {
    for (const id of showIds) {
      await prisma.competitionResult.deleteMany({ where: { showId: id } });
      await prisma.showEntry.deleteMany({ where: { showId: id } });
      await prisma.show.delete({ where: { id } });
    }
  }, 'shows');
  cleanup.add(
    () => (entrantHorse ? prisma.horse.delete({ where: { id: entrantHorse.id } }) : undefined),
    'entrantHorse',
  );
  cleanup.add(() => (entrant ? prisma.user.delete({ where: { id: entrant.id } }) : undefined), 'entrant');
  cleanup.add(() => (creator ? prisma.user.delete({ where: { id: creator.id } }) : undefined), 'creator');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('executeClosedShows — concurrent invocation does not double-score (Equoria-dyj3y)', () => {
  it('fires two executors concurrently and produces exactly ONE result row + single payout', async () => {
    const entrantBefore = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });

    // Fire two executors concurrently for the same closeable show. With the
    // non-atomic check-then-set both pass the 'is open?' gate and both score
    // the show. The atomic updateMany claim makes the second a no-op.
    //
    // Equoria-rsss0: scope BOTH executors to this suite's single race show.
    // The double-score race is per-show (the atomic claim is a per-row
    // updateMany), so scoping to [raceShowId] preserves the race semantics
    // EXACTLY while preventing this suite's global scan from claiming a
    // parallel competition suite's past-due open shows. The synthetic
    // `{ body: { showIds } }` first arg drives the same optional filter the
    // HTTP route exposes; `res` stays undefined so the service path runs.
    const scoped = { body: { showIds: [raceShowId] } };
    await Promise.all([executeClosedShows(scoped, undefined), executeClosedShows(scoped, undefined)]);

    // EXACTLY ONE competitionResult row for our entrant in this show.
    const results = await prisma.competitionResult.findMany({
      where: { showId: raceShowId, horseId: entrantHorse.id },
    });
    expect(results).toHaveLength(1);

    // Total result rows for the show (one entry → one result, no duplicates).
    const totalResults = await prisma.competitionResult.count({
      where: { showId: raceShowId },
    });
    expect(totalResults).toBe(1);

    // Prize paid EXACTLY once: 50% of 1000 = 500. A double-score would credit 1000.
    const entrantAfter = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });
    expect(entrantAfter.money).toBe(entrantBefore.money + 500);

    // Show ends in a terminal state.
    const show = await prisma.show.findUnique({ where: { id: raceShowId } });
    expect(show.status).toBe('completed');
  }, 30000);
});
