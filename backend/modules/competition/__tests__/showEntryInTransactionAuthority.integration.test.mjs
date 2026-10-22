/**
 * Show entry is decided inside its transaction; both entry routes keep the same
 * books; conformation settlement is concurrency-safe — Equoria-mwjst (Codex Sol
 * review 2026-10-20, findings 4, 5, 8, 9, 10, 12 and the concurrent-charge gap).
 *
 * 1. Ownership and the conformation rules are re-decided INSIDE the entry
 *    transaction, on the rows as they are when the fee is taken. A sale, a
 *    groom release or an unpaid groom fee that lands after the request's own
 *    checks refuses the entry with no charge.
 * 2. Two different entries against a wallet that can pay one fee: one entry,
 *    one charge, one complete ledger pair.
 * 3. Both entry routes write the entrant's debit row with the balance it left.
 * 4. Fee settlement writes the creator's credit row with the balance it made.
 * 5. Two shows settling at once both add their breeding boost to a shared horse.
 * 6. Equal scores with equal entry times place by entry id, every run.
 *
 * Where a race is between the request's checks and its transaction, the test
 * makes the change first and then runs the real transaction with the inputs
 * the request already approved. Where it is inside the transaction, the
 * change is made from a separate transaction inside the real prepareEntry hook,
 * before the real in-transaction rules run. The release and unpaid-fee changes
 * write exactly the rows groomEngagementService's releaseGroomTx and
 * enterFeeGraceTx write (the grooms module does not export them).
 *
 * Real app, real JWT, real CSRF, real database. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, createTestShow, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { enterShowDeferredTx } from '../services/competitionRouteQueries.mjs';
import { enterShowAtomicTx } from '../shows/showEscrowTx.mjs';
import {
  checkConformationEntryInTx,
  executeConformationShow,
  BREEDING_BOOST_CAP,
  REWARD_TABLE,
} from '../services/conformationShowService.mjs';

const FIXTURE_PREFIX = 'TestFixture-mwjst-intx';
const ORIGIN = 'http://localhost:3000';
const DAY_MS = 24 * 60 * 60 * 1000;
const ENTRY_FEE = 120;

const tag = randomBytes(4).toString('hex');
let csrf;
let creator;
let seq = 0;
const groomIds = [];
const assignmentIds = [];

async function makePlayer(label, { money = 1000 } = {}) {
  seq += 1;
  return createTestUser({
    username: `${FIXTURE_PREFIX}-${label}-${seq}-${tag}`,
    email: `${FIXTURE_PREFIX}-${label}-${seq}-${tag}@example.com`,
    money,
  });
}

/** An entry-ready horse owned by `user`, with a groom on their staff assigned five days ago. */
async function addHorse(user, label, horseFields = {}) {
  seq += 1;
  const now = new Date();
  const horse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-${label}-horse-${seq}-${tag}`,
    userId: user.id,
    healthStatus: 'Excellent',
    lastFedDate: now,
    lastVettedDate: now,
    ...horseFields,
  });
  const groom = await prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-${label}-groom-${seq}-${tag}`,
      speciality: 'show_handling',
      personality: 'gentle',
      skillLevel: 'expert',
      user: { connect: { id: user.id } },
    },
  });
  groomIds.push(groom.id);
  const assignment = await prisma.groomAssignment.create({
    data: {
      groom: { connect: { id: groom.id } },
      foal: { connect: { id: horse.id } },
      user: { connect: { id: user.id } },
      isActive: true,
      createdAt: new Date(Date.now() - 5 * DAY_MS),
    },
  });
  assignmentIds.push(assignment.id);
  return { horse, groom };
}

async function makeShow(overrides = {}) {
  const openDate = new Date(Date.now() - 60 * 60 * 1000);
  const closeDate = new Date(openDate.getTime() + 7 * DAY_MS);
  return createTestShow({
    name: `${FIXTURE_PREFIX}-show`,
    discipline: 'Conformation',
    showType: 'conformation',
    status: 'open',
    entryFee: ENTRY_FEE,
    prize: 0,
    levelMin: 1,
    levelMax: 10,
    openDate,
    closeDate,
    runDate: closeDate,
    createdByUserId: creator.id,
    ...overrides,
  });
}

