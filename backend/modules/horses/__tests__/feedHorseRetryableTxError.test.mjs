/**
 * Real-DB test — feedHorse retryable-transaction-timeout classification
 * (Equoria-55m83).
 *
 * The defect: feedHorse() runs an interactive `prisma.$transaction`. Under
 * heavy concurrent contention on one horse row + a slow runner + a small
 * connection pool, the transaction can either fail to acquire a pool
 * connection within `maxWait` ("Unable to start a transaction in the given
 * time") or exceed the 5000ms interactive `timeout` ("Transaction already
 * closed … timeout"). Both are Prisma P2028 (`PrismaClientKnownRequestError`)
 * and are TRANSIENT, RETRYABLE conditions. The pre-fix code let that error
 * propagate without a `.status`, so the controller mapped it to HTTP 500 —
 * semantically wrong (500 = permanent server fault, "don't retry"). The CI
 * "Load Contention (advisory)" job surfaced exactly two such 500s
 * (run 27682539878).
 *
 * The fix classifies these with `isRetryableTxError(err)` and rethrows them as
 * a `{ status: 503 }` retryable error. This test pins BOTH directions of the
 * classifier (EDGE_CASE_FIX_DISCIPLINE.md §1, OPTIMAL_FIX_DISCIPLINE.md §2):
 *   - it FIRES on a REAL forced Prisma transaction timeout (P2028), and on the
 *     two exact CI message signatures, and
 *   - it does NOT over-match genuine errors (404/400/other Prisma codes) —
 *     those MUST still surface as 500/their own status so real bugs are not
 *     masked.
 *
 * Real DB, no mocks: the forced-timeout case drives an actual
 * `prisma.$transaction(fn, { timeout: 1, maxWait: 1 })` against the canonical
 * DB and asserts on the real thrown error.
 */

import { describe, it, expect } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { isRetryableTxError } from '../services/horseFeedService.mjs';

describe('isRetryableTxError — feed transaction-timeout classification (Equoria-55m83)', () => {
  it('FIRES on a REAL forced Prisma interactive-transaction timeout (P2028)', async () => {
    let thrown = null;
    try {
      // Force a genuine Prisma transaction timeout: a 1ms timeout against a
      // query that sleeps 200ms. This is the exact P2028 class the CI runner
      // hit under pool/timeout pressure — no mock, a real Prisma error.
      await prisma.$transaction(
        async tx => {
          await tx.$queryRaw`SELECT pg_sleep(0.2)`;
        },
        { timeout: 1, maxWait: 1 },
      );
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect(thrown.code).toBe('P2028'); // ground truth: forced timeout is P2028
    expect(isRetryableTxError(thrown)).toBe(true);
  });

  it('FIRES on the exact CI message signatures (maxWait + interactive timeout)', () => {
    const maxWait = new Error(
      'Invalid `prisma.$transaction()` invocation: Unable to start a transaction in the given time.',
    );
    const txTimeout = new Error(
      'Transaction already closed: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 5004 ms passed since the start of the transaction.',
    );
    expect(isRetryableTxError(maxWait)).toBe(true);
    expect(isRetryableTxError(txTimeout)).toBe(true);
  });

  it('FIRES on a P2028 code even when the message is opaque', () => {
    expect(isRetryableTxError({ code: 'P2028', message: 'Invalid `prisma.$queryRaw()` invocation:' })).toBe(true);
  });

  it('does NOT over-match genuine pre-condition errors (404/400) — those keep their own status', () => {
    const notFound = Object.assign(new Error('Horse not found'), { status: 404 });
    const outOfFeed = Object.assign(new Error('Out of Basic Feed. Purchase more from the feed shop.'), {
      status: 400,
    });
    expect(isRetryableTxError(notFound)).toBe(false);
    expect(isRetryableTxError(outOfFeed)).toBe(false);
  });

  it('does NOT over-match other Prisma errors (e.g. P2002 unique constraint) or generic faults — real bugs still surface', () => {
    expect(isRetryableTxError({ code: 'P2002', message: 'Unique constraint failed' })).toBe(false);
    expect(isRetryableTxError(new Error('boom — some genuine logic fault'))).toBe(false);
    expect(isRetryableTxError(null)).toBe(false);
    expect(isRetryableTxError(undefined)).toBe(false);
  });
});
