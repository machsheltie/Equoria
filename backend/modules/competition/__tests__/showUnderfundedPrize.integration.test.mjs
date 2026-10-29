/**
 * A show pays only the prize money it holds in escrow (Equoria-law5w, COMP-26).
 *
 * The defect: settleEntryInTx skipped the escrow debit whenever the show's
 * prizeEscrow was smaller than the placement's prize and credited the winner
 * anyway, so a show whose prize was never escrowed (a seeded or legacy row)
 * paid its prizes out of nowhere. Owner ruling q52 (2026-10-23): only Seasonal
 * Events may pay unescrowed prizes, and they do not exist yet; prize money is
 * 10x the fee, taken from the host at creation.
 *
 * Invariant: no placement is paid more than the show's escrow holds; an
 * underfunded show records prizeWon 0 and moves no coins to the winner.
 *
 * Real DB, real controllers, scoped fixtures.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createFundedShowFixtures, moneyOf } from './helpers/fundedShowFixtures.mjs';

const PREFIX = 'TestFixture-law5w';
const PRIZE = 1000;
const entryFee = PRIZE / 10;

const fx = createFundedShowFixtures(PREFIX);
const ownShowIds = [];

afterAll(async () => {
  const cleanup = createCleanupTracker();
  cleanup.add(
    () => prisma.competitionResult.deleteMany({ where: { showId: { in: ownShowIds } } }),
    'competitionResult',
  );
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: ownShowIds } } }), 'showEntry');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: ownShowIds } } }), 'show');
  await cleanup.run();
  await fx.cleanup();
}, 60000);

/** A show row with a prize but no escrow behind it: the seeded/legacy shape. */
async function buildUnescrowedClosedShow(entrantCount) {
  const creator = await fx.makeUser(0, 'creator');
  const now = Date.now();
  const show = await prisma.show.create({
    data: {
      name: `${PREFIX}-show-${randomBytes(5).toString('hex')}`,
      discipline: 'Dressage',
      entryFee,
      levelMin: 1,
      levelMax: 1,
      prize: PRIZE,
      runDate: new Date(now + 60 * 60 * 1000),
      status: 'open',
      openDate: new Date(now - 60 * 60 * 1000),
      closeDate: new Date(now + 60 * 60 * 1000),
      createdByUserId: creator.id,
      prizeEscrow: 0,
      feeEscrow: 0,
    },
  });
  ownShowIds.push(show.id);
  const entrants = [];
  for (let i = 0; i < entrantCount; i++) {
    const entrant = await fx.makeEntrant(entryFee);
    const res = await fx.enter(show.id, entrant);
    expect(res.statusCode).toBe(201);
    entrants.push(entrant);
  }
  await fx.close(show.id);
  return { creator, showId: show.id, entrants };
}

describe('show prizes come only from escrow (Equoria-law5w)', () => {
  it('an unescrowed show pays its placings nothing and records prizeWon 0', async () => {
    const show = await buildUnescrowedClosedShow(3);
    // Each entrant paid exactly the fee, so every wallet is at 0 before the run.
    for (const entrant of show.entrants) {
      expect(await moneyOf(entrant.owner.id)).toBe(0);
    }

    await executeClosedShows({ body: { showIds: [show.showId] } }, null);

    const results = await prisma.competitionResult.findMany({
      where: { showId: show.showId },
      select: { horseId: true, placement: true, prizeWon: true },
    });
    expect(results).toHaveLength(3);
    for (const row of results) {
      expect(Number(row.prizeWon)).toBe(0);
    }
    for (const entrant of show.entrants) {
      expect(await moneyOf(entrant.owner.id)).toBe(0);
      const horse = await prisma.horse.findUnique({
        where: { id: entrant.horse.id },
        select: { totalEarnings: true },
      });
      expect(horse.totalEarnings).toBe(0);
    }
    const settled = await prisma.show.findUnique({
      where: { id: show.showId },
      select: { status: true, prizeEscrow: true, feeEscrow: true },
    });
    expect(settled.status).toBe('completed');
    expect(settled.prizeEscrow).toBe(0);
    // The host still keeps the entry fees (owner ruling q60).
    expect(settled.feeEscrow).toBe(0);
    expect(await moneyOf(show.creator.id)).toBe(3 * entryFee);
  });

  it('an escrow-funded show still pays the whole prize', async () => {
    const show = await fx.buildClosedShow({ prize: PRIZE, entryFee, entrantCount: 3 });
    await executeClosedShows({ body: { showIds: [show.showId] } }, null);
    const results = await prisma.competitionResult.findMany({
      where: { showId: show.showId },
      select: { prizeWon: true },
    });
    expect(results.reduce((sum, r) => sum + Number(r.prizeWon), 0)).toBe(PRIZE);
    const settled = await prisma.show.findUnique({
      where: { id: show.showId },
      select: { prizeEscrow: true },
    });
    expect(settled.prizeEscrow).toBe(0);
  });
});
