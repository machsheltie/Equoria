/**
 * Ridden placement payouts under concurrency (Equoria-ifnhc).
 *
 * 1. Lock order. The entry transaction takes the entrant's User row first,
 *    then the escrow account. The placement payout took the show escrow
 *    account first and the winner's User row after it, so a winner entering
 *    another paid show while their prize was being paid ran the two locks in
 *    opposite orders: Postgres aborted one side (a 503 for the player, or a
 *    failed placement for the show).
 *
 * 2. Overlapping recoveries. Two runs that finish the same half-settled show
 *    (an admin POST /shows/execute and the nightly job) both paid the same
 *    placings; the loser's duplicate result row was refused, but the refusal
 *    was logged as a failure, counted toward quarantine and returned as a 500.
 *
 * Both interleavings are forced with a real row lock held on a second client
 * (rowLockBarrier) and observed through pg_blocking_pids of the holder only.
 * Half-settled shows are made by a real failure (a horse's lifetime winnings at
 * the top of the Int range overflow inside Postgres), never a mock.
 *
 * Real DB, real controllers and executor, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { readShowFailures, showFailureJobName } from '../shows/showFailureLog.mjs';
import { createFundedShowFixtures, fakeRes, moneyOf } from './helpers/fundedShowFixtures.mjs';
import { createBarrierClient, holdLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';

const PRIZE = 1000;
const entryFee = PRIZE / 10; // the prize is always 10x the entry fee (owner ruling 2026-10-23)
const intMax = 2147483647;

const fx = createFundedShowFixtures('TestFixture-ifnhc-payout');
const failureShowIds = [];
let barrierClient;

beforeAll(() => {
  barrierClient = createBarrierClient();
});

afterAll(async () => {
  await barrierClient.$disconnect();
  for (const showId of failureShowIds) {
    await prisma.cronRunLog.deleteMany({
      where: { jobName: showFailureJobName, summary: { path: ['showId'], equals: showId } },
    });
  }
  await fx.cleanup();
}, 60000);

/** POST /shows/execute's handler for these shows; resolves to its response. */
async function adminRun(showIds) {
  const res = fakeRes();
  await executeClosedShows({ body: { showIds } }, res);
  return res;
}

const escrowAccountLock = tx =>
  tx.$queryRaw`SELECT "name" FROM "system_accounts" WHERE "name" = 'showEscrow' FOR UPDATE`;

const showRowLock = showId => tx => tx.$queryRaw`SELECT "id" FROM "shows" WHERE "id" = ${showId} FOR UPDATE`;

async function stagedOrderingIsSet(showId) {
  const rows = await prisma.$queryRaw`
    SELECT ("stagedOrdering" IS NOT NULL) AS "isSet" FROM "shows" WHERE "id" = ${showId}`;
  return rows[0].isSet;
}

