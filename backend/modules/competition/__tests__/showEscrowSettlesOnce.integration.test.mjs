/**
 * A show's escrow is paid out exactly once, however many settlements overlap
 * (Equoria-mwjst.1, Codex re-review 2026-11-19 finding #1).
 *
 * The defect: recovery picks up a half-settled show without claiming it, and
 * the fee settlement read feeEscrow BEFORE its transaction and then applied an
 * unchecked relative decrement. Two runs overlapping on one show (an admin
 * POST /shows/execute and the nightly job) both read the fees, both paid the
 * creator, and the show's escrow went negative. The unpaid-prize refund had
 * the same unchecked decrement.
 *
 * The half-settled show is made by a real failure, not a mock: the creator's
 * wallet sits at the top of the Int range, so the fee credit overflows inside
 * Postgres and the fee settlement rolls back after every placing was paid.
 * The overlap is forced with a real row lock held on a second client
 * (rowLockBarrier), observed through pg_blocking_pids of the holder only.
 *
 * Real DB, real controllers and executor, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { refundUnpaidPrizeShareInTx } from '../shows/showEscrowTx.mjs';
import { createFundedShowFixtures, moneyOf } from './helpers/fundedShowFixtures.mjs';
import { createBarrierClient, holdLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';

const PRIZE = 1000;
const entryFee = PRIZE / 10; // the prize is always 10x the entry fee (owner ruling 2026-10-23)
const intMax = 2147483647;

const fx = createFundedShowFixtures('TestFixture-mwjst1-once');
let barrierClient;

beforeAll(() => {
  barrierClient = createBarrierClient();
});

afterAll(async () => {
  await barrierClient.$disconnect();
  await fx.cleanup();
}, 60000);

async function run(showIds) {
  try {
    await executeClosedShows({ body: { showIds } }, null);
    return null;
  } catch (error) {
    return error;
  }
}

async function setMoney(userId, money) {
  await prisma.user.update({ where: { id: userId }, data: { money } });
}

async function stagedOrderingIsSet(showId) {
  const rows = await prisma.$queryRaw`
    SELECT ("stagedOrdering" IS NOT NULL) AS "isSet" FROM "shows" WHERE "id" = ${showId}`;
  return rows[0].isSet;
}

const showRowLock = showId => tx => tx.$queryRaw`SELECT "id" FROM "shows" WHERE "id" = ${showId} FOR UPDATE`;

/** Start every call while the show row is held, wait until all are queued behind it, release. */
async function overlapBehindShowLock(showId, calls) {
  const barrier = await holdLock(barrierClient, showRowLock(showId));
  const inFlight = calls.map(call => call());
  try {
    await barrier.waitForQueued(calls.length);
  } finally {
    await barrier.release();
  }
  return Promise.all(inFlight);
}

async function creditRows(userId, category, showId) {
  const rows = await prisma.userTransaction.findMany({ where: { userId, category } });
  return rows.filter(row => Number(row.metadata?.showId) === showId);
}

describe('show escrow settles once (Equoria-mwjst.1, Codex #1)', () => {
  it('two overlapping recoveries of a half-settled show pay its fees to the creator once', async () => {
    const show = await fx.buildClosedShow({ prize: PRIZE, entryFee, entrantCount: 3 });
    const fees = entryFee * 3;

    // First run: all three placings are paid, then the fee credit overflows and
    // the fee settlement rolls back. The show is left completed, still holding
    // its staged ordering and its fees: half-settled.
    await setMoney(show.creator.id, intMax - 1);
    expect(await run([show.showId])).not.toBeNull();
    const half = await prisma.show.findUnique({ where: { id: show.showId } });
    expect(half.status).toBe('completed');
    expect(half.feeEscrow).toBe(fees);
    expect(await stagedOrderingIsSet(show.showId)).toBe(true);
    expect(await prisma.competitionResult.count({ where: { showId: show.showId } })).toBe(3);

    // The cause is fixed and the recovery grace period has passed.
    await setMoney(show.creator.id, 0);
    await prisma.show.update({
      where: { id: show.showId },
      data: { executedAt: new Date(Date.now() - 60 * 60 * 1000) },
    });
    const heldBefore = await fx.heldMoney(show);

    // An admin run and the nightly run reach the same half-settled show together.
    const outcomes = await overlapBehindShowLock(show.showId, [() => run([show.showId]), () => run([show.showId])]);

    // Neither run fails; the later one finds nothing left to settle.
    expect(outcomes).toEqual([null, null]);
    // The creator is paid the fees once, with one credit row.
    expect(await moneyOf(show.creator.id)).toBe(fees);
    const credits = await creditRows(show.creator.id, 'showEntryFeesReceived', show.showId);
    expect(credits.map(r => ({ type: r.type, amount: Number(r.amount) }))).toEqual([{ type: 'credit', amount: fees }]);
    // The escrow is drained, never overdrawn, and no coin appeared or vanished.
    const settled = await prisma.show.findUnique({ where: { id: show.showId } });
    expect(settled.feeEscrow).toBe(0);
    expect(settled.prizeEscrow).toBe(0);
    expect(await stagedOrderingIsSet(show.showId)).toBe(false);
    expect(await fx.heldMoney(show)).toBe(heldBefore);
  }, 90000);

  it('two overlapping refunds of the same unpaid prize share pay the creator once', async () => {
    const { creator, showId } = await fx.createFundedShow({ prize: PRIZE, entryFee });
    const funded = await prisma.show.findUnique({ where: { id: showId } });
    expect(funded.prizeEscrow).toBe(PRIZE);
    const refund = () =>
      prisma.$transaction(tx => refundUnpaidPrizeShareInTx(tx, { showId, creatorId: creator.id, amount: PRIZE }));

    const outcomes = await overlapBehindShowLock(showId, [refund, refund]);

    expect(outcomes).toHaveLength(2);
    expect(await moneyOf(creator.id)).toBe(PRIZE);
    const credits = await creditRows(creator.id, 'showUnpaidPrizeRefund', showId);
    expect(credits.map(r => ({ type: r.type, amount: Number(r.amount) }))).toEqual([{ type: 'credit', amount: PRIZE }]);
    const after = await prisma.show.findUnique({ where: { id: showId } });
    expect(after.prizeEscrow).toBe(0);
  }, 60000);
});
