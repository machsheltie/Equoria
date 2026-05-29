/**
 * Show escrow money-conservation sentinel (Equoria-si69u).
 *
 * The bug si69u fixes: pre-fix, every entry fee was credited directly to
 * Show.createdByUser.money. If the creator GDPR-deleted their account
 * mid-show, createdByUserId was nulled and subsequent entry fees vanished
 * with no counterparty — money silently destroyed from the in-game economy
 * with no audit trail. Winners were still paid the prize, but from "nowhere"
 * (the system implicitly minted at payout time).
 *
 * The fix routes show money through SystemAccount[show_escrow] with per-show
 * `prizeEscrow` + `feeEscrow` accounting columns. At execute time:
 *   - Winner prize comes from escrow (no implicit minting).
 *   - Accumulated fees go to creator if still around; else to
 *     SystemAccount[burn] (explicit destruction with audit trail).
 *
 * THIS SENTINEL asserts the resulting INVARIANT:
 *   total = sum(User.money for all involved users)
 *         + sum(SystemAccount.balance for show_escrow + burn)
 *   remains CONSTANT across the entire lifecycle, including the
 *   creator-deletion path that the bug allowed to leak money.
 *
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import app from '../../packages/database/prismaClient.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import {
  SYSTEM_ACCOUNT_SHOW_ESCROW,
  SYSTEM_ACCOUNT_BURN,
} from '../services/financialLedgerService.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { createShow, enterShow, executeClosedShows } from '../modules/competition/shows/showController.mjs';

const FIXTURE_PREFIX = 'TestFixture-si69u-conserv';

let creator;
let entrants;
let entrantHorses;
let showId;
const createdUserIds = [];
const createdHorseIds = [];
const createdShowIds = [];

async function snapMoney(userIds) {
  if (userIds.length === 0) return 0;
  const rows = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { money: true },
  });
  return rows.reduce((s, r) => s + Number(r.money), 0);
}

async function snapSystem() {
  const rows = await prisma.systemAccount.findMany({
    where: { name: { in: [SYSTEM_ACCOUNT_SHOW_ESCROW, SYSTEM_ACCOUNT_BURN] } },
  });
  return rows.reduce((s, r) => s + Number(r.balance), 0);
}

function fakeRes() {
  // Minimal Express res shim for direct controller invocation.
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

async function makeUser(money, suffix) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const u = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${suffix}-${tag}`,
      email: `${FIXTURE_PREFIX}-${suffix}-${tag}@example.com`,
      password: pw,
      firstName: 'Cons',
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
      speed: 60,
      stamina: 60,
      agility: 60,
      balance: 60,
      precision: 60,
      boldness: 60,
    },
  });
  createdHorseIds.push(h.id);
  return h;
}

beforeAll(async () => {
  creator = await makeUser(10000, 'creator');
  entrants = await Promise.all([
    makeUser(500, 'entrant1'),
    makeUser(500, 'entrant2'),
    makeUser(500, 'entrant3'),
  ]);
  entrantHorses = await Promise.all(entrants.map(e => makeHorse(e.id)));
}, 60000);

afterAll(async () => {
  for (const sid of createdShowIds) {
    await prisma.competitionResult.deleteMany({ where: { showId: sid } }).catch(() => {});
    await prisma.showEntry.deleteMany({ where: { showId: sid } }).catch(() => {});
    await prisma.show.delete({ where: { id: sid } }).catch(() => {});
  }
  if (createdHorseIds.length) {
    await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }).catch(() => {});
  }
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
  }
  // Reset system accounts to zero for the next suite.
  await prisma.systemAccount
    .updateMany({
      where: { name: { in: [SYSTEM_ACCOUNT_SHOW_ESCROW, SYSTEM_ACCOUNT_BURN] } },
      data: { balance: 0 },
    })
    .catch(() => {});
}, 30000);

beforeEach(async () => {
  // Reset escrow + burn to 0 between tests so each test computes
  // money-conservation cleanly.
  await prisma.systemAccount.update({
    where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
    data: { balance: 0 },
  });
  await prisma.systemAccount.update({
    where: { name: SYSTEM_ACCOUNT_BURN },
    data: { balance: 0 },
  });
});

describe('Show escrow money-conservation sentinel (Equoria-si69u)', () => {
  it('SENTINEL: creator stays alive — money conserved + creator gets accumulated fees', async () => {
    const userIds = [creator.id, ...entrants.map(e => e.id)];
    const totalBefore = (await snapMoney(userIds)) + (await snapSystem());

    // 1. Create show (debits creator's prize → escrow).
    const createReq = {
      user: { id: creator.id },
      body: { name: `${FIXTURE_PREFIX}-show-${randomBytes(4).toString('hex')}`, discipline: 'Dressage', entryFee: 50, prize: 1000, level: 1 },
    };
    const createRes = fakeRes();
    await createShow(createReq, createRes);
    expect(createRes.statusCode).toBe(201);
    showId = createRes.body.data.show.id;
    createdShowIds.push(showId);

    // 2. 3 entrants pay fees → escrow (NOT directly to creator).
    for (let i = 0; i < entrants.length; i++) {
      const enterReq = {
        user: { id: entrants[i].id },
        params: { id: String(showId) },
        body: { horseId: entrantHorses[i].id },
      };
      const enterRes = fakeRes();
      await enterShow(enterReq, enterRes);
      expect(enterRes.statusCode).toBe(201);
    }

    // 3. Force-close + execute the show.
    await prisma.show.update({
      where: { id: showId },
      data: { closeDate: new Date(Date.now() - 60 * 60 * 1000) },
    });
    await executeClosedShows({}, null);

    // Final snapshot.
    const totalAfter = (await snapMoney(userIds)) + (await snapSystem());
    expect(totalAfter).toBe(totalBefore);

    // The two system accounts should both be 0 — every dollar reached
    // a final owner (winner + creator).
    const sys = await prisma.systemAccount.findMany({
      where: { name: { in: [SYSTEM_ACCOUNT_SHOW_ESCROW, SYSTEM_ACCOUNT_BURN] } },
    });
    for (const a of sys) {
      expect(Number(a.balance)).toBe(0);
    }
  });

  it('SENTINEL: creator deleted mid-show — money STILL conserved + accumulated fees burned with audit', async () => {
    const userIds = [creator.id, ...entrants.map(e => e.id)];
    const totalBefore = (await snapMoney(userIds)) + (await snapSystem());

    const createReq = {
      user: { id: creator.id },
      body: { name: `${FIXTURE_PREFIX}-show-${randomBytes(4).toString('hex')}`, discipline: 'Dressage', entryFee: 50, prize: 1000, level: 1 },
    };
    const createRes = fakeRes();
    await createShow(createReq, createRes);
    expect(createRes.statusCode).toBe(201);
    const sid = createRes.body.data.show.id;
    createdShowIds.push(sid);

    for (let i = 0; i < entrants.length; i++) {
      const enterReq = {
        user: { id: entrants[i].id },
        params: { id: String(sid) },
        body: { horseId: entrantHorses[i].id },
      };
      await enterShow(enterReq, fakeRes());
    }

    // ATTACKER STEP: null the creator's createdByUserId on the show row
    // (this is what gdprAccountService does for shows hosted/created by
    // the deleting user — the user row itself is deleted by the cascade,
    // but the show row survives with createdByUserId = null).
    await prisma.show.update({
      where: { id: sid },
      data: { createdByUserId: null, closeDate: new Date(Date.now() - 60 * 60 * 1000) },
    });

    await executeClosedShows({}, null);

    // The creator's user row still exists in our fixture (we only nulled
    // the FK), so we can still snap their money. In a real GDPR cascade
    // the creator row is gone — but the snap includes only entrants and
    // creator (creator's money should NOT have grown because the FK was
    // null at execute time → fees went to burn, not to creator).
    const totalAfter = (await snapMoney(userIds)) + (await snapSystem());
    expect(totalAfter).toBe(totalBefore);

    // The burn account should now hold the accumulated fees: 3 × 50 = 150.
    const burn = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_BURN },
    });
    expect(Number(burn.balance)).toBe(150);

    // show_escrow should be drained — all prize paid, all fees burned.
    const escrow = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
    });
    expect(Number(escrow.balance)).toBe(0);

    // Pre-si69u this case lost 150 from the economy with no audit row.
    // Post-si69u the 150 sits in SystemAccount[burn] with a paired
    // SystemAccount.balance mutation that's reconcilable.
  });
});
