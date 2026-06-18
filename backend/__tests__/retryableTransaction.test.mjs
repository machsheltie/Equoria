/**
 * Sentinel — shared retryable-transaction mapping (Equoria-7x9po).
 *
 * Proves the extracted classifier + wrapper behave exactly like the inline
 * Equoria-55m83 feedHorse logic they replaced: a transient P2028 tx-timeout maps
 * to a retryable 503, while EVERY genuine fault passes through unchanged (the
 * 503 must never mask a real bug — CLAUDE.md §3 / OPTIMAL_FIX_DISCIPLINE §2).
 */
import { describe, it, expect } from '@jest/globals';
import { isRetryableTxError, withRetryableTxMapping } from '../utils/retryableTransaction.mjs';

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

  it('maps a retryable P2028 timeout to a 503 with the caller message', async () => {
    const tx = Promise.reject(Object.assign(new Error('Unable to start a transaction…'), { code: 'P2028' }));
    await expect(withRetryableTxMapping(tx, { message: 'Busy, retry shortly.' })).rejects.toMatchObject({
      status: 503,
      message: 'Busy, retry shortly.',
    });
  });

  it('rethrows a NON-retryable error UNCHANGED (never masks a real fault as 503)', async () => {
    const original = Object.assign(new Error('Horse not found'), { status: 404 });
    await expect(withRetryableTxMapping(Promise.reject(original))).rejects.toBe(original);
  });

  it('defaults status to 503 when only a message is supplied', async () => {
    const tx = Promise.reject(Object.assign(new Error('tx timeout'), { code: 'P2028' }));
    await expect(withRetryableTxMapping(tx)).rejects.toMatchObject({ status: 503 });
  });
});
