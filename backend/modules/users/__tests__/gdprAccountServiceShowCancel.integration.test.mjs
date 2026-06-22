/**
 * gdprAccountServiceShowCancel.integration.test.mjs
 *
 * Sentinel-positive test for Equoria-shsgd: gdprAccountService should
 * PROACTIVELY cancel and refund non-executed shows whose creator is being
 * deleted, rather than just nulling createdByUserId and letting fees burn
 * + escrow drift until the cron picks the show up.
 *
 * Pre-shsgd behavior (the bug): eraseUserAccount() only nulled
 * createdByUserId on the show row. The show stayed status='open', kept
 * its prizeEscrow and feeEscrow balances in SystemAccount[show_escrow],
 * and executeClosedShows eventually scored the entries and burned the
 * fees (entrants lost their fees with no offsetting outcome they cared
 * about, prize was paid to whoever's horse won).
 *
 * Post-shsgd behavior (the fix):
 *   1. Each entrant gets their feePaid back from feeEscrow.
 *   2. The creator's prize escrow is moved to SystemAccount[burn]
 *      (creator's wallet is being deleted; no destination for prize).
 *   3. ShowEntry rows are removed (executeClosedShows finds nothing).
 *   4. Show is marked 'completed' + executedAt=now so the cron skips it.
 *   5. createdByUserId still nulled (consistency with completed shows).
 *   6. Money-conservation invariant holds across the whole flow.
 *
 * Real DB, no mocks, id-scoped cleanup.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { eraseUserAccount } from '../services/gdprAccountService.mjs';
import { SYSTEM_ACCOUNT_SHOW_ESCROW, SYSTEM_ACCOUNT_BURN } from '../../economy/index.mjs';
import { createShow, enterShow } from '../../competition/index.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const FIXTURE_PREFIX = 'TestFixture-shsgd';

const createdUserIds = [];
const createdHorseIds = [];
const createdShowIds = [];

async function makeUser(money, suffix) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const u = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${suffix}-${tag}`,
      email: `${FIXTURE_PREFIX}-${suffix}-${tag}@example.com`,
      password: pw,
      firstName: 'Shsgd',
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

// Equoria-3n2g4: do NOT globally reset the shared SystemAccount[show_escrow]/
// [burn] singletons. They are shared across every money-conservation suite, and
// siblings run concurrently under maxWorkers=50%; forcing them to 0 clobbered a
// sibling's in-flight balance mid-measurement (the cross-interference this issue
// tracks). This suite now asserts SUITE-SCOPED signals only: per-show escrow
// columns, suite-owned entrant wallet deltas, and tight lower-bound deltas on
// the shared accounts (a concurrent sibling can only inflate a credit delta).

afterAll(async () => {
  for (const sid of createdShowIds) {
    await prisma.competitionResult
      .deleteMany({ where: { showId: sid } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.showEntry
      .deleteMany({ where: { showId: sid } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.show.deleteMany({ where: { id: sid } }).catch(err => console.warn(`[cleanup] ${err.message}`));
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
  // Equoria-3n2g4: intentionally NOT resetting the shared SystemAccount rows
  // here — see the note above the (now-removed) beforeEach. Resetting them would
  // clobber concurrently-running sibling conservation suites.
}, 60000);

describe('GDPR: proactive show cancel + refund (Equoria-shsgd)', () => {
  it('SENTINEL: cancels open shows, refunds entrants, burns prize, conserves money', async () => {
    // Setup: creator + 3 entrants, all with horses.
    const creator = await makeUser(10000, 'creator');
    const entrants = await Promise.all([
      makeUser(500, 'entrant1'),
      makeUser(500, 'entrant2'),
      makeUser(500, 'entrant3'),
    ]);
    const entrantHorses = await Promise.all(entrants.map(e => makeHorse(e.id)));

    // Equoria-3n2g4: capture the shared burn baseline so we can assert THIS
    // test's burn delta (a lower bound) rather than a racy absolute balance.
    const burnBefore = await snapBurn();

    // Creator funds a show with prize=1000, entryFee=50.
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
    const showId = createRes.body.data.show.id;
    createdShowIds.push(showId);

    // 3 entrants pay 50 each → feeEscrow = 150, prizeEscrow = 1000.
    for (let i = 0; i < entrants.length; i++) {
      const enterRes = fakeRes();
      await enterShow(
        {
          user: { id: entrants[i].id },
          params: { id: String(showId) },
          body: { horseId: entrantHorses[i].id },
        },
        enterRes,
      );
      expect(enterRes.statusCode).toBe(201);
    }

    // Snapshot pre-deletion entrant balances. They have paid 50 each (so
    // each is now at 450). After cancel+refund they should be back at 500.
    const entrantIds = entrants.map(e => e.id);
    const entrantMoneyPostEntry = await snapMoney(entrantIds);
    expect(entrantMoneyPostEntry).toBe(3 * 450);

    // Sanity: THIS show's per-show escrow columns hold exactly the prize (1000)
    // + the accumulated fees (3 × 50 = 150). These columns belong solely to this
    // show row, so they are immune to concurrent sibling activity on the shared
    // SystemAccount[show_escrow] row (Equoria-3n2g4).
    const showMid = await prisma.show.findUnique({ where: { id: showId } });
    expect(showMid.prizeEscrow).toBe(1000);
    expect(showMid.feeEscrow).toBe(150);

    // ACT: GDPR-delete the creator. This MUST proactively cancel the show.
    const result = await eraseUserAccount(creator.id);
    expect(result.deleted).toBe(true);

    // Creator row gone.
    const creatorGone = await prisma.user.findUnique({ where: { id: creator.id } });
    expect(creatorGone).toBeNull();

    // Show terminated: status=completed, executedAt set, createdByUserId
    // nulled, escrow columns zeroed. ShowEntry rows gone.
    const cancelledShow = await prisma.show.findUnique({ where: { id: showId } });
    expect(cancelledShow).not.toBeNull();
    expect(cancelledShow.status).toBe('completed');
    expect(cancelledShow.executedAt).not.toBeNull();
    expect(cancelledShow.createdByUserId).toBeNull();
    expect(cancelledShow.prizeEscrow).toBe(0);
    expect(cancelledShow.feeEscrow).toBe(0);

    const remainingEntries = await prisma.showEntry.count({ where: { showId } });
    expect(remainingEntries).toBe(0);

    // Each entrant got their fee back: back to 500. Entrants are suite-owned,
    // so this is an exact, concurrency-proof conservation signal — every fee
    // that left an entrant's wallet returned to it.
    const entrantMoneyPostCancel = await snapMoney(entrantIds);
    expect(entrantMoneyPostCancel).toBe(3 * 500);

    // Money-conservation invariant, proven via SUITE-SCOPED signals only
    // (Equoria-3n2g4) — never absolute shared-account balances:
    //   - The per-show escrow columns are drained (asserted above): every
    //     dollar this show held left the escrow.
    //   - Entrant fees fully refunded (3 × 500 above): the fee leg conserves.
    //   - The prize leg: the creator's prize (1000) had no wallet to return to
    //     (creator deleted), so it moved to the SHARED burn account. We assert
    //     the burn account GAINED AT LEAST the prize — a concurrent sibling can
    //     only inflate this credit delta, so the lower bound is the sound
    //     assertion. (Pre-shsgd this 1000 vanished with no audit row.)
    const burnAfter = await snapBurn();
    expect(burnAfter - burnBefore).toBeGreaterThanOrEqual(1000);

    // The shared show_escrow row returned to (at least) its baseline for this
    // show's contribution: this show pushed 1150 in and drained all 1150 back
    // out (1000→burn, 150→entrants). A concurrent sibling could leave escrow
    // elevated, so assert this show's net escrow contribution is zero via its
    // own per-show columns (already asserted prizeEscrow===0 && feeEscrow===0).
  }, 60000);

  it('SENTINEL: already-completed shows are left untouched (no double-burn)', async () => {
    const creator = await makeUser(10000, 'creator2');

    // Create a show, manually mark it completed with escrow already drained
    // (simulating a show whose payouts have already settled).
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
    const showId = createRes.body.data.show.id;
    createdShowIds.push(showId);

    // Manually transition to 'completed' with the per-show escrow columns
    // drained (simulating a real settled show: prize paid to a winner, fee
    // escrow paid to creator).
    await prisma.show.update({
      where: { id: showId },
      data: {
        status: 'completed',
        executedAt: new Date(),
        prizeEscrow: 0,
        feeEscrow: 0,
      },
    });
    // Equoria-3n2g4: settle the shared show_escrow by DECREMENTing exactly the
    // amount createShow credited for THIS show (the 1000 prize), instead of a
    // global `balance: 0` set. The decrement is atomic and touches only this
    // show's contribution — it cannot clobber a concurrently-running sibling's
    // in-flight escrow balance.
    await prisma.systemAccount.update({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
      data: { balance: { decrement: 1000 } },
    });

    // Delete creator. The completed show should NOT trigger another burn.
    await eraseUserAccount(creator.id);

    // The load-bearing, concurrency-proof "no double-burn" signal lives on the
    // show row itself (owned solely by this test), NOT the shared burn balance
    // (which a sibling worker can credit at any time): the show stays
    // 'completed' and its prizeEscrow stays 0. The cancel path only burns a
    // show's OWN prizeEscrow; with prizeEscrow already 0 there is nothing left
    // to burn, so a double-burn is structurally impossible and provable without
    // reading the shared SystemAccount[burn] row.
    const showAfter = await prisma.show.findUnique({ where: { id: showId } });
    expect(showAfter.status).toBe('completed');
    expect(showAfter.createdByUserId).toBeNull();
    expect(showAfter.prizeEscrow).toBe(0);
    expect(showAfter.feeEscrow).toBe(0);
  }, 60000);

  it('SENTINEL: cancels open shows with no entries (prize burns, no entrant refunds)', async () => {
    const creator = await makeUser(5000, 'creator3');
    const burnBefore = await snapBurn();

    const createReq = {
      user: { id: creator.id },
      body: {
        name: `${FIXTURE_PREFIX}-show-${randomBytes(4).toString('hex')}`,
        discipline: 'Dressage',
        entryFee: 50,
        prize: 500,
        level: 1,
      },
    };
    const createRes = fakeRes();
    await createShow(createReq, createRes);
    const showId = createRes.body.data.show.id;
    createdShowIds.push(showId);

    // Pre-delete: THIS show's per-show prize escrow column holds 500 (the
    // concurrency-proof per-show signal, not the shared SystemAccount row).
    const showMid = await prisma.show.findUnique({ where: { id: showId } });
    expect(showMid.prizeEscrow).toBe(500);

    await eraseUserAccount(creator.id);

    // Show terminated and its prize escrow column drained to 0.
    const cancelled = await prisma.show.findUnique({ where: { id: showId } });
    expect(cancelled.status).toBe('completed');
    expect(cancelled.prizeEscrow).toBe(0);

    // The 500 prize went to the SHARED burn account. Asserted as a delta lower
    // bound (Equoria-3n2g4): a concurrent sibling can only inflate the credit,
    // and the per-show prizeEscrow→0 above is the exact proof the prize left
    // this show's escrow.
    const burnAfter = await snapBurn();
    expect(burnAfter - burnBefore).toBeGreaterThanOrEqual(500);
  }, 60000);
});
