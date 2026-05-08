/**
 * financialLedgerService unit tests (Equoria-rr7 coverage sprint).
 *
 * Uses a real DB user fixture. Tests ensureLedgerTable idempotency,
 * recordTransaction round-trip, and getTransactionsForUser pagination.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  ensureLedgerTable,
  recordTransaction,
  getTransactionsForUser,
} from '../../services/financialLedgerService.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `finledger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `finledger${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
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
  // Clean up test transactions before deleting the user
  await prisma.$executeRawUnsafe('DELETE FROM user_transactions WHERE "userId" = $1', user.id).catch(() => {});
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
