/**
 * financialLedgerService unit tests (Equoria-rr7 coverage sprint).
 *
 * Uses a real DB user fixture. Tests ensureLedgerTable idempotency,
 * recordTransaction round-trip, and getTransactionsForUser pagination.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  ensureLedgerTable,
  recordTransaction,
  getTransactionsForUser,
} from '../../../services/financialLedgerService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

let user;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `finledger-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `finledger${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'FinLedger',
      lastName: 'Tester',
      money: 1000,
    },
  });

  // Ensure table exists before any tests run
  await ensureLedgerTable();
}, 30000);

afterAll(async () => {
  // Clean up test transactions before deleting the user.
  // Typed Prisma deleteMany (replaces $executeRawUnsafe — Equoria-3ear). The
  // scoped where-clause filters by this test's userId only, satisfying
  // CLAUDE.md §2 "Cleanup logic must be SCOPED".
  await prisma.userTransaction.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

describe('ensureLedgerTable', () => {
  it('is idempotent — runs twice without error', async () => {
    await expect(ensureLedgerTable()).resolves.not.toThrow();
    await expect(ensureLedgerTable()).resolves.not.toThrow();
  });
});

describe('getTransactionsForUser', () => {
  it('returns empty page for user with no transactions', async () => {
    const result = await getTransactionsForUser(user.id);
    expect(Array.isArray(result.transactions)).toBe(true);
    expect(result.transactions).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(typeof result.pageSize).toBe('number');
  });
});

describe('recordTransaction', () => {
  it('records a credit transaction and returns the inserted row', async () => {
    const result = await recordTransaction({
      userId: user.id,
      type: 'credit',
      amount: 500,
      category: 'prize',
      description: 'Test prize payment',
      balanceAfter: 1500,
      metadata: { source: 'test' },
    });
    expect(typeof result.id).toBe('number');
    expect(result.type).toBe('credit');
    expect(result.amount).toBe(500);
    expect(result.category).toBe('prize');
  });

  it('recorded transaction appears in getTransactionsForUser', async () => {
    const result = await getTransactionsForUser(user.id);
    expect(result.total).toBeGreaterThan(0);
    const txTypes = result.transactions.map(t => t.type);
    expect(txTypes).toContain('credit');
  });

  it('records a debit transaction', async () => {
    const result = await recordTransaction({
      userId: user.id,
      type: 'debit',
      amount: 100,
      category: 'purchase',
      description: 'Test purchase',
    });
    expect(result.type).toBe('debit');
    expect(result.amount).toBe(100);
  });
});

describe('getTransactionsForUser pagination', () => {
  it('respects pageSize parameter', async () => {
    const result = await getTransactionsForUser(user.id, { page: 1, pageSize: 1 });
    expect(result.transactions.length).toBeLessThanOrEqual(1);
    expect(result.pageSize).toBe(1);
  });

  it('returns correct page number', async () => {
    const result = await getTransactionsForUser(user.id, { page: 2, pageSize: 1 });
    expect(result.page).toBe(2);
  });
});

// ── recordTransaction — validation branches (Equoria-jkht) ───────────────────

describe('recordTransaction — validation branches (Equoria-jkht)', () => {
  it('throws for invalid type (not credit/debit)', async () => {
    await expect(
      recordTransaction({ userId: user.id, type: 'invalid', amount: 100, category: 'x', description: 'x' }),
    ).rejects.toThrow('Invalid ledger transaction payload');
  });

  it('throws for amount=0 (normalizedAmount <= 0 branch)', async () => {
    await expect(
      recordTransaction({ userId: user.id, type: 'credit', amount: 0, category: 'x', description: 'x' }),
    ).rejects.toThrow('Invalid ledger transaction payload');
  });

  it('throws for negative amount (normalizedAmount <= 0 branch)', async () => {
    await expect(
      recordTransaction({ userId: user.id, type: 'credit', amount: -50, category: 'x', description: 'x' }),
    ).rejects.toThrow('Invalid ledger transaction payload');
  });

  it('throws for missing userId (!userId branch)', async () => {
    await expect(
      recordTransaction({ userId: null, type: 'credit', amount: 100, category: 'x', description: 'x' }),
    ).rejects.toThrow('Invalid ledger transaction payload');
  });
});

// ── getTransactionsForUser — clamp branches (Equoria-jkht) ───────────────────

describe('getTransactionsForUser — clamp branches (Equoria-jkht)', () => {
  it('clamps pageSize to 100 when pageSize > 100 (Math.min branch)', async () => {
    const result = await getTransactionsForUser(user.id, { page: 1, pageSize: 200 });
    expect(result.pageSize).toBe(100);
  });

  it('clamps page to 1 when page < 1 (Math.max branch)', async () => {
    const result = await getTransactionsForUser(user.id, { page: 0, pageSize: 5 });
    expect(result.page).toBe(1);
  });
});

// ── financialLedgerService — null-coalescing fallback branches ────────────────

describe('recordTransaction — metadata null branch (line 48 ?? fallback)', () => {
  it('records transaction when metadata is explicitly null (hits null ?? {} branch)', async () => {
    const result = await recordTransaction({
      userId: user.id,
      type: 'credit',
      amount: 25,
      category: 'test',
      description: 'metadata null branch test',
      metadata: null,
    });
    expect(typeof result.id).toBe('number');
    expect(result.type).toBe('credit');
    expect(result.amount).toBe(25);
  });
});

describe('getTransactionsForUser — parseInt NaN fallback branches (lines 56-57)', () => {
  it('falls back to page=1 when page is a non-numeric string (parseInt NaN || 1)', async () => {
    const result = await getTransactionsForUser(user.id, { page: 'foo', pageSize: 5 });
    expect(result.page).toBe(1);
    expect(Array.isArray(result.transactions)).toBe(true);
  });

  it('falls back to pageSize=20 when pageSize is a non-numeric string (parseInt NaN || 20)', async () => {
    const result = await getTransactionsForUser(user.id, { page: 1, pageSize: 'bar' });
    expect(result.pageSize).toBe(20);
    expect(Array.isArray(result.transactions)).toBe(true);
  });
});
