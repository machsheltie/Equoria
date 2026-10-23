/**
 * transferUserMoneyOrThrow — the one player-to-player money move
 * (Equoria-e7tgc.3).
 *
 * The defect class it closes: every player-to-player payment (the stud fee at
 * a public booking and at a private-request approval, and buyHorse) carried
 * its own inline copy of "guarded debit, credit, two ledger rows". A copy that
 * drifts (a credit without the guarded debit, a ledger row on the wrong side,
 * a lock order flipped) mints or burns coin, and nothing structural stops it.
 *
 * This suite proves, on the real database:
 *   1. Conservation: the payer loses exactly the amount, the payee gains
 *      exactly the amount, the pair's total is unchanged, and exactly two
 *      ledger rows are written with each side's true balance after the move.
 *      Run for both id orders (the helper locks User rows in ascending id).
 *   2. Boundary: a balance equal to the amount pays; one coin short throws
 *      InsufficientFundsError and nothing moves — not even when the caller
 *      swallows the error and commits.
 *   3. Double spend: two concurrent transfers from a wallet that holds one
 *      fee — exactly one succeeds. A planted naive read-check-write variant
 *      under the same interleaving overspends, so the scenario has teeth.
 *   4. Rollback: a throw in the parent transaction after the transfer undoes
 *      both balances and both ledger rows.
 *   5. Bad calls (no tx, self-transfer, non-positive or fractional amount,
 *      missing category, unknown payee) are refused and move nothing.
 *
 * Real DB, no mocks, id-scoped fail-loud cleanup.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { InsufficientFundsError, transferUserMoneyOrThrow } from '../index.mjs';

const PREFIX = 'TestFixture-e7tgc3-transfer';
const DEBIT = 'e7tgc3TestPaid';
const CREDIT = 'e7tgc3TestReceived';

const cleanup = createCleanupTracker();
const userIds = [];

async function makeUser(money) {
  const tag = randomBytes(6).toString('hex');
  const user = await prisma.user.create({
    data: {
      username: `${PREFIX}-${tag}`,
      email: `${PREFIX}-${tag}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Transfer',
      lastName: 'E7tgc3',
      money,
    },
  });
  userIds.push(user.id);
  return user;
}

/** Two fresh users, returned as [lower id, higher id]. */
async function makePair(lowMoney, highMoney) {
  const a = await makeUser(0);
  const b = await makeUser(0);
  const [low, high] = a.id < b.id ? [a, b] : [b, a];
  await prisma.user.update({ where: { id: low.id }, data: { money: lowMoney } });
  await prisma.user.update({ where: { id: high.id }, data: { money: highMoney } });
  return [low, high];
}

async function moneyOf(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

function ledgerOf(ids) {
  return prisma.userTransaction.findMany({
    where: { userId: { in: ids } },
    orderBy: { id: 'asc' },
  });
}

function transferArgs(fromUserId, toUserId, amount, extra = {}) {
  return {
    fromUserId,
    toUserId,
    amount,
    debitCategory: DEBIT,
    creditCategory: CREDIT,
    debitDescription: 'e7tgc3 test payment',
    creditDescription: 'e7tgc3 test receipt',
    metadata: { test: 'e7tgc3' },
    ...extra,
  };
}

afterEach(async () => {
  const ids = [...userIds];
  userIds.length = 0;
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: ids } } }), 'ledger');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids } } }), 'users');
  await cleanup.run();
});

