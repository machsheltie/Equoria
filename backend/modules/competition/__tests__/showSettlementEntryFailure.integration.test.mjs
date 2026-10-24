/**
 * One entry's failed settlement must not strand the rest of its show
 * (Equoria-wmwbr).
 *
 * The defect: executeClosedShows settled every entry in its own transaction and
 * awaited them with Promise.all. When one entry's transaction failed, the
 * rejection skipped the fee-escrow settlement that followed, and because the
 * show was already 'completed', nothing ever came back for it: the creator was
 * never paid the entry fees and SystemAccount[show_escrow] kept them for good.
 * The same rejection also ended the run, so later shows in the batch waited a
 * night.
 *
 * The failure is real, not mocked: a competitionResult row for one entrant is
 * planted before settlement, so that entrant's settlement transaction hits the
 * @@unique([showId, horseId]) guard (P2002) and rolls back.
 *
 * Real DB, real controllers (createShow / enterShow fund the escrow), scoped
 * fixtures. Conservation is asserted over suite-owned wallets plus the show's
 * own escrow columns.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createFundedShowFixtures, moneyOf } from './helpers/fundedShowFixtures.mjs';

const PRIZE = 1000;
const entryFee = PRIZE / 10; // the prize is always 10x the entry fee (owner ruling 2026-10-23, Equoria-v0ys3)

const fx = createFundedShowFixtures('TestFixture-wmwbr');

afterAll(() => fx.cleanup(), 60000);

/** Plant the result row that makes this horse's settlement transaction fail. */
async function plantResult(showId, horseId) {
  await prisma.competitionResult.create({
    data: {
      score: 1,
      placement: 99,
      discipline: 'Dressage',
      runDate: new Date(),
      showName: 'planted',
      prizeWon: 0,
      horseId,
      showId,
    },
  });
}

async function runCatching(showIds) {
  try {
    await executeClosedShows({ body: { showIds } }, null);
    return null;
  } catch (error) {
    return error;
  }
}

/**
 * The creator's own credit rows for one show (the fee settlement, with 3+
 * entrants nothing else). The escrow-side attribution rows carry
 * metadata.systemAccount and are excluded.
 */
async function creatorCreditRows(creatorId, showId) {
  const rows = await prisma.userTransaction.findMany({ where: { userId: creatorId, type: 'credit' } });
  return rows.filter(r => r.metadata?.showId === showId && !r.metadata?.systemAccount);
}

describe('a failed entry settlement (Equoria-wmwbr)', () => {
  it('pays the other entrants, settles the fee escrow once, and a re-run changes nothing', async () => {
    const show = await fx.buildClosedShow({ prize: PRIZE, entryFee, entrantCount: 3 });
    const [first, failing, third] = show.entrants;
    await plantResult(show.showId, failing.horse.id);
    const heldBefore = await fx.heldMoney(show);

    const error = await runCatching([show.showId]);

    // The run still reports the failure to its caller (cron heartbeat / HTTP 500).
    expect(error?.code).toBe('P2002');

    const results = await prisma.competitionResult.findMany({
      where: { showId: show.showId },
      select: { horseId: true, prizeWon: true, placement: true },
    });
    expect(results).toHaveLength(3); // two settled + the planted row
    const settled = results.filter(r => r.horseId !== failing.horse.id);
    expect(settled.map(r => r.horseId).sort()).toEqual([first.horse.id, third.horse.id].sort());

    // Each settled entrant holds exactly the prize their result records (they
    // were funded with only the fee, which went into escrow).
    for (const entrant of [first, third]) {
      const row = settled.find(r => r.horseId === entrant.horse.id);
      expect(await moneyOf(entrant.owner.id)).toBe(Number(row.prizeWon));
    }
    expect(await moneyOf(failing.owner.id)).toBe(0);

    // The fee escrow settled to the creator in full, with one ledger row.
    const after = await prisma.show.findUnique({ where: { id: show.showId } });
    expect(after.status).toBe('completed');
    expect(after.feeEscrow).toBe(0);
    expect(await moneyOf(show.creator.id)).toBe(entryFee * 3);
    const feeRows = await creatorCreditRows(show.creator.id, show.showId);
    expect(feeRows.map(r => r.amount)).toEqual([entryFee * 3]);

    // The failed entrant's share is still held, not lost: escrow holds exactly
    // what was not paid out, and no money appeared or vanished.
    const paid = settled.reduce((sum, r) => sum + Number(r.prizeWon), 0);
    expect(after.prizeEscrow).toBe(PRIZE - paid);
    expect(after.prizeEscrow).toBeGreaterThan(0);
    expect(await fx.heldMoney(show)).toBe(heldBefore);

    // A re-run is a no-op: nothing settles twice.
    expect(await runCatching([show.showId])).toBeNull();
    expect(await moneyOf(show.creator.id)).toBe(entryFee * 3);
    expect(await creatorCreditRows(show.creator.id, show.showId)).toHaveLength(1);
    for (const entrant of [first, third]) {
      const row = settled.find(r => r.horseId === entrant.horse.id);
      expect(await moneyOf(entrant.owner.id)).toBe(Number(row.prizeWon));
    }
    expect(await prisma.competitionResult.count({ where: { showId: show.showId } })).toBe(3);
    expect(await fx.heldMoney(show)).toBe(heldBefore);
  }, 60000);

  it('a show with a failed entry does not hold back the next show in the same run', async () => {
    const broken = await fx.buildClosedShow({ prize: PRIZE, entryFee, entrantCount: 2 });
    const healthy = await fx.buildClosedShow({ prize: PRIZE, entryFee, entrantCount: 3 });
    await plantResult(broken.showId, broken.entrants[0].horse.id);
    const healthyHeld = await fx.heldMoney(healthy);

    const error = await runCatching([broken.showId, healthy.showId]);
    expect(error?.code).toBe('P2002');

    const settledShow = await prisma.show.findUnique({ where: { id: healthy.showId } });
    expect(settledShow.status).toBe('completed');
    expect(settledShow.prizeEscrow).toBe(0);
    expect(settledShow.feeEscrow).toBe(0);
    expect(await prisma.competitionResult.count({ where: { showId: healthy.showId } })).toBe(3);
    expect(await moneyOf(healthy.creator.id)).toBe(entryFee * 3);
    expect(await fx.heldMoney(healthy)).toBe(healthyHeld);
  }, 60000);
});
