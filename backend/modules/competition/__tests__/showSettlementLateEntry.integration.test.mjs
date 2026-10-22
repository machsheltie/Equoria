/**
 * An entry that commits after the executor's read but before its claim is
 * scored (Equoria-fzmiy).
 *
 * The defect: executeClosedShows read every due show WITH its entries, scored
 * that snapshot, and only then claimed the show ('open' -> 'executing'). An
 * entry whose transaction was already inside the entry window when the show
 * closed could commit after the snapshot and before the claim. The entry
 * transaction's status-scoped guard (Equoria-8pb6w) let it through because the
 * show was still 'open', so its fee was taken and its row created, but the
 * executor paid out the snapshot: the horse was never scored, and the fee went
 * to the creator.
 *
 * The interleaving is forced with a real row lock, not a seam or a timer race:
 * a holder transaction locks the show row, the late entry runs the REAL entry
 * path and queues on that lock (its window check already passed), the show's
 * closing time passes, the REAL executor reads the show and queues its claim
 * behind the entry. Releasing the lock commits the entry first and then lets
 * the claim through, exactly the order the defect needs.
 *
 * Lock-barrier traps (memory: lock-barrier tests): the barrier polls on the
 * holder's own transaction, clears the stats snapshot before each poll, and
 * counts only sessions queued behind this holder.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createFundedShowFixtures, moneyOf } from './helpers/fundedShowFixtures.mjs';

const PRIZE = 1000;
const ENTRY_FEE = 40;
const ENTRY_WINDOW_MS = 3000;

const fx = createFundedShowFixtures('TestFixture-fzmiy');

afterAll(() => fx.cleanup(), 60000);

/** Wait until `count` sessions are queued behind the lock `tx` holds. */
async function waitForLockWaiters(tx, count, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await tx.$executeRaw`SELECT pg_stat_clear_snapshot()`;
    const [{ waiting }] = await tx.$queryRaw`
      WITH RECURSIVE queued(pid) AS (
        SELECT pid FROM pg_stat_activity
        WHERE pg_backend_pid() = ANY(pg_blocking_pids(pid))
        UNION
        SELECT a.pid FROM pg_stat_activity a
        JOIN queued q ON q.pid = ANY(pg_blocking_pids(a.pid))
      )
      SELECT COUNT(*)::int AS waiting FROM queued`;
    if (waiting >= count) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error(`only ${waiting} of ${count} sessions reached the lock`);
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

describe('a late entry racing the executor claim (Equoria-fzmiy)', () => {
  it('is scored and paid like every other entry', async () => {
    const { creator, showId } = await fx.createFundedShow({ prize: PRIZE, entryFee: ENTRY_FEE });
    const early = await fx.makeEntrant(ENTRY_FEE);
    const second = await fx.makeEntrant(ENTRY_FEE);
    const late = await fx.makeEntrant(ENTRY_FEE);
    expect((await fx.enter(showId, early)).statusCode).toBe(201);
    expect((await fx.enter(showId, second)).statusCode).toBe(201);
    const show = { creator, showId, entrants: [early, second, late] };
    const heldBefore = await fx.heldMoney(show);

    // The show closes a moment from now; the late entry starts before then.
    const closeAt = new Date(Date.now() + ENTRY_WINDOW_MS);
    await prisma.show.update({ where: { id: showId }, data: { closeDate: closeAt } });

    let lateEntry;
    let execution;
    await prisma.$transaction(
      async tx => {
        await tx.$queryRaw`SELECT "id" FROM "shows" WHERE "id" = ${showId} FOR UPDATE`;

        lateEntry = fx.enter(showId, late);
        await waitForLockWaiters(tx, 1);
        // Precondition: the entry queued (its window check done) before closing.
        expect(Date.now()).toBeLessThan(closeAt.getTime());

        await new Promise(resolve => setTimeout(resolve, closeAt.getTime() - Date.now() + 50));
        execution = executeClosedShows({ body: { showIds: [showId] } }, null).then(
          () => null,
          error => error,
        );
        // The executor has read the show and queued its claim behind the entry.
        await waitForLockWaiters(tx, 2);
      },
      { timeout: 40000, maxWait: 10000 },
    );

    expect((await lateEntry).statusCode).toBe(201);
    expect(await execution).toBeNull();

    const results = await prisma.competitionResult.findMany({
      where: { showId },
      select: { horseId: true, prizeWon: true },
    });
    expect(results.map(r => r.horseId).sort()).toEqual(show.entrants.map(e => e.horse.id).sort());
    for (const entrant of show.entrants) {
      const row = results.find(r => r.horseId === entrant.horse.id);
      expect(await moneyOf(entrant.owner.id)).toBe(Number(row.prizeWon));
    }

    const after = await prisma.show.findUnique({ where: { id: showId } });
    expect(after.status).toBe('completed');
    expect(after.prizeEscrow).toBe(0);
    expect(after.feeEscrow).toBe(0);
    expect(await moneyOf(creator.id)).toBe(ENTRY_FEE * 3);
    expect(await fx.heldMoney(show)).toBe(heldBefore);
  }, 90000);
});
