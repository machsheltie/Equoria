/**
 * Equoria-2ti1j — the weekly groom fee must not FAIL OPEN.
 *
 * THE DEFECT. Inside `processWeeklySalaries`, the per-user fee transaction routed an
 * `InsufficientFundsError` to `handleUnpaidFees` (grace, then release after a full
 * unpaid week) and rethrew EVERYTHING ELSE to the outer catch, which counted a
 * per-user failure and did nothing else. So a dropped connection, a deadlock, or a
 * transaction timeout left the player neither charged nor in grace: their grooms
 * worked the whole week for free, and because the next pass is a NEW pay week, the
 * missed one was never revisited. An infrastructure fault produced a strictly better
 * outcome for the player than paying would have.
 *
 * THE FIX. `recordUncollectedFees` — the week is recorded (`missed_collection_error`
 * audit row) and the groom enters grace and stops working, because the player did
 * not in fact pay. The groom is NEVER released by this path: losing a groom is the
 * penalty for a player not paying for a whole week, not for our transaction throwing.
 * Nothing here presupposes Equoria-bgdfb (whether the grace week is later owed or
 * forgiven) — no debt is recorded and no later debit is enlarged.
 *
 * HOW THE FAULT IS INJECTED — a REAL Postgres fault, no mocks. A second connection
 * holds `SELECT ... FOR UPDATE` on the fixture user's row. The fee transaction's
 * atomic debit (`debitMoneyOrThrow` → `user.updateMany`) blocks on that row lock
 * until the transaction's own 30s timeout aborts it. That is exactly the shape of
 * the fault the issue describes: a genuine, non-funds throw from the database,
 * arriving after the transaction has begun. The lock is scoped to this file's own
 * fixture user, so no other row and no other agent's work is touched.
 *
 * WHAT THESE TESTS CANNOT SEE: they do not prove anything about WHICH errors are
 * transient, they do not exercise the cron entry point, and they do not cover what
 * a later pass should do with the recorded week — that is Equoria-bgdfb's to rule.
 *
 * Real DB, no mocks, fail-loud cleanup in dependency order. `processWeeklySalaries`
 * is called SCOPED to the fixture user: unscoped it would put every underfunded
 * player on the shared development database into grace.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { processWeeklySalaries, getPayWeekStart, calculateWeeklyFee } from '../services/groomSalaryService.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { recordUncollectedFees } from '../services/groomFeeArrearsService.mjs';
import { GROOM_FEE_UNPAID_NOTIFICATION_TYPE, checkGroomMayWork } from '../services/groomEngagementService.mjs';

const FIXTURE_PREFIX = 'TestFixture-2ti1j';
const tag = () => randomBytes(6).toString('hex');

// Mondays, safely in the past so they cannot collide with a real cron run's pay week.
const WEEK_ONE = new Date('2026-02-02T09:00:00.000Z');
const WEEK_TWO = new Date('2026-02-09T09:00:00.000Z');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function makeUser(label, money) {
  const suffix = `${label}-${tag()}`;
  return prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Uncollected',
      lastName: label,
      money,
      settings: {},
    },
  });
}

async function makeGroom(userId, label, extra = {}) {
  const groom = await prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      startAge: 20,
      userId,
      ...extra,
    },
  });
  await prisma.groomEngagement.create({ data: { groomId: groom.id, userId } });
  // Equoria-95yrv: the weekly fee is $70 per horse assigned, so a groom on NO
  // horses costs nothing — and a zero fee is no debit at all, which would take
  // this suite's whole mechanism (a contended debit) off the table. One horse.
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${tag()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2023-05-01'),
      age: 3,
      userId,
      healthStatus: 'Excellent',
    },
  });
  await prisma.groomAssignment.create({
    data: { groomId: groom.id, foalId: horse.id, userId, isActive: true },
  });
  return groom;
}

/** Delete one fixture user and everything hanging off them, in FK order. */
function registerUserCleanup(cleanup, getUser, label) {
  cleanup.add(async () => {
    const user = getUser();
    if (!user?.id) {
      throw new Error(`[cleanup] ${label} user id missing — refusing an unscoped delete`);
    }
    const groomIds = (await prisma.groom.findMany({ where: { userId: user.id }, select: { id: true } })).map(g => g.id);
    if (groomIds.length) {
      await prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } });
      await prisma.groomAssignmentLog.deleteMany({ where: { groomId: { in: groomIds } } });
      await prisma.groomInteraction.deleteMany({ where: { groomId: { in: groomIds } } });
      await prisma.groomRetirementSchedule.deleteMany({ where: { groomId: { in: groomIds } } });
      await prisma.groomSalaryPayment.deleteMany({ where: { groomId: { in: groomIds } } });
      await prisma.groomEngagement.deleteMany({ where: { groomId: { in: groomIds } } });
    }
    await prisma.groomSalaryPayment.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.userTransaction.deleteMany({ where: { userId: user.id } });
    await prisma.groom.deleteMany({ where: { userId: user.id } });
    await prisma.horse.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }, `${label} user and dependents`);
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-2ti1j — a non-funds throw must not grant a free week of staff', () => {
  let user;
  let groom;
  let salary;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    // Plenty of money: the fee will go uncollected because the DATABASE refused the
    // transaction, never because the player could not pay. That is the whole point.
    user = await makeUser('rich', 100000);
    registerUserCleanup(cleanup, () => user, 'rich');
    groom = await makeGroom(user.id, 'groom');
    salary = calculateWeeklyFee(1);
  }, 60000);

  afterAll(async () => {
    await cleanup.run();
  }, 60000);

  it('records the week as uncollected and stops the groom working, not passing as paid', async () => {
    const payWeekStart = getPayWeekStart(WEEK_ONE);
    const moneyBefore = (await prisma.user.findUnique({ where: { id: user.id } })).money;

    // A second connection takes the fixture user's row lock and holds it for longer
    // than the fee transaction's 30s timeout, so the debit inside that transaction
    // blocks and the transaction aborts with a genuine, non-funds database error.
    // The hold MUST outlast that 30s deadline with margin: Prisma does not abort a
    // statement that is blocked in Postgres — it raises P2028 ("a query cannot be
    // executed on an expired transaction") when the blocked statement finally
    // returns, and then rolls the transaction back. A hold that ends at ~30s is a
    // photo finish the debit can win, so this holds the lock for 40s.
    const lockHeld = prisma.$transaction(
      async tx => {
        await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
        await sleep(40000);
      },
      { timeout: 120000, maxWait: 30000 },
    );
    // Give the lock holder time to actually take the lock before the pass starts.
    await sleep(1000);

    let results;
    try {
      results = await processWeeklySalaries(WEEK_ONE, { userId: user.id });
    } finally {
      await lockHeld;
    }

    // The failure was NOT insufficient funds — the player had 100000.
    expect(results.failed).toBe(1);
    expect(results.successful).toBe(0);
    expect(results.errors.join(' ')).not.toMatch(/could not pay/i);

    // FAIL CLOSED: the week is on the record and the groom cannot work.
    expect(results.uncollected).toBe(1);
    expect(results.graced).toBe(1);

    const after = await prisma.groom.findUnique({ where: { id: groom.id } });
    expect(after.feeUnpaidSince).not.toBeNull();
    expect(new Date(after.feeUnpaidSince).toISOString()).toBe(payWeekStart.toISOString());
    expect(checkGroomMayWork(after).allowed).toBe(false);
    // Still on staff: an infrastructure fault does not cost the player their groom.
    expect(after.userId).toBe(user.id);

    const rows = await prisma.groomSalaryPayment.findMany({ where: { userId: user.id } });
    expect(rows.map(r => r.status).sort()).toEqual(['missed_collection_error']);
    expect(rows[0].amount).toBe(salary);
    // No money moved: the aborted transaction rolled its debit back, and this path
    // deliberately does not re-charge (Equoria-bgdfb is the owner's to rule).
    const moneyAfter = (await prisma.user.findUnique({ where: { id: user.id } })).money;
    expect(moneyAfter).toBe(moneyBefore);

    // The player is told, because their groom has stopped working.
    const notices = await prisma.notification.findMany({
      where: { userId: user.id, type: GROOM_FEE_UNPAID_NOTIFICATION_TYPE },
    });
    expect(notices).toHaveLength(1);

    // And the user-level pointer the salary summary renders is set.
    const owner = await prisma.user.findUnique({ where: { id: user.id } });
    expect(owner.groomSalaryGracePeriod).not.toBeNull();
  }, 180000);
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-2ti1j — a collection error never costs the player the groom', () => {
  let user;
  let groom;
  let salary;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('carried', 100000);
    registerUserCleanup(cleanup, () => user, 'carried');
    // Already in grace since the EARLIER pay week — the exact state in which
    // `handleUnpaidFees` releases a groom for non-payment.
    groom = await makeGroom(user.id, 'in-grace', { feeUnpaidSince: getPayWeekStart(WEEK_ONE) });
    salary = calculateWeeklyFee(1);
  }, 60000);

  afterAll(async () => {
    await cleanup.run();
  }, 60000);

  it('records the second week but does not release a groom already in grace', async () => {
    const payWeekTwo = getPayWeekStart(WEEK_TWO);

    const outcome = await recordUncollectedFees(
      user.id,
      [{ groom, salary }],
      payWeekTwo,
      new Error('simulated transport fault'),
    );

    expect(outcome.recorded).toBe(1);
    // Already in grace, so no NEW grace entry and no second notice.
    expect(outcome.graced).toBe(0);

    const after = await prisma.groom.findUnique({ where: { id: groom.id } });
    expect(after.userId).toBe(user.id);
    expect(checkGroomMayWork(after).allowed).toBe(false);
    // The marker still names the FIRST unpaid week — re-entry must never push it
    // forward and quietly extend the grace period.
    expect(new Date(after.feeUnpaidSince).toISOString()).toBe(getPayWeekStart(WEEK_ONE).toISOString());

    const engagement = await prisma.groomEngagement.findFirst({
      where: { groomId: groom.id, endedAt: null },
    });
    expect(engagement).not.toBeNull();

    const rows = await prisma.groomSalaryPayment.findMany({ where: { groomId: groom.id } });
    expect(rows.map(r => r.status)).toEqual(['missed_collection_error']);
    // No release audit row, and no release notice.
    expect(rows.some(r => r.status === 'terminated_non_payment')).toBe(false);
    const notices = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(notices).toHaveLength(0);
  }, 60000);

  it('a second collection error in the same pay week adds a record but changes nothing else', async () => {
    const payWeekTwo = getPayWeekStart(WEEK_TWO);
    const reread = await prisma.groom.findUnique({ where: { id: groom.id } });

    const outcome = await recordUncollectedFees(
      user.id,
      [{ groom: reread, salary }],
      payWeekTwo,
      new Error('simulated transport fault, again'),
    );

    expect(outcome.recorded).toBe(1);
    expect(outcome.graced).toBe(0);

    const after = await prisma.groom.findUnique({ where: { id: groom.id } });
    expect(new Date(after.feeUnpaidSince).toISOString()).toBe(getPayWeekStart(WEEK_ONE).toISOString());
    expect(after.userId).toBe(user.id);

    const rows = await prisma.groomSalaryPayment.findMany({ where: { groomId: groom.id } });
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.status === 'missed_collection_error')).toBe(true);
    const notices = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(notices).toHaveLength(0);
  }, 60000);
});
