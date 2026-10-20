/**
 * Unpaid prize shares go back to the show's creator (Equoria-w7fnz).
 *
 * Settlement pays the placed shares only (50/30/20). Before this fix a show with
 * one entrant paid 50% and a show with two paid 80%; the rest stayed in the
 * completed show's prizeEscrow (and SystemAccount[show_escrow]) for good.
 *
 * Owner ruling (Stacey, 2026-10-19, decision 5): with fewer than 3 entrants the
 * unpaid share is REFUNDED to the show's creator. Nothing else about prizes
 * changes.
 *
 * Rounding: each placed share is floor(prize x slot), as before; the refund is
 * whatever of the escrow the placed shares did not take, so
 * placed shares + refund == prizeEscrow exactly.
 *
 * Real DB, no mocks. Shows are created and entered through the real
 * createShow / enterShow controllers so the prize is escrow-funded, and the
 * executor always runs scoped to this suite's show ids.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createShow, enterShow } from '../shows/showController.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { competitionDateOfBirth, giveEligibleRider } from '../../../__tests__/helpers/eligibleCompetitor.mjs';

const PREFIX = 'TestFixture-w7fnz';
const REFUND_CATEGORY = 'show_refund_unpaid_prize';
const uid = () => randomBytes(5).toString('hex');

const userIds = [];
const horseIds = [];
const riderIds = [];
const showIds = [];

afterAll(async () => {
  const cleanup = createCleanupTracker();
  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'competitionResult');
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'showEntry');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'show');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'rider');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'userTransaction');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');
  await cleanup.run();
}, 60000);

function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

async function makeUser(money, role) {
  const tag = uid();
  const user = await prisma.user.create({
    data: {
      username: `${PREFIX}-${role}-${tag}`.slice(0, 30),
      email: `${PREFIX}-${role}-${tag}@test.local`,
      password: 'irrelevant-hash',
      firstName: 'Refund',
      lastName: role,
      money,
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeEntrant(money = 0) {
  const owner = await makeUser(money, 'entrant');
  const horse = await createTestHorse(
    prisma,
    {
      name: `${PREFIX}-horse-${uid()}`,
      sex: 'Mare',
      dateOfBirth: competitionDateOfBirth(),
      age: 7,
      userId: owner.id,
      healthStatus: 'healthy',
      speed: 60,
      stamina: 60,
      agility: 60,
      balance: 60,
      precision: 60,
      boldness: 60,
    },
    horseIds,
  );
  await giveEligibleRider(prisma, { horseId: horse.id, userId: owner.id }, riderIds);
  return { owner, horse };
}

/** Create an escrow-funded show, enter `entrantCount` horses, close it. */
async function runShow({ prize, entrantCount, entryFee = 0 }) {
  const creator = await makeUser(prize, 'creator');
  const createRes = fakeRes();
  await createShow(
    {
      user: { id: creator.id },
      body: { name: `${PREFIX}-show-${uid()}`, discipline: 'Dressage', entryFee, prize, level: 1 },
    },
    createRes,
  );
  expect(createRes.statusCode).toBe(201);
  const showId = createRes.body.data.show.id;
  showIds.push(showId);

  const entrants = [];
  for (let i = 0; i < entrantCount; i++) {
    const entrant = await makeEntrant(entryFee);
    const enterRes = fakeRes();
    await enterShow(
      { user: { id: entrant.owner.id }, params: { id: String(showId) }, body: { horseId: entrant.horse.id } },
      enterRes,
    );
    expect(enterRes.statusCode).toBe(201);
    entrants.push(entrant);
  }

  await prisma.show.update({
    where: { id: showId },
    data: { closeDate: new Date(Date.now() - 60 * 60 * 1000) },
  });
  await executeClosedShows({ body: { showIds: [showId] } }, null);

  return { creator, showId, entrants };
}

