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

import { describe, it, expect, afterAll, beforeEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { eraseUserAccount } from '../services/gdprAccountService.mjs';
import { SYSTEM_ACCOUNT_SHOW_ESCROW, SYSTEM_ACCOUNT_BURN } from '../../economy/services/financialLedgerService.mjs';
import { createShow, enterShow } from '../../competition/shows/showController.mjs';
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

async function snapSystem() {
  const rows = await prisma.systemAccount.findMany({
    where: { name: { in: [SYSTEM_ACCOUNT_SHOW_ESCROW, SYSTEM_ACCOUNT_BURN] } },
  });
  return rows.reduce((s, r) => s + Number(r.balance), 0);
}

beforeEach(async () => {
  // Reset escrow + burn to 0 so conservation math starts clean.
  await prisma.systemAccount.update({
    where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
    data: { balance: 0 },
  });
  await prisma.systemAccount.update({
    where: { name: SYSTEM_ACCOUNT_BURN },
    data: { balance: 0 },
  });
});

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
  await prisma.systemAccount
    .updateMany({
      where: { name: { in: [SYSTEM_ACCOUNT_SHOW_ESCROW, SYSTEM_ACCOUNT_BURN] } },
      data: { balance: 0 },
    })
    .catch(err => console.warn(`[cleanup] ${err.message}`));
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

    const allUserIds = [creator.id, ...entrants.map(e => e.id)];
    const moneyBefore = await snapMoney(allUserIds);
    const sysBefore = await snapSystem();
    const totalBefore = moneyBefore + sysBefore;

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

    // Sanity: escrow holds the 1000 prize + 150 fees.
    const escrowMid = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
    });
    expect(Number(escrowMid.balance)).toBe(1000 + 150);

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

    // Each entrant got their fee back: back to 500.
    const entrantMoneyPostCancel = await snapMoney(entrantIds);
    expect(entrantMoneyPostCancel).toBe(3 * 500);

    // Prize (1000) is in burn. show_escrow drained.
    const escrowAfter = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
    });
    expect(Number(escrowAfter.balance)).toBe(0);

    const burnAfter = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_BURN },
    });
    expect(Number(burnAfter.balance)).toBe(1000);

    // Money-conservation invariant: post-deletion total (entrants only —
    // creator is gone) + system accounts equals the original total minus
    // the creator's pre-deletion wallet balance. The creator's wallet was
    // entirely consumed: 10000 (initial) - 1000 (prize funded) = 9000 at
    // the time of deletion. That 9000 is what disappeared from the
    // conservation count.
    //
    // We assert the equivalent: entrant money + system accounts must
    // equal (entrants' starting money) + (the prize that was burned).
    // The prize started in creator's wallet (counted in totalBefore),
    // moved to escrow, then to burn — it stays in the conservation pool.
    // The creator's residual (10000-1000=9000) is the only thing that
    // disappears with the GDPR delete.
    const moneyAfter = await snapMoney(entrantIds);
    const sysAfter = await snapSystem();
    expect(moneyAfter + sysAfter).toBe(totalBefore - 9000);
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

    // Manually transition to 'completed' with escrow drained (simulating
    // a real settled show: prize paid to a winner, fee escrow paid to
    // creator). The escrow column changes shouldn't affect this test —
    // we're proving the cancel logic doesn't fire on completed shows.
    await prisma.show.update({
      where: { id: showId },
      data: {
        status: 'completed',
        executedAt: new Date(),
        prizeEscrow: 0,
        feeEscrow: 0,
      },
    });
    // Also drain the system_escrow that createShow credited (we already
    // simulated the payout above, so the escrow shouldn't carry that 1000).
    await prisma.systemAccount.update({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
      data: { balance: 0 },
    });

    const burnBefore = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_BURN },
    });

    // Delete creator. The completed show should NOT trigger another burn.
    await eraseUserAccount(creator.id);

    const showAfter = await prisma.show.findUnique({ where: { id: showId } });
    expect(showAfter.status).toBe('completed');
    expect(showAfter.createdByUserId).toBeNull();

    const burnAfter = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_BURN },
    });
    // No additional burn — pre/post balance should match.
    expect(Number(burnAfter.balance)).toBe(Number(burnBefore.balance));
  }, 60000);

  it('SENTINEL: cancels open shows with no entries (prize burns, no entrant refunds)', async () => {
    const creator = await makeUser(5000, 'creator3');

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

    // Pre-delete: escrow holds 500.
    const escrowMid = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
    });
    expect(Number(escrowMid.balance)).toBe(500);

    await eraseUserAccount(creator.id);

    const cancelled = await prisma.show.findUnique({ where: { id: showId } });
    expect(cancelled.status).toBe('completed');
    expect(cancelled.prizeEscrow).toBe(0);

    const escrowAfter = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
    });
    expect(Number(escrowAfter.balance)).toBe(0);

    const burnAfter = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_BURN },
    });
    // The 500 prize went to burn.
    expect(Number(burnAfter.balance)).toBe(500);
  }, 60000);
});
