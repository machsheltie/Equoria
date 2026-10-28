/**
 * enterShowDeferredTx escrow routing sentinel (Equoria-jnk6r).
 *
 * Sibling defect of Equoria-si69u: si69u fixed the canonical
 * showController.enterShow path (POST /api/v1/shows/:id/enter) to route entry
 * fees through SystemAccount[showEscrow] + per-show feeEscrow column. The
 * deferred-entry route POST /api/v1/competition/enter — used by the live
 * frontend competitionsApi.enter — calls enterShowDeferredTx in
 * competitionRouteQueries.mjs, which still ran the pre-si69u "credit creator
 * directly" pattern. That bypassed escrow entirely: GDPR-deleting the
 * creator mid-show silently destroyed entry-fee money with no audit row, and
 * the show executor (which now expects feeEscrow > 0 to pay creator OR burn)
 * had nothing to settle.
 *
 * This sentinel locks the contract:
 *   - After enterShowDeferredTx, the creator's User.money is UNCHANGED.
 *   - The fee was credited to SystemAccount[showEscrow]: the entry's own
 *     escrow-credit ledger row (category showEntryFeeEscrow, systemAccount
 *     showEscrow, this show) exists exactly once. creditSystemAccount writes it
 *     right after the balance increment, inside the entry transaction, so it
 *     exists if and only if that credit committed.
 *   - Show.feeEscrow has incremented by entryFee.
 *   - Total money is conserved end-to-end over the rows this suite owns.
 *
 * Equoria-4ug1a: the shared SystemAccount[showEscrow] singleton is NOT read.
 * Every suite that enters, settles or cancels a show moves that one row, so
 * `escrowAfter === escrowBefore + fee` failed whenever a sibling suite moved it
 * between the two reads (the Equoria-dot2i flake class). The per-show feeEscrow
 * column and the entry's ledger row are owned by this suite and prove the same
 * routing exactly.
 *
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { SYSTEM_ACCOUNT_SHOW_ESCROW, creditSystemAccount } from '../../economy/index.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { enterShowDeferredTx } from '../services/competitionRouteQueries.mjs';
// Equoria-576c0 B9: enterShowDeferredTx runs the shared entry rules first (age
// 3-20, an eligible rider; the XP bracket is gone, R9). Fixture horses are
// eligible, so this suite still exercises ONLY the escrow money-flow.
import { competitionDateOfBirth, giveEligibleRider } from '../../../__tests__/helpers/eligibleCompetitor.mjs';
import { releaseShowEscrow } from '../../../__tests__/helpers/releaseShowEscrow.mjs';

const FIXTURE_PREFIX = 'TestFixture-jnk6r-escrow';

let creator;
let entrant;
let entrantHorse;
const createdUserIds = [];
const createdHorseIds = [];
const createdShowIds = [];
const createdRiderIds = [];

async function snapMoney(userIds) {
  if (userIds.length === 0) {
    return 0;
  }
  const rows = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { money: true } });
  return rows.reduce((s, r) => s + Number(r.money), 0);
}

// The show's own escrow columns: the per-show half of the escrow invariant
// (SystemAccount[showEscrow] == SUM(prizeEscrow + feeEscrow)), owned by this suite.
async function snapShowEscrow(showId) {
  const row = await prisma.show.findUnique({ where: { id: showId }, select: { prizeEscrow: true, feeEscrow: true } });
  return Number(row.prizeEscrow) + Number(row.feeEscrow);
}

// The ledger rows creditSystemAccount writes for this show's entry-fee escrow credits.
function escrowCreditRows(showId, userId) {
  return prisma.userTransaction.findMany({
    where: {
      userId,
      category: 'showEntryFeeEscrow',
      metadata: { path: ['showId'], equals: showId },
    },
  });
}

async function makeUser(money, suffix) {
  const tag = randomBytes(4).toString('hex');
  const u = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${FIXTURE_PREFIX}-${suffix}-${tag}`,
      email: `${FIXTURE_PREFIX}-${suffix}-${tag}@example.com`,
      password: 'irrelevant-hash',
      firstName: 'Esc',
      lastName: suffix,
      money,
    },
  });
  createdUserIds.push(u.id);
  return u;
}

async function makeHorse(ownerId) {
  const h = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${randomBytes(4).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: competitionDateOfBirth(),
      age: 7,
      userId: ownerId,
      healthStatus: 'Excellent',
      lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
    },
  });
  createdHorseIds.push(h.id);
  await giveEligibleRider(prisma, { horseId: h.id, userId: ownerId }, createdRiderIds);
  return h;
}

// The 1000 prize escrow is credited to SystemAccount[showEscrow] with the row,
// as createShow does, so teardown can release it (Equoria-r3mv2).
async function makeShow(creatorId, entryFee) {
  const s = await prisma.$transaction(async tx => {
    await creditSystemAccount(tx, 'showEscrow', 1000, { category: 'testFixturePrizeEscrow' });
    return tx.show.create({
      data: {
        name: `${FIXTURE_PREFIX}-show-${randomBytes(4).toString('hex')}`,
        discipline: 'Dressage',
        entryFee,
        maxEntries: null,
        levelMin: 1,
        levelMax: 10,
        prize: 1000,
        runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        closeDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        openDate: new Date(),
        status: 'open',
        createdByUserId: creatorId,
        prizeEscrow: 1000,
        feeEscrow: 0,
      },
    });
  });
  createdShowIds.push(s.id);
  return s;
}

beforeAll(async () => {
  creator = await makeUser(10000, 'creator');
  entrant = await makeUser(500, 'entrant');
  entrantHorse = await makeHorse(entrant.id);
}, 60000);

afterAll(async () => {
  // Equoria-r3mv2: hand back the escrow these shows still hold before the raw deletes.
  await releaseShowEscrow(createdShowIds);
  for (const sid of createdShowIds) {
    await prisma.showEntry
      .deleteMany({ where: { showId: sid } })
      .catch(err => console.warn(`[cleanup] showEntry: ${err.message}`));
    await prisma.show.delete({ where: { id: sid } }).catch(err => console.warn(`[cleanup] show: ${err.message}`));
  }
  if (createdHorseIds.length) {
    await prisma.horse
      .deleteMany({ where: { id: { in: createdHorseIds } } })
      .catch(err => console.warn(`[cleanup] horse: ${err.message}`));
  }
  await prisma.rider.deleteMany({ where: { id: { in: createdRiderIds } } });
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] userTransaction: ${err.message}`));
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] user: ${err.message}`));
  }
  // Equoria-iomtg: do NOT reset the shared SystemAccount[showEscrow]/[burn]
  // rows here. They are singleton rows shared with sibling suites
  // (systemAccountHelpers, showEscrowMoneyConservation, gdprShowCancel,
  // buyStoreHorse, groomSalary). A `balance: 0` set in this suite's teardown
  // clobbers whatever a concurrent sibling has in flight under --runInBand /
  // parallel shards. No assertion below reads those rows (Equoria-4ug1a), so
  // there is nothing to reset.
}, 30000);

describe('enterShowDeferredTx escrow routing (Equoria-jnk6r)', () => {
  it('SENTINEL: entry fee credits SystemAccount[showEscrow], NOT the creator wallet', async () => {
    const entryFee = 100;
    const show = await makeShow(creator.id, entryFee);

    const creatorBefore = await prisma.user.findUnique({ where: { id: creator.id }, select: { money: true } });
    const entrantBefore = await prisma.user.findUnique({ where: { id: entrant.id }, select: { money: true } });

    const entry = await enterShowDeferredTx({
      show,
      showId: show.id,
      horseId: entrantHorse.id,
      userId: entrant.id,
    });
    expect(entry).toBeTruthy();
    expect(entry.feePaid).toBe(entryFee);

    const creatorAfter = await prisma.user.findUnique({ where: { id: creator.id }, select: { money: true } });
    const entrantAfter = await prisma.user.findUnique({ where: { id: entrant.id }, select: { money: true } });
    const showAfter = await prisma.show.findUnique({ where: { id: show.id }, select: { feeEscrow: true } });

    expect(Number(entrantAfter.money)).toBe(Number(entrantBefore.money) - entryFee);
    // THE BUG GUARD: creator wallet must NOT have grown by the fee.
    expect(Number(creatorAfter.money)).toBe(Number(creatorBefore.money));
    // The fee went to SystemAccount[showEscrow]: exactly one escrow credit of
    // the fee for this show, attributed to the entrant.
    const credits = await escrowCreditRows(show.id, entrant.id);
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({ type: 'credit', amount: entryFee });
    expect(credits[0].metadata).toMatchObject({ systemAccount: SYSTEM_ACCOUNT_SHOW_ESCROW, showId: show.id });
    expect(Number(showAfter.feeEscrow)).toBe(entryFee);
  });

  it('SENTINEL: money conservation across deferred-entry path', async () => {
    const entryFee = 75;
    const show = await makeShow(creator.id, entryFee);
    const userIds = [creator.id, entrant.id];
    // Every coin in this flow is in a row this suite owns: the two wallets and
    // this show's escrow columns (the fee leaves the entrant and is held for
    // this show). Conserved over those rows, without the shared singletons.
    const totalBefore = (await snapMoney(userIds)) + (await snapShowEscrow(show.id));
    await enterShowDeferredTx({
      show,
      showId: show.id,
      horseId: entrantHorse.id,
      userId: entrant.id,
    });
    const totalAfter = (await snapMoney(userIds)) + (await snapShowEscrow(show.id));
    expect(totalAfter).toBe(totalBefore);
    expect(await escrowCreditRows(show.id, entrant.id)).toHaveLength(1);
  });

  it('SENTINEL: self-entry (creator entering their own show) still routes fee through escrow', async () => {
    const entryFee = 50;
    const creatorHorse = await makeHorse(creator.id);
    const show = await makeShow(creator.id, entryFee);
    const creatorBefore = await prisma.user.findUnique({ where: { id: creator.id }, select: { money: true } });
    await enterShowDeferredTx({
      show,
      showId: show.id,
      horseId: creatorHorse.id,
      userId: creator.id,
    });
    const creatorAfter = await prisma.user.findUnique({ where: { id: creator.id }, select: { money: true } });
    const showAfter = await prisma.show.findUnique({ where: { id: show.id }, select: { feeEscrow: true } });
    expect(Number(creatorAfter.money)).toBe(Number(creatorBefore.money) - entryFee);
    const credits = await escrowCreditRows(show.id, creator.id);
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({ type: 'credit', amount: entryFee });
    expect(credits[0].metadata).toMatchObject({ systemAccount: SYSTEM_ACCOUNT_SHOW_ESCROW, showId: show.id });
    expect(Number(showAfter.feeEscrow)).toBe(entryFee);
  });
});