describe('ridden placement payout concurrency (Equoria-ifnhc)', () => {
  it('a winner entering another paid show while their prize is paid: both finish', async () => {
    const won = await fx.buildClosedShow({ prize: PRIZE, entryFee, entrantCount: 1 });
    failureShowIds.push(won.showId);
    const winner = won.entrants[0];
    const next = await fx.createFundedShow({ prize: PRIZE, entryFee });
    await prisma.user.update({ where: { id: winner.owner.id }, data: { money: entryFee } });

    // Hold the escrow account: the payout queues on it first, then the winner's
    // entry into the other show queues behind it. Released, the old payout took
    // the escrow account and then wanted the winner's User row, which the entry
    // held while it waited for the escrow account: a deadlock.
    const barrier = await holdLock(barrierClient, escrowAccountLock);
    let settling;
    let entering;
    try {
      settling = adminRun([won.showId]);
      await barrier.waitForQueued(1);
      entering = fx.enter(next.showId, winner);
      await barrier.waitForQueued(2);
    } finally {
      await barrier.release();
    }
    const [settled, entered] = await Promise.all([settling, entering]);

    // No placement of the show failed (a deadlock victim is recorded here).
    expect((await readShowFailures(won.showId)).map(f => f.message)).toEqual([]);
    expect(settled.statusCode).toBe(200);
    expect(entered.statusCode).toBe(201);
    // One entrant: the winner is paid the first-place share, the rest of the
    // prize goes back to the creator with the fee, and the winner's new entry
    // fee sits in the other show's escrow.
    const result = await prisma.competitionResult.findUnique({
      where: { showIdHorseId: { showId: won.showId, horseId: winner.horse.id } },
    });
    expect(result.placement).toBe(1);
    const share = Number(result.prizeWon);
    expect(share).toBe(PRIZE / 2);
    expect(await moneyOf(winner.owner.id)).toBe(share);
    expect(await moneyOf(won.creator.id)).toBe(entryFee + (PRIZE - share));
    const settledShow = await prisma.show.findUnique({ where: { id: won.showId } });
    expect(settledShow.prizeEscrow).toBe(0);
    expect(settledShow.feeEscrow).toBe(0);
    const nextShow = await prisma.show.findUnique({ where: { id: next.showId } });
    expect(nextShow.feeEscrow).toBe(entryFee);
  }, 90000);

  it('two overlapping recoveries of a show with unpaid placings: each placing paid once, no failure, no 500', async () => {
    const show = await fx.buildClosedShow({ prize: PRIZE, entryFee, entrantCount: 3 });
    failureShowIds.push(show.showId);
    // First run: every placing's transaction overflows on the horse's lifetime
    // winnings and rolls back. The show is left completed with its staged
    // ordering and its whole prize escrow: half-settled, one failed try counted.
    for (const { horse } of show.entrants) {
      await prisma.horse.update({ where: { id: horse.id }, data: { totalEarnings: intMax } });
    }
    expect((await adminRun([show.showId])).statusCode).toBe(500);
    const half = await prisma.show.findUnique({ where: { id: show.showId } });
    expect(half.status).toBe('completed');
    expect(half.prizeEscrow).toBe(PRIZE);
    expect(half.executionAttempts).toBe(1);
    expect(await stagedOrderingIsSet(show.showId)).toBe(true);
    expect(await prisma.competitionResult.count({ where: { showId: show.showId } })).toBe(0);
    const failuresBefore = (await readShowFailures(show.showId)).length;

    // The cause is fixed and the recovery grace period has passed.
    for (const { horse } of show.entrants) {
      await prisma.horse.update({ where: { id: horse.id }, data: { totalEarnings: 0 } });
    }
    await prisma.show.update({
      where: { id: show.showId },
      data: { executedAt: new Date(Date.now() - 60 * 60 * 1000) },
    });
    const heldBefore = await fx.heldMoney(show);

    // An admin run and the nightly run reach the same placings together.
    const barrier = await holdLock(barrierClient, showRowLock(show.showId));
    const inFlight = [adminRun([show.showId]), adminRun([show.showId])];
    try {
      await barrier.waitForQueued(2);
    } finally {
      await barrier.release();
    }
    const outcomes = await Promise.all(inFlight);

    // Neither run fails: the later one finds each placing already paid.
    expect(outcomes.map(res => res.statusCode)).toEqual([200, 200]);
    const after = await prisma.show.findUnique({ where: { id: show.showId } });
    expect(after.status).toBe('completed');
    expect(after.executionAttempts).toBe(1);
    expect((await readShowFailures(show.showId)).length).toBe(failuresBefore);
    expect(await stagedOrderingIsSet(show.showId)).toBe(false);

    // Each placing has one result and its owner was paid that prize once; the
    // whole prize left escrow and no coin appeared or vanished.
    const results = await prisma.competitionResult.findMany({ where: { showId: show.showId } });
    expect(results).toHaveLength(3);
    for (const { owner, horse } of show.entrants) {
      const row = results.find(r => r.horseId === horse.id);
      expect(await moneyOf(owner.id)).toBe(Number(row.prizeWon));
    }
    expect(results.reduce((sum, r) => sum + Number(r.prizeWon), 0)).toBe(PRIZE);
    expect(after.prizeEscrow).toBe(0);
    expect(await fx.heldMoney(show)).toBe(heldBefore);
  }, 90000);
});
