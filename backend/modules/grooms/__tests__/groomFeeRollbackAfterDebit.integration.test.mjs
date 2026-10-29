/**
 * Equoria-sgkjp — a weekly groom fee that fails AFTER the debit has run leaves
 * the player's money untouched: the rollback proven by execution, not argued
 * from reading.
 *
 * THE GAP THIS CLOSES. groomFeeUncollected injects its fault at the debit
 * itself, so nothing has been written when the transaction dies; it proves the
 * fail-closed bookkeeping, not that a half-done charge is undone. Two earlier
 * stories (Equoria-m9lz1, Equoria-ypb7d) reported this rollback as unprovable
 * because a lock held from the app's own pool starves the pool under test.
 *
 * HOW (rowLockBarrier's second client — outside the pool under test). The
 * barrier holds the groom's row FOR UPDATE. The fee transaction takes the
 * pay-week lock, debits the User row, credits the burn account, writes the
 * ledger row, and then queues on the foreign-key check of the groom's payment
 * row. From the second connection the test then OBSERVES the mid-transaction
 * state: the debit has run (the User row is locked by the fee transaction, so
 * a NOWAIT probe is refused), yet the committed balance and ledger are
 * unchanged (READ COMMITTED isolation). It then fails the transaction at that
 * exact statement with pg_cancel_backend — a genuine database error, not a
 * mock — releases the barrier, and checks that the debit, the burn credit's
 * ledger row and the payment row all rolled back together, while the
 * fail-closed path recorded the week as uncollected.
 *
 * Mutation evidence: with the debit moved off the transaction client
 * (debitMoneyOrThrow(prisma, ...)), the debit commits on its own and the
 * NOWAIT probe is no longer refused — this case fails there.
 *
 * Scoped to this file's own fixture user, on a fixed past pay week.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { blockedSessionPids, createBarrierClient, holdLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { calculateWeeklyFee, processWeeklySalaries } from '../services/groomSalaryService.mjs';

const fixturePrefix = 'TestFixture-sgkjp-rollback';
const payDay = new Date('2026-03-09T15:00:00.000Z'); // a Monday, long past
const startingMoney = 1000;
const tag = () => randomBytes(6).toString('hex');

const barrierClient = createBarrierClient();

/** Committed balance, read on the second connection. */
async function committedMoney(userId) {
  const rows = await barrierClient.$queryRaw`SELECT money FROM "User" WHERE id = ${userId}`;
  return Number(rows[0].money);
}

/** Is the User row locked by an open transaction? NOWAIT, on the second connection. */
async function userRowIsLocked(userId) {
  try {
    await barrierClient.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE NOWAIT`;
    return false;
  } catch (error) {
    if (/could not obtain lock/i.test(error.message)) {
      return true;
    }
    throw error;
  }
}

describe('Equoria-sgkjp — a fee transaction failing after its debit rolls the debit back', () => {
  const cleanup = createCleanupTracker();
  let user;
  let groom;

  beforeAll(async () => {
    const suffix = tag();
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${fixturePrefix}-${suffix}`,
        email: `${fixturePrefix}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Roll',
        lastName: 'Back',
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
    }, 'rollback fixture user and dependents');

    groom = await prisma.groom.create({
      data: {
        name: `${fixturePrefix}-groom-${suffix}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        startAge: 20,
        userId,
      },
    });
    await prisma.groomEngagement.create({ data: { groomId: groom.id, userId } });
  }, 60000);

  afterAll(async () => {
    await cleanup.run();
    await barrierClient.$disconnect();
  }, 60000);

  it('debit run, then a database error: money, ledger and payment row all roll back together', async () => {
    expect(calculateWeeklyFee(groom)).toBeGreaterThan(0);

    const barrier = await holdLock(
      barrierClient,
      tx => tx.$queryRaw`SELECT id FROM "grooms" WHERE id = ${groom.id} FOR UPDATE`,
    );
    let pass;
    try {
      pass = processWeeklySalaries(payDay, { userId: user.id });
      await barrier.waitForQueued(1);

      // Mid-transaction, seen from outside the pool under test.
      expect(await userRowIsLocked(user.id)).toBe(true); // the debit HAS run
      expect(await committedMoney(user.id)).toBe(startingMoney); // ...uncommitted
      expect(await prisma.userTransaction.count({ where: { userId: user.id } })).toBe(0);

      const waiters = await blockedSessionPids(barrierClient, barrier.pid);
      expect(waiters).toHaveLength(1);
      await barrierClient.$queryRaw`SELECT pg_cancel_backend(${waiters[0]}::int) AS cancelled`;
    } finally {
      await barrier.release();
    }
    const results = await pass;

    // A database fault, not a lack of funds.
    expect(results.failed).toBe(1);
    expect(results.successful).toBe(0);
    expect(results.uncollected).toBe(1);

    // Everything the transaction wrote before the fault is gone.
    expect(await committedMoney(user.id)).toBe(startingMoney);
    expect(await prisma.userTransaction.count({ where: { userId: user.id, category: 'groomSalaryBurn' } })).toBe(0);
    expect(await prisma.groomSalaryPayment.count({ where: { groomId: groom.id, status: 'paid' } })).toBe(0);
    expect(await userRowIsLocked(user.id)).toBe(false);

    // And the week is on the record as uncollected (fail closed, Equoria-2ti1j).
    expect(
      await prisma.groomSalaryPayment.count({ where: { groomId: groom.id, status: 'missedCollectionError' } }),
    ).toBe(1);
  }, 60000);
});
