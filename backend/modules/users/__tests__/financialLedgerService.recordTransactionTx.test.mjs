/**
 * Equoria-pqp69 sentinel-positive tests for `recordTransactionTx`.
 *
 * The defect class this signature exists to prevent (per the bd issue):
 *   1) Legacy `recordTransaction(opts, client)` makes `tx` caller-supplied
 *      with `client = prisma` default → a caller that omits `tx` writes
 *      the ledger row OUTSIDE the parent's `$transaction`. If the parent
 *      then rolls back, the money mutation reverts but the ledger row
 *      persists — silent ledger drift.
 *   2) `balanceAfter` is caller-supplied → a stale read or off-by-one
 *      decrement ships an inaccurate audit trail with no DB-level check.
 *
 * These tests verify the structural fixes:
 *   - Sentinel 1: forgetting `tx` throws synchronously (not a silent write).
 *   - Sentinel 2: the ledger write IS rolled back when the parent tx
 *     throws after the call — the canonical "ledger consistency" claim.
 *   - Sentinel 3: `balanceAfter` is sourced from the SAME tx (observes
 *     pending decrement / increment), not from a caller-passed scalar.
 *
 * Each sentinel is structured to FAIL if the structural fix is reverted.
 * They are real-DB tests per CLAUDE.md §3 (no mocks; cleanup is id-scoped).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { recordTransactionTx } from '../../economy/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

const createdUserIds = [];

async function makeFixtureUser(initialMoney = 1000) {
  const suffix = `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
  const user = await prisma.user.create({
    data: {
      email: `TestFixture-pqp69-${suffix}@test.com`,
      username: `tfpqp69${suffix}`,
      password: 'irrelevant-hash',
      firstName: 'TestFixture',
      lastName: 'Pqp69',
      money: initialMoney,
    },
  });
  createdUserIds.push(user.id);
  return user;
}

afterAll(async () => {
  // Scoped cleanup per CLAUDE.md §3: only the ids THIS suite created.
  if (createdUserIds.length === 0) {
    return;
  }
  await prisma.userTransaction
    .deleteMany({ where: { userId: { in: createdUserIds } } })
    .catch(err => console.warn(`[cleanup] userTransaction.deleteMany: ${err.message}`));
  await prisma.user
    .deleteMany({ where: { id: { in: createdUserIds } } })
    .catch(err => console.warn(`[cleanup] user.deleteMany: ${err.message}`));
}, 30000);

describe('recordTransactionTx — Equoria-pqp69 sentinel-positive', () => {
  it('SENTINEL 1: throws synchronously when tx is omitted', async () => {
    // The whole point of the signature is that you cannot silently write to
    // the autocommit client by forgetting tx. If this assertion ever flips,
    // the structural guarantee is broken — the function has fallen back to
    // legacy behaviour and should not ship.
    await expect(
      recordTransactionTx(undefined, {
        userId: 'irrelevant',
        type: 'credit',
        amount: 1,
        category: 'x',
        description: 'x',
      }),
    ).rejects.toThrow(/tx.*required/i);

    await expect(
      recordTransactionTx(null, {
        userId: 'irrelevant',
        type: 'credit',
        amount: 1,
        category: 'x',
        description: 'x',
      }),
    ).rejects.toThrow(/tx.*required/i);

    // A "tx-looking" object that is NOT a real Prisma client should also
    // be rejected — `userTransaction.create` is the duck-type discriminator.
    await expect(
      recordTransactionTx(
        { somethingElse: () => {} },
        {
          userId: 'irrelevant',
          type: 'credit',
          amount: 1,
          category: 'x',
          description: 'x',
        },
      ),
    ).rejects.toThrow(/tx.*required/i);
  });

  it('SENTINEL 2: ledger row is rolled back when parent tx throws', async () => {
    // This is THE load-bearing sentinel from the issue's AC: "a parent
    // transaction rollback rolls back the ledger row too." If a future
    // refactor accidentally writes the ledger row outside `tx` (e.g. by
    // taking a `prisma` reference into the closure), this test will FAIL
    // because the ledger row will survive the throw.
    const user = await makeFixtureUser(1000);
    const ROLLBACK_MARKER = `pqp69-rollback-${randomBytes(4).toString('hex')}`;

    await expect(
      prisma.$transaction(async tx => {
        // Mutate money so we can also verify it rolls back.
        await tx.user.update({
          where: { id: user.id },
          data: { money: { decrement: 100 } },
        });
        await recordTransactionTx(tx, {
          userId: user.id,
          type: 'debit',
          amount: 100,
          category: ROLLBACK_MARKER,
          description: 'sentinel-2: should be rolled back',
        });
        // Force the rollback. If recordTransactionTx wrote through the
        // tx (correct), the ledger row goes away with this throw.
        throw new Error('intentional rollback for sentinel-2');
      }),
    ).rejects.toThrow('intentional rollback for sentinel-2');

    // Verify the ledger row did NOT persist — query by the unique category
    // marker so we can't false-positive on unrelated rows.
    const rows = await prisma.userTransaction.findMany({
      where: { userId: user.id, category: ROLLBACK_MARKER },
    });
    expect(rows).toHaveLength(0);

    // And the money mutation also rolled back (sanity check that the test
    // is actually exercising rollback, not silently committing).
    const userAfter = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(userAfter.money).toBe(1000);
  });

  it('SENTINEL 3: balanceAfter is sourced from the tx (observes pending decrement)', async () => {
    // The legacy signature lets the caller pass balanceAfter as a literal,
    // which has historically been wrong (e.g. passing the BEFORE balance,
    // passing a stale read from outside the tx). The new signature reads
    // it from the tx itself so callers cannot get it wrong. If a future
    // refactor accepts a caller-passed balanceAfter or reads from `prisma`
    // instead of `tx`, this test will see 1000 instead of 700 and fail.
    const user = await makeFixtureUser(1000);
    const CATEGORY = `pqp69-balance-${randomBytes(4).toString('hex')}`;

    const ledgerRow = await prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: user.id },
        data: { money: { decrement: 300 } },
      });
      // Inside the tx, the user's money should now be 700. Calling
      // recordTransactionTx WITHOUT passing balanceAfter must read 700.
      return recordTransactionTx(tx, {
        userId: user.id,
        type: 'debit',
        amount: 300,
        category: CATEGORY,
        description: 'sentinel-3: balanceAfter from tx',
      });
    });

    expect(ledgerRow.balanceAfter).toBe(700);

    // And the row really persisted (this is the happy-path commit, so
    // unlike sentinel-2 it stays in the table; cleanup deletes it).
    const persisted = await prisma.userTransaction.findUnique({
      where: { id: ledgerRow.id },
      select: { balanceAfter: true, category: true },
    });
    expect(persisted).not.toBeNull();
    expect(persisted.balanceAfter).toBe(700);
    expect(persisted.category).toBe(CATEGORY);
  });

  it('rejects invalid payload (type/amount/userId) even with valid tx', async () => {
    // The validation branch from the legacy fn is preserved.
    await prisma.$transaction(async tx => {
      await expect(
        recordTransactionTx(tx, {
          userId: 'whatever',
          type: 'invalid',
          amount: 100,
          category: 'x',
          description: 'x',
        }),
      ).rejects.toThrow('Invalid ledger transaction payload');

      await expect(
        recordTransactionTx(tx, {
          userId: 'whatever',
          type: 'credit',
          amount: 0,
          category: 'x',
          description: 'x',
        }),
      ).rejects.toThrow('Invalid ledger transaction payload');

      await expect(
        recordTransactionTx(tx, {
          userId: null,
          type: 'credit',
          amount: 100,
          category: 'x',
          description: 'x',
        }),
      ).rejects.toThrow('Invalid ledger transaction payload');
    });
  });
});
