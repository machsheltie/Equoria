/**
 * Equoria-e165h — the pay-week advisory lock is load-bearing, proven by a case
 * that FAILS with the lock removed and passes with it present.
 *
 * WHY THE OLD CONCURRENT TESTS COULD NOT TELL. groomSalaryIdempotency fires two
 * passes with Promise.all and asserts one debit. That stayed green for weeks
 * while the lock held nothing (Equoria-6q7wr), because two calls launched
 * together do not reliably interleave inside the damaging window, and because
 * something else also refuses the second debit for the SAME staff: the paid-week
 * partial unique (Equoria-h7518) aborts the loser's transaction (P2002 →
 * skipped). Case 1 below pins that: with identical staff the double debit is
 * refused with or without the lock.
 *
 * WHAT THE LOCK ALONE PROTECTS (case 2). The staff list is read BEFORE the fee
 * transaction. A groom hired while a first pass is in flight is in the second
 * pass's list but not the first's. With the lock, the second pass waits for the
 * first to commit, sees that groom 1 is paid, and pays groom 2 alone. Without
 * it, both passes read "nothing paid yet"; the second debits for BOTH grooms,
 * hits the unique on groom 1, and its whole transaction rolls back as
 * "already paid" — so groom 2's fee for the week is never collected and groom 2
 * is never put into grace either: a free week. Mutation evidence (lock call
 * removed from processWeeklySalaries): case 2 fails on the wallet and on groom
 * 2's missing paid row; case 1 stays green.
 *
 * HOW THE INTERLEAVING IS FORCED (rowLockBarrier, no mocks, no sleeps). A second
 * Prisma client holds groom 1's row FOR UPDATE. The first pass debits, then
 * queues on the foreign-key check of its payment row for groom 1. The second
 * pass then queues behind the first — on the advisory lock when it exists, on
 * the User row when it does not — and only once BOTH are observed queued behind
 * the holder (pg_blocking_pids) is the row released. Every query is the real
 * production query, merely delayed by a lock the database arbitrates.
 *
 * Scoped: every pass is scoped to this file's own fixture user, and the pay week
 * is a fixed past Monday that no real cron run can share.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createBarrierClient, holdLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { calculateWeeklyFee, processWeeklySalaries } from '../services/groomSalaryService.mjs';

const fixturePrefix = 'TestFixture-e165h';
const payDay = new Date('2026-03-02T15:00:00.000Z'); // a Monday, long past
const startingMoney = 1000;
const tag = () => randomBytes(6).toString('hex');

const barrierClient = createBarrierClient();

async function makeGroom(userId, label) {
  const groom = await prisma.groom.create({
    data: {
      name: `${fixturePrefix}-${label}-${tag()}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      startAge: 20,
      userId,
    },
  });
  await prisma.groomEngagement.create({ data: { groomId: groom.id, userId } });
  return groom;
}

const groomRowLock = groomId => tx => tx.$queryRaw`SELECT id FROM "grooms" WHERE id = ${groomId} FOR UPDATE`;

const readMoney = async userId =>
  (await prisma.user.findUnique({ where: { id: userId }, select: { money: true } })).money;

const paidRows = groomId =>
  prisma.groomSalaryPayment.count({ where: { groomId, status: 'paid', paymentType: 'weeklySalary' } });

describe('Equoria-e165h — the pay-week advisory lock is load-bearing', () => {
  const cleanup = createCleanupTracker();
  let user;

  beforeEach(async () => {
    const suffix = tag();
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${fixturePrefix}-${suffix}`,
        email: `${fixturePrefix}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Pay',
        lastName: 'Week',
        money: startingMoney,
        settings: {},
      },
    });
    const userId = user.id;
    cleanup.add(async () => {
      const groomIds = (await prisma.groom.findMany({ where: { userId }, select: { id: true } })).map(g => g.id);
      await prisma.groomSalaryPayment.deleteMany({ where: { userId } });
      if (groomIds.length) {
        await prisma.groomSalaryPayment.deleteMany({ where: { groomId: { in: groomIds } } });
        await prisma.groomEngagement.deleteMany({ where: { groomId: { in: groomIds } } });
      }
      await prisma.notification.deleteMany({ where: { userId } });
      await prisma.userTransaction.deleteMany({ where: { userId } });
      await prisma.groom.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }, 'pay-week fixture user and dependents');
  }, 60000);

  afterEach(() => cleanup.run(), 60000);
  afterAll(() => barrierClient.$disconnect());

  /**
   * Start the first pass, wait until it is queued (after its debit) behind the
   * groom-1 barrier, run `between`, start the second pass, wait until it is
   * queued too, release, and return both results.
   */
  async function overlappingPasses(groomOne, between = async () => {}) {
    const barrier = await holdLock(barrierClient, groomRowLock(groomOne.id));
    let first;
    let second;
    try {
      first = processWeeklySalaries(payDay, { userId: user.id });
      await barrier.waitForQueued(1);
      await between();
      second = processWeeklySalaries(payDay, { userId: user.id });
      await barrier.waitForQueued(2);
    } finally {
      await barrier.release();
    }
    return Promise.all([first, second]);
  }

  it('same staff: the overlapping second pass is refused a second debit (the paid-week unique also guards this)', async () => {
    const groom = await makeGroom(user.id, 'only');
    const fee = calculateWeeklyFee(groom);

    const [first, second] = await overlappingPasses(groom);

    expect(first.successful).toBe(1);
    expect(second.successful).toBe(0);
    expect(second.skipped).toBe(1);
    expect(await readMoney(user.id)).toBe(startingMoney - fee);
    expect(await paidRows(groom.id)).toBe(1);
  }, 60000);

  it('a groom hired mid-pass is charged by the overlapping second pass, not given a free week', async () => {
    const groomOne = await makeGroom(user.id, 'first');
    let groomTwo;

    const [first, second] = await overlappingPasses(groomOne, async () => {
      // Hired after the first pass read its staff list, before the second did.
      groomTwo = await makeGroom(user.id, 'hiredMidPass');
    });
    const feeOne = calculateWeeklyFee(groomOne);
    const feeTwo = calculateWeeklyFee(groomTwo);

    expect(first.successful).toBe(1);
    expect(first.totalAmount).toBe(feeOne);
    expect(second.successful).toBe(1);
    expect(second.totalAmount).toBe(feeTwo);
    expect(await readMoney(user.id)).toBe(startingMoney - feeOne - feeTwo);
    expect(await paidRows(groomOne.id)).toBe(1);
    expect(await paidRows(groomTwo.id)).toBe(1);
    // Each groom's week is recorded under the one pay week, once.
    const weeks = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, status: 'paid' },
      select: { groomId: true, weekKey: true },
    });
    expect(weeks).toHaveLength(2);
    expect(new Set(weeks.map(row => row.weekKey)).size).toBe(1);
  }, 60000);
});
