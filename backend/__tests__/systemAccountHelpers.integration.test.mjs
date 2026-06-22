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
} from '../modules/economy/index.mjs';

const FIXTURE_PREFIX = 'TestFixture-si69u-helpers';

// Equoria-iomtg: the helper-behavior tests below exercise the SAME
// creditSystemAccount / debitSystemAccountOrThrow code path, but against a
// SUITE-PRIVATE, uniquely-named SystemAccount row created fresh in each
// `beforeEach` — NOT the shared singleton `show_escrow`/`burn` rows. The old
// `beforeEach` reset those shared rows to `balance: 0`, which (a) clobbered
// any concurrent sibling suite mid-flight under --runInBand / parallel shards
// and (b) made every absolute `toBe(...)` assertion here brittle to a sibling
// crediting the shared row between the reset and the assertion. Because
// SystemAccount.name is a free-form String PK (schema.prisma:548), a private
// row gives the same real-DB / real-atomic-predicate / real-ledger coverage
// with deterministic absolute assertions and zero shared-state contention.
// The shared seeded NAMES are still asserted in the "seeded accounts exist"
// test, which only READS them.
let testUserId;
let acct; // suite-private SystemAccount name, created fresh at balance 0 per test

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
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.user.delete({ where: { id: testUserId } }).catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  // Scoped cleanup of every suite-private SystemAccount row this suite created.
  await prisma.systemAccount
    .deleteMany({ where: { name: { startsWith: `${FIXTURE_PREFIX}-acct-` } } })
    .catch(err => console.warn(`[cleanup] systemAccount: ${err.message}`));
}, 30000);

