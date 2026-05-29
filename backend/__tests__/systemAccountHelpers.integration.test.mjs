/**
 * SystemAccount credit/debit helper sentinel (Equoria-si69u).
 *
 * Locks the contract that the show-escrow refactor depends on:
 *   - creditSystemAccount: positive amount required, increments balance,
 *     writes paired ledger row when linkedUserId is provided.
 *   - debitSystemAccountOrThrow: atomic predicate (balance >= amount),
 *     throws InsufficientSystemAccountBalanceError on count===0, never
 *     drives balance negative under concurrent debits.
 *   - The seeded named accounts (`show_escrow`, `burn`) exist post-migration.
 *
 * Real DB, no mocks, scoped cleanup of any side effects.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import {
  SYSTEM_ACCOUNT_SHOW_ESCROW,
  SYSTEM_ACCOUNT_BURN,
  creditSystemAccount,
  debitSystemAccountOrThrow,
  InsufficientSystemAccountBalanceError,
} from '../services/financialLedgerService.mjs';

const FIXTURE_PREFIX = 'TestFixture-si69u-helpers';
let testUserId;

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const u = await prisma.user.create({
    data: {
      email: `${FIXTURE_PREFIX}-${tag}@test.com`,
      username: `${FIXTURE_PREFIX}-${tag}`.slice(0, 30),
      password: 'irrelevant',
      firstName: 'Sys',
      lastName: 'Helper',
      money: 0,
    },
  });
  testUserId = u.id;
}, 30000);

afterAll(async () => {
  if (testUserId) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: testUserId } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
  }
}, 30000);

beforeEach(async () => {
  // Reset the two seeded system accounts to 0 between tests so concurrent
  // suite runs and re-runs are deterministic. The seeded NAMES persist;
  // the BALANCE is the test fixture state.
  await prisma.systemAccount.update({
    where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
    data: { balance: 0 },
  });
  await prisma.systemAccount.update({
    where: { name: SYSTEM_ACCOUNT_BURN },
    data: { balance: 0 },
  });
});

describe('SystemAccount helpers (Equoria-si69u)', () => {
  it('seeded accounts exist post-migration', async () => {
    const rows = await prisma.systemAccount.findMany({
      where: { name: { in: [SYSTEM_ACCOUNT_SHOW_ESCROW, SYSTEM_ACCOUNT_BURN] } },
      orderBy: { name: 'asc' },
    });
    expect(rows.map(r => r.name).sort()).toEqual(['burn', 'show_escrow']);
  });

  it('creditSystemAccount increments balance and writes ledger row when linkedUserId given', async () => {
    const after = await creditSystemAccount(prisma, SYSTEM_ACCOUNT_SHOW_ESCROW, 500, {
      category: 'test_credit',
      description: 'fixture credit',
      linkedUserId: testUserId,
    });
    expect(after).toBe(500);

    const row = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
    });
    expect(Number(row.balance)).toBe(500);

    const ledger = await prisma.userTransaction.findMany({
      where: { userId: testUserId, category: 'test_credit' },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe('credit');
    expect(Number(ledger[0].amount)).toBe(500);
    expect(ledger[0].metadata.systemAccount).toBe(SYSTEM_ACCOUNT_SHOW_ESCROW);
    expect(ledger[0].metadata.systemAccountSide).toBe('credit');
  });

  it('creditSystemAccount without linkedUserId skips ledger row (system-to-system move)', async () => {
    await creditSystemAccount(prisma, SYSTEM_ACCOUNT_BURN, 200, {
      category: 'system_to_system_test',
    });
    const ledger = await prisma.userTransaction.findMany({
      where: { category: 'system_to_system_test' },
    });
    expect(ledger).toHaveLength(0);
    const row = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_BURN },
    });
    expect(Number(row.balance)).toBe(200);
  });

  it('debitSystemAccountOrThrow returns post-balance and writes ledger row', async () => {
    await creditSystemAccount(prisma, SYSTEM_ACCOUNT_SHOW_ESCROW, 1000, {
      category: 'seed',
    });
    const after = await debitSystemAccountOrThrow(prisma, SYSTEM_ACCOUNT_SHOW_ESCROW, 300, {
      category: 'test_debit',
      linkedUserId: testUserId,
    });
    expect(after).toBe(700);

    const row = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
    });
    expect(Number(row.balance)).toBe(700);

    const ledger = await prisma.userTransaction.findMany({
      where: { userId: testUserId, category: 'test_debit' },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe('debit');
    expect(Number(ledger[0].amount)).toBe(300);
  });

  it('SENTINEL: debitSystemAccountOrThrow throws when balance < amount (no underflow)', async () => {
    await creditSystemAccount(prisma, SYSTEM_ACCOUNT_SHOW_ESCROW, 100, {
      category: 'seed',
    });
    await expect(
      debitSystemAccountOrThrow(prisma, SYSTEM_ACCOUNT_SHOW_ESCROW, 500, {
        category: 'test_overdraw',
      }),
    ).rejects.toBeInstanceOf(InsufficientSystemAccountBalanceError);
    // Balance unchanged.
    const row = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
    });
    expect(Number(row.balance)).toBe(100);
  });

  it('SENTINEL: 5 parallel debits with balance for ONE — exactly 1 succeeds, 4 throw, balance never negative', async () => {
    await creditSystemAccount(prisma, SYSTEM_ACCOUNT_SHOW_ESCROW, 100, {
      category: 'seed_race',
    });
    const N = 5;
    const results = await Promise.allSettled(
      Array.from({ length: N }, () =>
        debitSystemAccountOrThrow(prisma, SYSTEM_ACCOUNT_SHOW_ESCROW, 100, {
          category: 'race_debit',
        }),
      ),
    );
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(N - 1);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(InsufficientSystemAccountBalanceError);
    }
    expect(fulfilled[0].value).toBe(0);

    const row = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_SHOW_ESCROW },
    });
    expect(Number(row.balance)).toBe(0);
    expect(Number(row.balance)).toBeGreaterThanOrEqual(0);
  });

  it('input validation: amount + name + category are required', async () => {
    await expect(
      creditSystemAccount(prisma, SYSTEM_ACCOUNT_SHOW_ESCROW, 0, { category: 'x' }),
    ).rejects.toThrow(/positive integer/);
    await expect(
      creditSystemAccount(prisma, SYSTEM_ACCOUNT_SHOW_ESCROW, 10, {}),
    ).rejects.toThrow(/category is required/);
    await expect(creditSystemAccount(prisma, '', 10, { category: 'x' })).rejects.toThrow(
      /name is required/,
    );
  });
});