function enterHttp(token, horse, groom, show) {
  return request(app)
    .post('/api/v1/competition/conformation/enter')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId: horse.id, groomId: groom.id, showId: show.id });
}

/** The conformation entry transaction, with the inputs the request's own checks approved. */
async function enterInTx({ userId, horse, groom, show, beforeRules = null }) {
  const showRow = await prisma.show.findUnique({ where: { id: show.id } });
  return enterShowDeferredTx({
    show: showRow,
    showId: show.id,
    horseId: horse.id,
    userId,
    prepareEntry: async tx => {
      if (beforeRules) {
        await beforeRules();
      }
      return checkConformationEntryInTx(tx, { horseId: horse.id, groomId: groom.id, userId });
    },
  });
}

async function money(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

async function ledgerFor(userId, showId) {
  const rows = await prisma.userTransaction.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
  });
  return rows.filter(row => Number(row.metadata?.showId) === showId);
}

async function expectNoCharge(userId, show, moneyBefore) {
  expect(await money(userId)).toBe(moneyBefore);
  expect(await prisma.showEntry.count({ where: { showId: show.id } })).toBe(0);
  expect(await ledgerFor(userId, show.id)).toHaveLength(0);
  const showRow = await prisma.show.findUnique({ where: { id: show.id }, select: { feeEscrow: true } });
  expect(Number(showRow.feeEscrow)).toBe(0);
}

/** Close a show's entry window so the nightly settlement treats it as due. */
async function makeDue(show) {
  await prisma.show.update({
    where: { id: show.id },
    data: { closeDate: new Date(Date.now() - 60 * 1000), runDate: new Date(Date.now() - 60 * 1000) },
  });
}

beforeAll(async () => {
  ({ user: creator } = await makePlayer('creator'));
  csrf = await fetchCsrf(app);
}, 120000);

afterAll(async () => {
  await prisma.groomAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
  await prisma.groom.deleteMany({ where: { id: { in: groomIds } } });
  await cleanupTestData();
});

describe('entry rules are decided inside the entry transaction (Equoria-mwjst)', () => {
  it('a horse sold after the request was checked is refused, and the seller is not charged', async () => {
    const { user: seller } = await makePlayer('seller');
    const { user: buyer } = await makePlayer('buyer');
    const { horse, groom } = await addHorse(seller, 'sold');
    const show = await makeShow();
    const before = await money(seller.id);

    // The sale completes in the window after the request's ownership check.
    await prisma.horse.update({ where: { id: horse.id }, data: { userId: buyer.id } });

    await expect(enterInTx({ userId: seller.id, horse, groom, show })).rejects.toMatchObject({
      code: 'HORSE_NOT_FOUND',
      status: 404,
    });
    await expectNoCharge(seller.id, show, before);
  });

  it('a groom released while the entry is in flight is refused, with no charge', async () => {
    const { user } = await makePlayer('released');
    const { horse, groom } = await addHorse(user, 'released');
    const show = await makeShow();
    const before = await money(user.id);

    const release = () =>
      prisma.$transaction([
        prisma.groom.update({ where: { id: groom.id }, data: { userId: null, feeUnpaidSince: null } }),
        prisma.groomAssignment.updateMany({
          where: { groomId: groom.id, isActive: true },
          data: { isActive: false, endDate: new Date() },
        }),
      ]);

    await expect(enterInTx({ userId: user.id, horse, groom, show, beforeRules: release })).rejects.toMatchObject({
      code: 'GROOM_NOT_ON_STAFF',
    });
    await expectNoCharge(user.id, show, before);
  });

  it('a groom whose weekly fee goes unpaid while the entry is in flight is refused, with no charge', async () => {
    const { user } = await makePlayer('unpaid');
    const { horse, groom } = await addHorse(user, 'unpaid');
    const show = await makeShow();
    const before = await money(user.id);

    const markUnpaid = () => prisma.groom.update({ where: { id: groom.id }, data: { feeUnpaidSince: new Date() } });

    await expect(enterInTx({ userId: user.id, horse, groom, show, beforeRules: markUnpaid })).rejects.toMatchObject({
      code: 'GROOM_CANNOT_WORK',
    });
    await expectNoCharge(user.id, show, before);
  });

  it('a retired groom cannot present a horse even when everything else is in order', async () => {
    const { user, token } = await makePlayer('retired');
    const { horse, groom } = await addHorse(user, 'retired');
    await prisma.groom.update({ where: { id: groom.id }, data: { retired: true } });
    const show = await makeShow();
    const before = await money(user.id);

    const res = await enterHttp(token, horse, groom, show);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('GROOM_CANNOT_WORK');
    await expectNoCharge(user.id, show, before);
  });
});