beforeEach(async () => {
  // Fresh suite-private system account at balance 0 for each test — the SAME
  // helper code path the shared rows use, but isolated so absolute assertions
  // stay deterministic and we never clobber a shared singleton (Equoria-iomtg).
  acct = `${FIXTURE_PREFIX}-acct-${randomBytes(6).toString('hex')}`;
  await prisma.systemAccount.create({ data: { name: acct, balance: 0 } });
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
    const after = await creditSystemAccount(prisma, acct, 500, {
      category: 'test_credit',
      description: 'fixture credit',
      linkedUserId: testUserId,
    });
    expect(after).toBe(500);

    const row = await prisma.systemAccount.findUnique({
      where: { name: acct },
    });
    expect(Number(row.balance)).toBe(500);

    const ledger = await prisma.userTransaction.findMany({
      where: { userId: testUserId, category: 'test_credit' },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe('credit');
    expect(Number(ledger[0].amount)).toBe(500);
    expect(ledger[0].metadata.systemAccount).toBe(acct);
    expect(ledger[0].metadata.systemAccountSide).toBe('credit');
  });

  it('creditSystemAccount without linkedUserId skips ledger row (system-to-system move)', async () => {
    await creditSystemAccount(prisma, acct, 200, {
      category: 'system_to_system_test',
    });
    const ledger = await prisma.userTransaction.findMany({
      where: { category: 'system_to_system_test' },
    });
    expect(ledger).toHaveLength(0);
    const row = await prisma.systemAccount.findUnique({
      where: { name: acct },
    });
    expect(Number(row.balance)).toBe(200);
  });

  it('debitSystemAccountOrThrow returns post-balance and writes ledger row', async () => {
    await creditSystemAccount(prisma, acct, 1000, {
      category: 'seed',
    });
    const after = await debitSystemAccountOrThrow(prisma, acct, 300, {
      category: 'test_debit',
      linkedUserId: testUserId,
    });
    expect(after).toBe(700);

    const row = await prisma.systemAccount.findUnique({
      where: { name: acct },
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
    await creditSystemAccount(prisma, acct, 100, {
      category: 'seed',
    });
    await expect(
      debitSystemAccountOrThrow(prisma, acct, 500, {
        category: 'test_overdraw',
      }),
    ).rejects.toBeInstanceOf(InsufficientSystemAccountBalanceError);
    // Balance unchanged.
    const row = await prisma.systemAccount.findUnique({
      where: { name: acct },
    });
    expect(Number(row.balance)).toBe(100);
  });

  it('SENTINEL: 5 parallel debits with balance for ONE — exactly 1 succeeds, 4 throw, balance never negative', async () => {
    await creditSystemAccount(prisma, acct, 100, {
      category: 'seed_race',
    });
    const N = 5;
    const results = await Promise.allSettled(
      Array.from({ length: N }, () =>
        debitSystemAccountOrThrow(prisma, acct, 100, {
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
      where: { name: acct },
    });
    expect(Number(row.balance)).toBe(0);
    expect(Number(row.balance)).toBeGreaterThanOrEqual(0);
  });

  it('input validation: amount + name + category are required', async () => {
    await expect(creditSystemAccount(prisma, acct, 0, { category: 'x' })).rejects.toThrow(/positive integer/);
    await expect(creditSystemAccount(prisma, acct, 10, {})).rejects.toThrow(/category is required/);
    await expect(creditSystemAccount(prisma, '', 10, { category: 'x' })).rejects.toThrow(/name is required/);
  });

  // ---------------------------------------------------------------------------
  // Equoria-jou5c sentinel-positive: post-migration to recordTransactionTx
  // ---------------------------------------------------------------------------
  // The two internal recordTransaction() calls in creditSystemAccount and
  // debitSystemAccountOrThrow were migrated to recordTransactionTx(client,
  // {...skipBalanceRead:true}). These sentinels lock the structural
  // guarantees that the migration is supposed to preserve:
  //
  //   SENTINEL A: balanceAfter persists as NULL for system-account ledger
  //   rows. The user is an attribution counterparty, not a balance
  //   principal — recording the user's current money would be a misleading
  //   snapshot. If a future refactor drops skipBalanceRead (or recordTx
  //   defaults the flag the wrong way), this test will see a number
  //   instead of null and fail.
  //
  //   SENTINEL B: rollback parity. When the parent tx throws AFTER the
  //   system-account helper succeeds, the ledger row must NOT survive.
  //   This is the load-bearing property of the recordTransactionTx
  //   signature — if a refactor accidentally takes a `prisma` reference
  //   into the closure, the ledger row will persist and this test fails.
  describe('Equoria-jou5c — recordTransactionTx migration sentinels', () => {
    it('SENTINEL A: creditSystemAccount persists balanceAfter = null (skipBalanceRead)', async () => {
      // Give the user a non-zero, non-default money value so a regression
      // that drops skipBalanceRead cannot accidentally land on null.
      await prisma.user.update({
        where: { id: testUserId },
        data: { money: 4321 },
      });
      const marker = `jou5c-credit-${randomBytes(4).toString('hex')}`;

      await creditSystemAccount(prisma, acct, 250, {
        category: marker,
        description: 'sentinel A — credit must persist null balanceAfter',
        linkedUserId: testUserId,
      });

      const ledger = await prisma.userTransaction.findMany({
        where: { userId: testUserId, category: marker },
      });
      expect(ledger).toHaveLength(1);
      // The migration MUST preserve null. If this asserts to 4321 (or any
      // number), recordTransactionTx is reading the user's money and the
      // skipBalanceRead flag is broken.
      expect(ledger[0].balanceAfter).toBeNull();
    });

    it('SENTINEL A: debitSystemAccountOrThrow persists balanceAfter = null (skipBalanceRead)', async () => {
      await creditSystemAccount(prisma, acct, 1000, {
        category: 'seed_jou5c_debit',
      });
      await prisma.user.update({
        where: { id: testUserId },
        data: { money: 8765 },
      });
      const marker = `jou5c-debit-${randomBytes(4).toString('hex')}`;

      await debitSystemAccountOrThrow(prisma, acct, 250, {
        category: marker,
        description: 'sentinel A — debit must persist null balanceAfter',
        linkedUserId: testUserId,
      });

      const ledger = await prisma.userTransaction.findMany({
        where: { userId: testUserId, category: marker },
      });
      expect(ledger).toHaveLength(1);
      expect(ledger[0].balanceAfter).toBeNull();
    });

    it('SENTINEL B: parent tx throw rolls back the system-account ledger row', async () => {
      const marker = `jou5c-rollback-${randomBytes(4).toString('hex')}`;
      // Seed the suite-private account with enough balance that the debit
      // predicate succeeds — the throw comes AFTER the helper completes.
      await creditSystemAccount(prisma, acct, 1000, {
        category: 'seed_jou5c_rollback',
      });

      await expect(
        prisma.$transaction(async tx => {
          await debitSystemAccountOrThrow(tx, acct, 500, {
            category: marker,
            description: 'sentinel B — should roll back with parent throw',
            linkedUserId: testUserId,
          });
          // Force rollback. recordTransactionTx wrote the ledger row
          // through `tx` so it MUST disappear with this throw.
          throw new Error('intentional rollback for jou5c sentinel B');
        }),
      ).rejects.toThrow('intentional rollback for jou5c sentinel B');

      const survivors = await prisma.userTransaction.findMany({
        where: { userId: testUserId, category: marker },
      });
      expect(survivors).toHaveLength(0);

      // The system_account balance must also roll back — sanity check that
      // the test really exercised rollback rather than silently committing.
      const acctRow = await prisma.systemAccount.findUnique({
        where: { name: acct },
      });
      expect(Number(acctRow.balance)).toBe(1000);
    });
  });
});
