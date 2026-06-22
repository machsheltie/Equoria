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

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { SYSTEM_ACCOUNT_BURN } from '../modules/economy/index.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { createShow, enterShow, executeClosedShows } from '../modules/competition/index.mjs';

const FIXTURE_PREFIX = 'TestFixture-si69u-conserv';

let creator;
let entrants;
let entrantHorses;
let showId;
const createdUserIds = [];
const createdHorseIds = [];
const createdShowIds = [];

async function snapMoney(userIds) {
  if (userIds.length === 0) {
    return 0;
  }
  const rows = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { money: true },
  });
  return rows.reduce((s, r) => s + Number(r.money), 0);
}

async function snapBurn() {
  const row = await prisma.systemAccount.findUnique({
    where: { name: SYSTEM_ACCOUNT_BURN },
    select: { balance: true },
  });
  return row ? Number(row.balance) : 0;
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
  entrants = await Promise.all([makeUser(500, 'entrant1'), makeUser(500, 'entrant2'), makeUser(500, 'entrant3')]);
  entrantHorses = await Promise.all(entrants.map(e => makeHorse(e.id)));
}, 60000);

afterAll(async () => {
  for (const sid of createdShowIds) {
    await prisma.competitionResult
      .deleteMany({ where: { showId: sid } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.showEntry
      .deleteMany({ where: { showId: sid } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.show.delete({ where: { id: sid } }).catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdHorseIds.length) {
    await prisma.horse
      .deleteMany({ where: { id: { in: createdHorseIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  // Equoria-3n2g4: do NOT reset the shared SystemAccount[show_escrow]/[burn]
  // rows here. Those rows are SHARED across every money-conservation suite, and
  // sibling suites run concurrently under maxWorkers=50%. Forcing them to 0
  // clobbered a sibling suite's in-flight balance mid-measurement (the exact
  // cross-interference this issue tracks). This suite now asserts SUITE-SCOPED
  // signals only (per-show escrow columns + suite-owned user money deltas), so
  // it neither needs nor is allowed to mutate the shared singletons globally.
}, 30000);

describe('Show escrow money-conservation sentinel (Equoria-si69u)', () => {
  it('SENTINEL: creator stays alive — money conserved + creator gets accumulated fees', async () => {
    const userIds = [creator.id, ...entrants.map(e => e.id)];
    // Equoria-3n2g4: conservation is asserted over SUITE-OWNED user wallets +
    // the per-show escrow columns ONLY — never the shared SystemAccount
    // singletons. Every dollar in this flow originates from and returns to a
    // user this suite owns: creator funds the prize, entrants pay fees, the
    // winning entrant collects the prize, and the (surviving) creator collects
    // the accumulated fees. So the suite-user total is invariant across the
    // lifecycle without reading any shared account a sibling worker can touch.
    const moneyBefore = await snapMoney(userIds);

    // 1. Create show (debits creator's prize → escrow).
    const createReq = {
      user: { id: creator.id },
      body: {
        name: `${FIXTURE_PREFIX}-show-${randomBytes(4).toString('hex')}`,
        discipline: 'Dressage',
        entryFee: 50,
        prize: 1000,
        level: 1,
      },
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

    // Conservation over suite-owned wallets: the prize and all fees flowed
    // among this suite's users and returned to them in full (winner + creator),
    // so the suite-user total is unchanged.
    const moneyAfter = await snapMoney(userIds);
    expect(moneyAfter).toBe(moneyBefore);

    // Per-show escrow columns are the concurrency-proof drained-to-zero signal:
    // every dollar this show held reached a final owner. (Reading the SHARED
    // SystemAccount balances here would be racy under parallel siblings; the
    // per-show columns are owned exclusively by THIS show row.)
    const showAfter = await prisma.show.findUnique({ where: { id: showId } });
    expect(showAfter.prizeEscrow).toBe(0);
    expect(showAfter.feeEscrow).toBe(0);
  });

  it('SENTINEL: creator deleted mid-show — money STILL conserved + accumulated fees burned with audit', async () => {
    const userIds = [creator.id, ...entrants.map(e => e.id)];
    const FEE = 50;
    const ENTRANT_COUNT = entrants.length;
    const EXPECTED_BURNED_FEES = FEE * ENTRANT_COUNT; // 150
    // Equoria-3n2g4: suite-scoped conservation. With the creator FK nulled at
    // execute time the accumulated fees go to the SHARED burn account (no
    // creator wallet to receive them). We prove conservation via SUITE-OWNED
    // signals: the suite-user wallet total drops by EXACTLY the burned fees
    // (winner reclaims the prize, entrants' fees are the only money that left
    // the suite), and the per-show escrow columns drain to 0. We additionally
    // assert the burn account GAINED at least the fee total (delta lower bound)
    // — a concurrent sibling can only inflate it, so an exact equality on the
    // shared row would be racy.
    const moneyBefore = await snapMoney(userIds);
    const burnBefore = await snapBurn();

    const createReq = {
      user: { id: creator.id },
      body: {
        name: `${FIXTURE_PREFIX}-show-${randomBytes(4).toString('hex')}`,
        discipline: 'Dressage',
        entryFee: 50,
        prize: 1000,
        level: 1,
      },
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

    // The creator's user row still exists in our fixture (we only nulled the
    // FK), so we can still snap their money. The suite-user total must drop by
    // exactly the burned fees: the winner reclaimed the prize (net 0 on prize),
    // and the 3 entry fees are the only money that left the suite — routed to
    // the shared burn account because the FK was null at execute time.
    const moneyAfter = await snapMoney(userIds);
    expect(moneyBefore - moneyAfter).toBe(EXPECTED_BURNED_FEES);

    // Per-show escrow columns drained — all prize paid, all fees burned. These
    // columns belong exclusively to THIS show row (concurrency-proof).
    const showAfter = await prisma.show.findUnique({ where: { id: sid } });
    expect(showAfter.prizeEscrow).toBe(0);
    expect(showAfter.feeEscrow).toBe(0);

    // The SHARED burn account GAINED at least the accumulated fees. A
    // concurrent money-conservation sibling can only inflate this delta, so we
    // assert the lower bound rather than an exact equality (Equoria-3n2g4).
    // Pre-si69u this case lost 150 from the economy with no audit row.
    const burnAfter = await snapBurn();
    expect(burnAfter - burnBefore).toBeGreaterThanOrEqual(EXPECTED_BURNED_FEES);
  });
});