describe('two different entries against money for one fee (Equoria-mwjst)', () => {
  it('one entry is taken and charged once; the other is refused for funds', async () => {
    const { user, token } = await makePlayer('onefee', { money: ENTRY_FEE });
    const first = await addHorse(user, 'onefee-a');
    const second = await addHorse(user, 'onefee-b');
    const show = await makeShow();

    const responses = await Promise.all([
      enterHttp(token, first.horse, first.groom, show),
      enterHttp(token, second.horse, second.groom, show),
    ]);

    const statuses = responses.map(r => r.status).sort();
    expect(statuses).toEqual([201, 402]);
    expect(await money(user.id)).toBe(0);
    expect(await prisma.showEntry.count({ where: { showId: show.id } })).toBe(1);
    const showRow = await prisma.show.findUnique({ where: { id: show.id }, select: { feeEscrow: true } });
    expect(Number(showRow.feeEscrow)).toBe(ENTRY_FEE);
    const ledger = await ledgerFor(user.id, show.id);
    expect(ledger.filter(r => r.category === 'competitionEntry').map(r => Number(r.amount))).toEqual([ENTRY_FEE]);
    expect(ledger.filter(r => r.category === 'showEntryFeeEscrow').map(r => Number(r.amount))).toEqual([ENTRY_FEE]);
  });
});

describe('both entry routes keep the same books (Equoria-mwjst)', () => {
  it('POST /shows/:id/enter writes the entrant’s debit row with the balance it left, like POST /competition/enter', async () => {
    const results = [];
    for (const enterFn of [enterShowAtomicTx, enterShowDeferredTx]) {
      const { user } = await makePlayer('parity');
      const { horse } = await addHorse(user, 'parity');
      const show = await makeShow();
      const showRow = await prisma.show.findUnique({ where: { id: show.id } });
      const before = await money(user.id);

      const entry = await enterFn({ show: showRow, showId: show.id, horseId: horse.id, userId: user.id });

      const ledger = await ledgerFor(user.id, show.id);
      const debit = ledger.filter(r => r.category === 'competitionEntry');
      const escrow = ledger.filter(r => r.category === 'showEntryFeeEscrow');
      const after = await showRowAndMoney(user.id, show.id);
      results.push({
        moneyDelta: before - after.money,
        feeEscrow: after.feeEscrow,
        feePaid: entry.feePaid,
        debits: debit.map(r => ({ type: r.type, amount: Number(r.amount), balanceAfter: Number(r.balanceAfter) })),
        escrowRows: escrow.map(r => Number(r.amount)),
        expectedBalance: after.money,
      });
    }

    for (const r of results) {
      expect(r.moneyDelta).toBe(ENTRY_FEE);
      expect(r.feeEscrow).toBe(ENTRY_FEE);
      expect(r.feePaid).toBe(ENTRY_FEE);
      expect(r.debits).toEqual([{ type: 'debit', amount: ENTRY_FEE, balanceAfter: r.expectedBalance }]);
      expect(r.escrowRows).toEqual([ENTRY_FEE]);
    }
  });
});

/**
 * Wait until `count` sessions are queued behind the lock held by `client`'s
 * transaction. A barrier on the real lock, not a timer.
 */