async function moneyOf(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

async function refundRows(userId, showId) {
  const rows = await prisma.userTransaction.findMany({
    where: { userId, category: REFUND_CATEGORY },
  });
  return rows.filter(r => r.metadata?.showId === showId);
}

describe('unpaid prize shares are refunded to the creator (Equoria-w7fnz)', () => {
  it('1 entrant: winner gets 50%, creator gets the other 50% back, escrow ends at 0', async () => {
    const prize = 1001; // odd: the placed share rounds down, the refund takes the remainder
    const { creator, showId, entrants } = await runShow({ prize, entrantCount: 1 });

    expect(await moneyOf(entrants[0].owner.id)).toBe(500); // floor(1001 x 0.5)
    expect(await moneyOf(creator.id)).toBe(501); // created with exactly `prize`, paid it all into escrow

    const show = await prisma.show.findUnique({ where: { id: showId } });
    expect(show.prizeEscrow).toBe(0);
    expect(show.status).toBe('completed');

    const rows = await refundRows(creator.id, showId);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(501);
    expect(rows[0].metadata.systemAccount).toBe('show_escrow');
  });

  it('2 entrants: 50% and 30% are paid, the remaining 20% is refunded to the creator', async () => {
    const prize = 1001;
    const { creator, showId, entrants } = await runShow({ prize, entrantCount: 2 });

    const paid = await Promise.all(entrants.map(e => moneyOf(e.owner.id)));
    expect(paid.sort((a, b) => b - a)).toEqual([500, 300]); // floor(1001 x .5), floor(1001 x .3)
    expect(await moneyOf(creator.id)).toBe(201); // 1001 - 500 - 300

    const show = await prisma.show.findUnique({ where: { id: showId } });
    expect(show.prizeEscrow).toBe(0);

    const rows = await refundRows(creator.id, showId);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(201);
  });

  it('3 entrants: behaviour unchanged — all three shares paid, no refund row', async () => {
    const prize = 1000;
    const { creator, showId, entrants } = await runShow({ prize, entrantCount: 3 });

    const paid = await Promise.all(entrants.map(e => moneyOf(e.owner.id)));
    expect(paid.sort((a, b) => b - a)).toEqual([500, 300, 200]);
    expect(await moneyOf(creator.id)).toBe(0);

    const show = await prisma.show.findUnique({ where: { id: showId } });
    expect(show.prizeEscrow).toBe(0);
    expect(await refundRows(creator.id, showId)).toHaveLength(0);
  });

  it('a re-driven settlement does not refund twice', async () => {
    const prize = 1001;
    const { creator, showId } = await runShow({ prize, entrantCount: 1 });
    expect(await moneyOf(creator.id)).toBe(501);

    // A plain re-run skips the completed show.
    await executeClosedShows({ body: { showIds: [showId] } }, null);
    expect(await moneyOf(creator.id)).toBe(501);

    // A forced re-drive (the show reopened, as the reaper releases a stranded
    // claim) runs the per-entry payout again; the result row already exists, so
    // that transaction rolls back and the refund inside it with it.
    await prisma.show.update({ where: { id: showId }, data: { status: 'open' } });
    let redriveError = null;
    try {
      await executeClosedShows({ body: { showIds: [showId] } }, null);
    } catch (error) {
      redriveError = error;
    }
    expect(redriveError?.code).toBe('P2002');

    expect(await moneyOf(creator.id)).toBe(501);
    expect(await refundRows(creator.id, showId)).toHaveLength(1);
    const show = await prisma.show.findUnique({ where: { id: showId } });
    expect(show.prizeEscrow).toBe(0);
  });

  // Fix round 1 (owner rulings 2026-10-19).

  it('0 entrants: the full prize escrow is refunded to the creator, once', async () => {
    const prize = 1001;
    const { creator, showId } = await runShow({ prize, entrantCount: 0 });

    expect(await moneyOf(creator.id)).toBe(1001);
    let show = await prisma.show.findUnique({ where: { id: showId } });
    expect(show.prizeEscrow).toBe(0);
    expect(show.status).toBe('completed');
    let rows = await refundRows(creator.id, showId);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(1001);

    // A plain re-run skips the completed show; a forced re-drive (reopened)
    // finds the escrow already drained and refunds nothing more.
    await executeClosedShows({ body: { showIds: [showId] } }, null);
    await prisma.show.update({ where: { id: showId }, data: { status: 'open' } });
    await executeClosedShows({ body: { showIds: [showId] } }, null);

    expect(await moneyOf(creator.id)).toBe(1001);
    rows = await refundRows(creator.id, showId);
    expect(rows).toHaveLength(1);
    show = await prisma.show.findUnique({ where: { id: showId } });
    expect(show.prizeEscrow).toBe(0);
  });

  it('3 entrants, uneven prize: the rounding remainder goes to the winner, escrow ends at 0', async () => {
    const prize = 101; // floor shares 50/30/20 = 100; the 1 coin goes to 1st
    const { creator, showId, entrants } = await runShow({ prize, entrantCount: 3 });

    const paid = await Promise.all(entrants.map(e => moneyOf(e.owner.id)));
    expect(paid.sort((a, b) => b - a)).toEqual([51, 30, 20]);
    const results = await prisma.competitionResult.findMany({
      where: { showId },
      select: { placement: true, prizeWon: true },
    });
    const byPlacement = Object.fromEntries(results.map(r => [String(r.placement), Number(r.prizeWon)]));
    expect(byPlacement['1']).toBe(51);

    expect(await moneyOf(creator.id)).toBe(0);
    const show = await prisma.show.findUnique({ where: { id: showId } });
    expect(show.prizeEscrow).toBe(0);
    expect(await refundRows(creator.id, showId)).toHaveLength(0);
  });

  it('1 entrant with an entry fee: the refund leaves the fee settlement untouched', async () => {
    const prize = 1001;
    const entryFee = 50;
    const { creator, showId, entrants } = await runShow({ prize, entrantCount: 1, entryFee });

    expect(await moneyOf(entrants[0].owner.id)).toBe(500); // paid the 50 fee, won floor(1001 x .5)
    expect(await moneyOf(creator.id)).toBe(501 + 50); // prize refund + the settled fee

    const show = await prisma.show.findUnique({ where: { id: showId } });
    expect(show.prizeEscrow).toBe(0);
    expect(show.feeEscrow).toBe(0);

    const refunds = await refundRows(creator.id, showId);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amount).toBe(501);
    const feeRows = (
      await prisma.userTransaction.findMany({
        where: { userId: creator.id, category: 'show_settle_fees_to_creator' },
      })
    ).filter(r => r.metadata?.showId === showId);
    expect(feeRows).toHaveLength(1);
    expect(feeRows[0].amount).toBe(50);
  });
});
