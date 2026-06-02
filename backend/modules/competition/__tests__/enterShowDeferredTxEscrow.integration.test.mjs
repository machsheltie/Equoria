/**
 * enterShowDeferredTx escrow routing sentinel (Equoria-jnk6r).
 *
 * Sibling defect of Equoria-si69u: si69u fixed the canonical
 * showController.enterShow path (POST /api/v1/shows/:id/enter) to route entry
 * fees through SystemAccount[show_escrow] + per-show feeEscrow column. The
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
 *   - SystemAccount[show_escrow].balance has incremented by entryFee.
 *   - Show.feeEscrow has incremented by entryFee.
 *   - Total money is conserved end-to-end.
 *
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { SYSTEM_ACCOUNT_SHOW_ESCROW, SYSTEM_ACCOUNT_BURN } from '../../economy/services/financialLedgerService.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { enterShowDeferredTx } from '../services/competitionRouteQueries.mjs';

const FIXTURE_PREFIX = 'TestFixture-jnk6r-escrow';

let creator;
let entrant;
let entrantHorse;
const createdUserIds = [];
const createdHorseIds = [];
const createdShowIds = [];

async function snapMoney(userIds) {
  if (userIds.length === 0) {
    return 0;
  }
  const rows = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { money: true } });
  return rows.reduce((s, r) => s + Number(r.money), 0);
}

async function snapSystem() {
  const rows = await prisma.systemAccount.findMany({
    where: { name: { in: [SYSTEM_ACCOUNT_SHOW_ESCROW, SYSTEM_ACCOUNT_BURN] } },
  });
  return rows.reduce((s, r) => s + Number(r.balance), 0);
}

async function makeUser(money, suffix) {
  const tag = randomBytes(4).toString('hex');
  const u = await prisma.user.create({
    data: {
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
      dateOfBirth: new Date('2018-06-15'),
      age: 7,
      userId: ownerId,
      healthStatus: 'healthy',
    },
  });
  createdHorseIds.push(h.id);
  return h;
}

async function makeShow(creatorId, entryFee) {
  const s = await prisma.show.create({
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
  createdShowIds.push(s.id);
  return s;
}

beforeAll(async () => {
  creator = await makeUser(10000, 'creator');
  entrant = await makeUser(500, 'entrant');
  entrantHorse = await makeHorse(entrant.id);
}, 60000);

afterAll(async () => {
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
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] userTransaction: ${err.message}`));
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] user: ${err.message}`));
  }
  // Equoria-iomtg: do NOT reset the shared SystemAccount[show_escrow]/[burn]
  // rows here. They are singleton rows shared with sibling suites
  // (systemAccountHelpers, showEscrowMoneyConservation, gdprShowCancel,
  // buyStoreHorse, groomSalary). A `balance: 0` set in this suite's teardown
  // clobbers whatever a concurrent sibling has in flight under --runInBand /
  // parallel shards. Every assertion below is delta-based (escrowBefore →
  // escrowAfter + fee, or snapSystem() before/after a single op), so this
  // suite never depends on an absolute shared-account balance it did not
  // itself establish — there is nothing to reset.
}, 30000);

describe('enterShowDeferredTx escrow routing (Equoria-jnk6r)', () => {
  it('SENTINEL: entry fee credits SystemAccount[show_escrow], NOT the creator wallet', async () => {
    const entryFee = 100;
    const show = await makeShow(creator.id, entryFee);

    const creatorBefore = await prisma.user.findUnique({ where: { id: creator.id }, select: { money: true } });
    const entrantBefore = await prisma.user.findUnique({ where: { id: entrant.id }, select: { money: true } });
    const escrowBefore = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
      select: { balance: true },
    });

    const entry = await enterShowDeferredTx({ show, showId: show.id, horseId: entrantHorse.id, userId: entrant.id });
    expect(entry).toBeTruthy();
    expect(entry.feePaid).toBe(entryFee);

    const creatorAfter = await prisma.user.findUnique({ where: { id: creator.id }, select: { money: true } });
    const entrantAfter = await prisma.user.findUnique({ where: { id: entrant.id }, select: { money: true } });
    const escrowAfter = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
      select: { balance: true },
    });
    const showAfter = await prisma.show.findUnique({ where: { id: show.id }, select: { feeEscrow: true } });

    expect(Number(entrantAfter.money)).toBe(Number(entrantBefore.money) - entryFee);
    // THE BUG GUARD: creator wallet must NOT have grown by the fee.
    expect(Number(creatorAfter.money)).toBe(Number(creatorBefore.money));
    expect(Number(escrowAfter.balance)).toBe(Number(escrowBefore.balance) + entryFee);
    expect(Number(showAfter.feeEscrow)).toBe(entryFee);
  });

  it('SENTINEL: money conservation across deferred-entry path', async () => {
    const entryFee = 75;
    const show = await makeShow(creator.id, entryFee);
    const userIds = [creator.id, entrant.id];
    const totalBefore = (await snapMoney(userIds)) + (await snapSystem());
    await enterShowDeferredTx({ show, showId: show.id, horseId: entrantHorse.id, userId: entrant.id });
    const totalAfter = (await snapMoney(userIds)) + (await snapSystem());
    expect(totalAfter).toBe(totalBefore);
  });

  it('SENTINEL: self-entry (creator entering their own show) still routes fee through escrow', async () => {
    const entryFee = 50;
    const creatorHorse = await makeHorse(creator.id);
    const show = await makeShow(creator.id, entryFee);
    const creatorBefore = await prisma.user.findUnique({ where: { id: creator.id }, select: { money: true } });
    const escrowBefore = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
      select: { balance: true },
    });
    await enterShowDeferredTx({ show, showId: show.id, horseId: creatorHorse.id, userId: creator.id });
    const creatorAfter = await prisma.user.findUnique({ where: { id: creator.id }, select: { money: true } });
    const escrowAfter = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
      select: { balance: true },
    });
    const showAfter = await prisma.show.findUnique({ where: { id: show.id }, select: { feeEscrow: true } });
    expect(Number(creatorAfter.money)).toBe(Number(creatorBefore.money) - entryFee);
    expect(Number(escrowAfter.balance)).toBe(Number(escrowBefore.balance) + entryFee);
    expect(Number(showAfter.feeEscrow)).toBe(entryFee);
  });
});
