/**
 * debitMoneyOrThrow — atomic debit helper sentinel (Equoria-hjzwt).
 *
 * The helper exists to replace the codebase-wide check-then-debit pattern
 * (findUnique → if money<cost → update decrement) that is vulnerable to a
 * TOCTOU race where two concurrent debits both pass the pre-check and both
 * decrement, taking the wallet negative.
 *
 * The sentinel proves the helper itself never lets that race happen,
 * regardless of how many concurrent callers fire: with a wallet that covers
 * EXACTLY ONE debit, fire N parallel debits → exactly ONE returns the
 * post-decrement balance (0); all other (N-1) throw InsufficientFundsError;
 * wallet money never goes negative.
 *
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import {
  debitMoneyOrThrow,
  InsufficientFundsError,
} from '../services/financialLedgerService.mjs';

const FIXTURE_PREFIX = 'TestFixture-hjzwt';

let user;
const createdUserIds = [];

async function makeUser(money) {
  const tag = randomBytes(4).toString('hex');
  const u = await prisma.user.create({
    data: {
      email: `${FIXTURE_PREFIX}-${tag}@test.com`,
      username: `${FIXTURE_PREFIX}-${tag}`.slice(0, 30),
      password: 'irrelevant',
      firstName: 'Debit',
      lastName: 'Race',
      money,
    },
  });
  createdUserIds.push(u.id);
  return u;
}

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
  }
}, 30000);

describe('debitMoneyOrThrow — atomic debit helper (Equoria-hjzwt)', () => {
  it('returns post-decrement balance on success', async () => {
    user = await makeUser(500);
    const after = await debitMoneyOrThrow(prisma, { userId: user.id, amount: 200 });
    expect(after).toBe(300);
    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(Number(row.money)).toBe(300);
  });

  it('throws InsufficientFundsError when money < amount', async () => {
    const u = await makeUser(100);
    await expect(debitMoneyOrThrow(prisma, { userId: u.id, amount: 500 })).rejects.toBeInstanceOf(
      InsufficientFundsError,
    );
    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { money: true } });
    expect(Number(row.money)).toBe(100); // unchanged
  });

  it('throws on missing userId / non-positive amount', async () => {
    await expect(debitMoneyOrThrow(prisma, { amount: 1 })).rejects.toThrow(/userId is required/);
    await expect(
      debitMoneyOrThrow(prisma, { userId: 'x', amount: 0 }),
    ).rejects.toThrow(/positive integer/);
    await expect(
      debitMoneyOrThrow(prisma, { userId: 'x', amount: -5 }),
    ).rejects.toThrow(/positive integer/);
  });

  it('SENTINEL: 5 parallel debits with money for ONE — exactly 1 succeeds, 4 throw, balance never negative', async () => {
    const u = await makeUser(100); // EXACTLY one debit's worth
    const N = 5;
    const results = await Promise.allSettled(
      Array.from({ length: N }, () =>
        debitMoneyOrThrow(prisma, { userId: u.id, amount: 100 }),
      ),
    );

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(N - 1);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(InsufficientFundsError);
    }
    // Winner saw post-decrement balance = 0.
    expect(fulfilled[0].value).toBe(0);

    // CRITICAL: wallet never went negative — the whole point of the helper.
    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { money: true } });
    expect(Number(row.money)).toBe(0);
    expect(Number(row.money)).toBeGreaterThanOrEqual(0);
  });
});
