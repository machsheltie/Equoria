/**
 * Sentinel — shared retryable-transaction mapping (Equoria-7x9po).
 *
 * Proves the extracted classifier + wrapper behave exactly like the inline
 * Equoria-55m83 feedHorse logic they replaced: a transient P2028 tx-timeout maps
 * to a retryable 503, while EVERY genuine fault passes through unchanged (the
 * 503 must never mask a real bug — CLAUDE.md §3 / OPTIMAL_FIX_DISCIPLINE §2).
 *
 * REAL DB, no mocks: the forced-timeout cases drive an ACTUAL
 * `prisma.$transaction(fn, { timeout: 1, maxWait: 1 })` against the canonical
 * DB (a 1ms budget against a 200ms `pg_sleep`) — the exact P2028 class the CI
 * "Load Contention (advisory)" runner hit under pool/timeout pressure — and
 * assert the wrapper maps it to a 503 while leaving the genuine 404/400/Prisma
 * faults untouched. The shared util is the SINGLE place the migrated call sites
 * route their P2028 -> 503 mapping through, so this sentinel is the central
 * proof the whole migration relies on (see the per-site verification note in
 * Equoria-7x9po).
 */
import { describe, it, expect } from '@jest/globals';
import prisma from '../../packages/database/prismaClient.mjs';
import {
  isRetryableTxError,
  withRetryableTxMapping,
  runRetryableTransaction,
  RetryableTransactionError,
} from '../utils/retryableTransaction.mjs';
import { AppError } from '../errors/index.mjs';

describe('isRetryableTxError (Equoria-7x9po)', () => {
  it('classifies Prisma P2028 as retryable', () => {
    expect(isRetryableTxError({ code: 'P2028', message: 'Transaction API error' })).toBe(true);
  });

  it('classifies the two known timeout phrasings as retryable (no code)', () => {
    expect(isRetryableTxError({ message: 'Unable to start a transaction in the given time.' })).toBe(true);
    expect(isRetryableTxError({ message: 'Transaction already closed: the timeout for this transaction…' })).toBe(true);
  });

  it('does NOT classify genuine faults as retryable (no false 503)', () => {
    expect(isRetryableTxError({ code: 'P2002', message: 'Unique constraint failed' })).toBe(false);
    expect(isRetryableTxError({ code: 'P2025', message: 'Record not found' })).toBe(false);
    expect(isRetryableTxError({ message: 'Horse not found' })).toBe(false);
    expect(isRetryableTxError(new Error('something else'))).toBe(false);
  });

  it('does NOT throw on non-object input', () => {
    expect(isRetryableTxError(null)).toBe(false);
    expect(isRetryableTxError(undefined)).toBe(false);
    expect(isRetryableTxError('P2028')).toBe(false);
  });
});

describe('withRetryableTxMapping (Equoria-7x9po)', () => {
  it('passes a resolved value through unchanged', async () => {
    await expect(withRetryableTxMapping(Promise.resolve({ ok: 1 }))).resolves.toEqual({ ok: 1 });
  });

  it('FIRES on a REAL forced Prisma interactive-transaction timeout (P2028) and maps it to 503', async () => {
    // Force a genuine Prisma transaction timeout: a 1ms timeout against a query
    // that sleeps 200ms. This is the exact P2028 class the CI runner hit under
    // pool/timeout pressure — no mock, a real Prisma error driven through the
    // shared wrapper exactly as the migrated call sites use it.
    let thrown = null;
    try {
      await withRetryableTxMapping(
        prisma.$transaction(
          async tx => {
            await tx.$queryRaw`SELECT pg_sleep(0.2)`;
          },
          { timeout: 1, maxWait: 1 },
        ),
        { message: 'Busy, retry shortly.' },
      );
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    // The wrapper must have RECLASSIFIED the P2028 into a RetryableTransactionError
    // carrying the retryable status — NOT propagated the raw Prisma P2028 (which
    // has no .status and would map to 500 at the controller).
    expect(thrown).toBeInstanceOf(RetryableTransactionError);
    expect(thrown.status).toBe(503); // numeric — for controllers reading error.status
    expect(thrown.statusCode).toBe(503); // numeric — for the central errorHandler / err.statusCode
    expect(thrown.message).toBe('Busy, retry shortly.');
    // AppError subclass so the isAppError-gated next(error) auth sites forward it.
    expect(AppError.isAppError(thrown)).toBe(true);
  }, 20000);

  it('maps a constructed retryable P2028 timeout to a 503 with the caller message', async () => {
    const tx = Promise.reject(Object.assign(new Error('Unable to start a transaction…'), { code: 'P2028' }));
    await expect(withRetryableTxMapping(tx, { message: 'Busy, retry shortly.' })).rejects.toMatchObject({
      status: 503,
      statusCode: 503,
      message: 'Busy, retry shortly.',
    });
  });

  it('rethrows a NON-retryable error UNCHANGED (never masks a real fault as 503)', async () => {
    const original = Object.assign(new Error('Horse not found'), { status: 404 });
    await expect(withRetryableTxMapping(Promise.reject(original))).rejects.toBe(original);
  });

  it('does NOT reclassify a genuine in-tx fault driven through a REAL transaction', async () => {
    // A 404-style fault thrown INSIDE a real, non-timing-out transaction must
    // surface UNCHANGED — the wrapper must only rescue P2028, never a genuine
    // pre-condition error (the exact "don't mask a real bug" guard, CLAUDE.md §3).
    const genuine = Object.assign(new Error('Genuine pre-condition fault'), { status: 404 });
    let thrown = null;
    try {
      await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT 1`;
          throw genuine;
        }),
        { message: 'should not be used' },
      );
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBe(genuine); // same object, untouched
    expect(thrown.status).toBe(404);
    expect(thrown).not.toBeInstanceOf(RetryableTransactionError);
  }, 20000);

  it('defaults status to 503 when only a message is supplied', async () => {
    const tx = Promise.reject(Object.assign(new Error('tx timeout'), { code: 'P2028' }));
    await expect(withRetryableTxMapping(tx)).rejects.toMatchObject({ status: 503, statusCode: 503 });
  });
});

describe('runRetryableTransaction (Equoria-7x9po)', () => {
  it('returns the transaction value on success (real DB)', async () => {
    const rows = await runRetryableTransaction(prisma, async tx => {
      return tx.$queryRaw`SELECT 42 AS answer`;
    });
    expect(Number(rows[0].answer)).toBe(42);
  }, 20000);

  it('maps a REAL forced P2028 timeout to a 503 (real DB, via txOptions)', async () => {
    let thrown = null;
    try {
      await runRetryableTransaction(
        prisma,
        async tx => {
          await tx.$queryRaw`SELECT pg_sleep(0.2)`;
        },
        { txOptions: { timeout: 1, maxWait: 1 }, message: 'Busy, retry shortly.' },
      );
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(RetryableTransactionError);
    expect(thrown.status).toBe(503);
  }, 20000);
});