async function waitForLockWaiters(client, count, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    // Inside a transaction Postgres keeps serving its first statistics
    // snapshot; clear it so every poll sees the sessions as they are now.
    await client.$executeRaw`SELECT pg_stat_clear_snapshot()`;
    // Only sessions queued behind this holder count, directly or behind each
    // other; another Jest worker's lock wait must not (Equoria-8kbfl).
    const [{ waiting }] = await client.$queryRaw`
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
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

async function showRowAndMoney(userId, showId) {
  const showRow = await prisma.show.findUnique({ where: { id: showId }, select: { feeEscrow: true } });
  return { money: await money(userId), feeEscrow: Number(showRow.feeEscrow) };
}

describe('conformation settlement (Equoria-mwjst)', () => {
  it('pays the creator the fees with their own credit row and the balance it made', async () => {
    const { user: host } = await makePlayer('host');
    const { user } = await makePlayer('payer');
    const { horse, groom } = await addHorse(user, 'payer');
    const show = await makeShow({ createdByUserId: host.id });
    await enterInTx({ userId: user.id, horse, groom, show });
    await makeDue(show);
    const hostBefore = await money(host.id);

    await executeConformationShow(show.id);

    const hostAfter = await money(host.id);
    expect(hostAfter).toBe(hostBefore + ENTRY_FEE);
    const credits = (await ledgerFor(host.id, show.id)).filter(r => r.category === 'showEntryFeesReceived');
    expect(
      credits.map(r => ({ type: r.type, amount: Number(r.amount), balanceAfter: Number(r.balanceAfter) })),
    ).toEqual([{ type: 'credit', amount: ENTRY_FEE, balanceAfter: hostAfter }]);
  });

  it('two shows settling at once both add their breeding boost to the horse they share', async () => {
    const { user } = await makePlayer('boost');
    const { horse, groom } = await addHorse(user, 'boost', { breedingValueBoost: 0 });
    const showA = await makeShow();
    const showB = await makeShow();
    await enterInTx({ userId: user.id, horse, groom, show: showA });
    await enterInTx({ userId: user.id, horse, groom, show: showB });
    await makeDue(showA);
    await makeDue(showB);

    // Make the overlap certain: hold the horse's row lock until both
    // settlements have read the horse and are queued on that lock, then let go.
    // A settlement that writes a value computed from what it read loses the
    // other's boost; one that increments in the database keeps both.
    let settling;
    await prisma.$transaction(
      async tx => {
        await tx.$queryRaw`SELECT "id" FROM "horses" WHERE "id" = ${horse.id} FOR UPDATE`;
        settling = Promise.all([executeConformationShow(showA.id), executeConformationShow(showB.id)]);
        // Poll on this transaction's own connection: the pool has three
        // (dbPoolConfig), and the two settlements need the other two.
        await waitForLockWaiters(tx, 2);
      },
      { timeout: 30000 },
    );
    await settling;

    // Alone in each show, the horse places first twice.
    const expected = Math.min(BREEDING_BOOST_CAP, 2 * REWARD_TABLE[1].breedingBoostDelta);
    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { breedingValueBoost: true, titlePoints: true },
    });
    expect(after.breedingValueBoost).toBeCloseTo(expected, 10);
    expect(after.titlePoints).toBe(2 * REWARD_TABLE[1].titlePoints);
  });

  it('equal scores entered at the same moment place by entry id', async () => {
    const { user } = await makePlayer('ties');
    const scores = { head: 70, neck: 70, shoulders: 70, back: 70, legs: 70, hooves: 70, topline: 70, hindquarters: 70 };
    const a = await addHorse(user, 'tie-a', { conformationScores: scores, age: 5 });
    const b = await addHorse(user, 'tie-b', { conformationScores: scores, age: 5 });
    const show = await makeShow();
    await enterInTx({ userId: user.id, ...a, show });
    await enterInTx({ userId: user.id, ...b, show });
    const entries = await prisma.showEntry.findMany({ where: { showId: show.id }, orderBy: { id: 'asc' } });
    // Same instant for both; then rewrite the FIRST entry's row so Postgres
    // stores it after the second, and table order no longer follows id. Only an
    // explicit id tie-break can still put the first entry first.
    const sameMoment = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.showEntry.updateMany({ where: { showId: show.id }, data: { createdAt: sameMoment } });
    await prisma.showEntry.update({ where: { id: entries[0].id }, data: { createdAt: sameMoment } });
    await makeDue(show);

    const results = await executeConformationShow(show.id);

    const byHorse = new Map(results.map(r => [r.horseId, r]));
    const first = byHorse.get(entries[0].horseId);
    const second = byHorse.get(entries[1].horseId);
    expect(first.score).toBe(second.score);
    expect(first.placement).toBe(1);
    expect(second.placement).toBe(2);
  });
});