describe('transferUserMoneyOrThrow conserves money between two players (Equoria-e7tgc.3)', () => {
  it.each([
    ['payer has the lower id', 'low'],
    ['payer has the higher id', 'high'],
  ])('moves exactly the amount, once, with both ledger rows (%s)', async (_label, payerSide) => {
    const [low, high] = await makePair(1000, 1000);
    const [payer, payee] = payerSide === 'low' ? [low, high] : [high, low];

    const result = await prisma.$transaction(tx => transferUserMoneyOrThrow(tx, transferArgs(payer.id, payee.id, 300)));

    expect(await moneyOf(payer.id)).toBe(700);
    expect(await moneyOf(payee.id)).toBe(1300);
    expect((await moneyOf(payer.id)) + (await moneyOf(payee.id))).toBe(2000);
    expect(result).toEqual({ fromBalanceAfter: 700, toBalanceAfter: 1300 });

    const rows = await ledgerOf([payer.id, payee.id]);
    expect(rows).toHaveLength(2);
    const paid = rows.find(row => row.userId === payer.id);
    const received = rows.find(row => row.userId === payee.id);
    expect(paid).toMatchObject({
      type: 'debit',
      amount: 300,
      category: DEBIT,
      description: 'e7tgc3 test payment',
      balanceAfter: 700,
    });
    expect(received).toMatchObject({
      type: 'credit',
      amount: 300,
      category: CREDIT,
      description: 'e7tgc3 test receipt',
      balanceAfter: 1300,
    });
    expect(paid.metadata).toEqual({ test: 'e7tgc3', counterpartyId: payee.id });
    expect(received.metadata).toEqual({ test: 'e7tgc3', counterpartyId: payer.id });
  });

  it('pays when the balance is exactly the amount', async () => {
    const [payer, payee] = await makePair(250, 0);

    await prisma.$transaction(tx => transferUserMoneyOrThrow(tx, transferArgs(payer.id, payee.id, 250)));

    expect(await moneyOf(payer.id)).toBe(0);
    expect(await moneyOf(payee.id)).toBe(250);
    expect(await ledgerOf([payer.id, payee.id])).toHaveLength(2);
  });

  it.each([
    ['payer has the lower id', 'low'],
    ['payer has the higher id', 'high'],
  ])('one coin short throws InsufficientFundsError and moves nothing (%s)', async (_label, payerSide) => {
    const [low, high] = await makePair(249, 500);
    const [payer, payee] = payerSide === 'low' ? [low, high] : [high, low];
    await prisma.user.update({ where: { id: payer.id }, data: { money: 249 } });
    await prisma.user.update({ where: { id: payee.id }, data: { money: 500 } });

    await expect(
      prisma.$transaction(tx => transferUserMoneyOrThrow(tx, transferArgs(payer.id, payee.id, 250))),
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    expect(await moneyOf(payer.id)).toBe(249);
    expect(await moneyOf(payee.id)).toBe(500);
    expect(await ledgerOf([payer.id, payee.id])).toHaveLength(0);
  });

  it.each([
    ['payer has the lower id', 'low'],
    ['payer has the higher id', 'high'],
  ])('a caller that swallows the shortfall and commits still moved nothing (%s)', async (_label, payerSide) => {
    const [low, high] = await makePair(0, 0);
    const [payer, payee] = payerSide === 'low' ? [low, high] : [high, low];
    await prisma.user.update({ where: { id: payer.id }, data: { money: 10 } });
    await prisma.user.update({ where: { id: payee.id }, data: { money: 500 } });

    const caught = await prisma.$transaction(async tx => {
      try {
        await transferUserMoneyOrThrow(tx, transferArgs(payer.id, payee.id, 250));
        return null;
      } catch (error) {
        return error; // swallowed: this transaction COMMITS
      }
    });

    expect(caught).toBeInstanceOf(InsufficientFundsError);
    expect(await moneyOf(payer.id)).toBe(10);
    expect(await moneyOf(payee.id)).toBe(500);
    expect(await ledgerOf([payer.id, payee.id])).toHaveLength(0);
  });

  it('rolls back both balances and both ledger rows when the parent transaction throws after it', async () => {
    const [payer, payee] = await makePair(1000, 1000);

    await expect(
      prisma.$transaction(async tx => {
        await transferUserMoneyOrThrow(tx, transferArgs(payer.id, payee.id, 400));
        throw new Error('parent failed after the transfer');
      }),
    ).rejects.toThrow('parent failed after the transfer');

    expect(await moneyOf(payer.id)).toBe(1000);
    expect(await moneyOf(payee.id)).toBe(1000);
    expect(await ledgerOf([payer.id, payee.id])).toHaveLength(0);
  });

  describe('double spend: a wallet that holds one fee pays once', () => {
    /**
     * Run two transfers of `amount` from `payer` to `payee` in two concurrent
     * transactions and settle both. `transfer(tx, args, arrived)` performs one
     * transfer; a variant with a read step calls `arrived()` after its read so
     * the scenario can hold both reads until each transaction has made one —
     * the exact window a read-check-write debit loses.
     */
    async function doubleSpend(transfer, { payer, payee, amount }) {
      let arrivedCount = 0;
      let releaseReads;
      const bothRead = new Promise(resolve => {
        releaseReads = resolve;
      });
      const arrived = async () => {
        arrivedCount += 1;
        if (arrivedCount === 2) {
          releaseReads();
        }
        await bothRead;
      };
      const attempt = () =>
        prisma.$transaction(tx => transfer(tx, transferArgs(payer.id, payee.id, amount), arrived), {
          timeout: 20000,
        });
      return Promise.allSettled([attempt(), attempt()]);
    }

    /** PLANTED naive variant: read, check, then write without a predicate. */
    async function naiveTransfer(tx, { fromUserId, toUserId, amount }, arrived) {
      const payerRow = await tx.user.findUnique({ where: { id: fromUserId }, select: { money: true } });
      await arrived();
      if (payerRow.money < amount) {
        throw new InsufficientFundsError();
      }
      await tx.user.update({ where: { id: fromUserId }, data: { money: { decrement: amount } } });
      await tx.user.update({ where: { id: toUserId }, data: { money: { increment: amount } } });
    }

    it('DETECTOR PROOF: the planted read-check-write variant pays twice and overdraws the payer', async () => {
      const [payer, payee] = await makePair(500, 0);

      const settled = await doubleSpend(naiveTransfer, { payer, payee, amount: 500 });

      expect(settled.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(2);
      expect(await moneyOf(payer.id)).toBe(-500);
      expect(await moneyOf(payee.id)).toBe(1000);
    });

    it('transferUserMoneyOrThrow: exactly one transfer succeeds and the payer never goes negative', async () => {
      const [payer, payee] = await makePair(500, 0);

      const settled = await doubleSpend(
        async (tx, args, arrived) => {
          // The helper has no read before its guarded write, so there is no
          // read window to hold: both transactions arrive, then both transfer.
          await arrived();
          return transferUserMoneyOrThrow(tx, args);
        },
        { payer, payee, amount: 500 },
      );

      const fulfilled = settled.filter(outcome => outcome.status === 'fulfilled');
      const rejected = settled.filter(outcome => outcome.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(InsufficientFundsError);
      expect(await moneyOf(payer.id)).toBe(0);
      expect(await moneyOf(payee.id)).toBe(500);
      expect(await ledgerOf([payer.id, payee.id])).toHaveLength(2);
    });
  });

  describe('refuses a bad call before moving anything', () => {
    it.each([
      ['a zero amount', { amount: 0 }, /amount must be a positive integer/],
      ['a negative amount', { amount: -5 }, /amount must be a positive integer/],
      ['a fractional amount', { amount: 2.5 }, /amount must be a positive integer/],
      ['a missing debit category', { debitCategory: undefined }, /debitCategory is required/],
      ['a missing credit category', { creditCategory: '' }, /creditCategory is required/],
    ])('%s', async (_label, override, message) => {
      const [payer, payee] = await makePair(1000, 1000);

      await expect(
        prisma.$transaction(tx =>
          transferUserMoneyOrThrow(tx, { ...transferArgs(payer.id, payee.id, 100), ...override }),
        ),
      ).rejects.toThrow(message);

      expect(await moneyOf(payer.id)).toBe(1000);
      expect(await moneyOf(payee.id)).toBe(1000);
      expect(await ledgerOf([payer.id, payee.id])).toHaveLength(0);
    });

    it('a self-transfer', async () => {
      const payer = await makeUser(1000);

      await expect(
        prisma.$transaction(tx => transferUserMoneyOrThrow(tx, transferArgs(payer.id, payer.id, 100))),
      ).rejects.toThrow(/cannot pay themselves/);

      expect(await moneyOf(payer.id)).toBe(1000);
      expect(await ledgerOf([payer.id])).toHaveLength(0);
    });

    it('no transaction client', async () => {
      const [payer, payee] = await makePair(1000, 1000);

      await expect(transferUserMoneyOrThrow(undefined, transferArgs(payer.id, payee.id, 100))).rejects.toThrow(
        /interactive transaction client is required/,
      );
      await expect(transferUserMoneyOrThrow(prisma, transferArgs(payer.id, payee.id, 100))).rejects.toThrow(
        /interactive transaction client is required/,
      );

      expect(await moneyOf(payer.id)).toBe(1000);
      expect(await moneyOf(payee.id)).toBe(1000);
    });

    it.each([
      ['lower', '00000000-0000-0000-0000-000000000000'],
      ['higher', 'ffffffff-ffff-ffff-ffff-ffffffffffff'],
    ])('a payee that does not exist (id sorts %s than the payer)', async (_label, missingId) => {
      const payer = await makeUser(1000);

      await expect(
        prisma.$transaction(tx => transferUserMoneyOrThrow(tx, transferArgs(payer.id, missingId, 100))),
      ).rejects.toThrow(/payee .* not found/);

      expect(await moneyOf(payer.id)).toBe(1000);
      expect(await ledgerOf([payer.id])).toHaveLength(0);
    });
  });
});
