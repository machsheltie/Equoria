/**
 * A genuine deadlock or serialization failure maps to the retryable 503
 * (Equoria-l9bde).
 *
 * Postgres aborts one side of a deadlock (40P01) or of a serializable write
 * conflict (40001). Both are transient: the same request succeeds if the
 * player repeats it, so they answer 503 ("busy, retry shortly") like a
 * transaction timeout (P2028), never 500. No retry is added: this only maps
 * the error for the player (owner rule: no retries to get a pass).
 *
 * Real DB, real transactions, no mocks. Each case drives two interactive
 * transactions on the shared client through a barrier so the conflict is
 * certain, not timing-dependent:
 *   - deadlock: A locks row 1, B locks row 2, then A wants 2 and B wants 1;
 *     Postgres kills one after deadlock_timeout.
 *   - serialization: two SERIALIZABLE transactions each read both rows, then
 *     each writes one; the second commit fails the read/write dependency.
 * Exactly one side must fail, and it must fail as RetryableTransactionError 503.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../packages/database/prismaClient.mjs';
import {
  isRetryableTxError,
  withRetryableTxMapping,
  RetryableTransactionError,
} from '../utils/retryableTransaction.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { AppError } from '../errors/index.mjs';

const TAG = `l9bde-${randomBytes(4).toString('hex')}`;
const cleanup = createCleanupTracker();
let rowA;
let rowB;

/** A two-party barrier: each side awaits until both have arrived. */
function barrier() {
  let arrived = 0;
  let release;
  const open = new Promise(resolve => {
    release = resolve;
  });
  return async () => {
    arrived += 1;
    if (arrived === 2) {
      release();
    }
    await open;
  };
}

function makeUser(suffix) {
  return prisma.user.create({
    data: {
      emailVerified: true,
      username: `${TAG}-${suffix}`,
      email: `${TAG}-${suffix}@example.com`,
      password: 'irrelevant-hash',
      firstName: 'Conflict',
      lastName: suffix,
      money: 1000,
    },
  });
}

const bump = (tx, id) => tx.user.update({ where: { id }, data: { money: { increment: 1 } } });

/** Settle both, then demand exactly one fulfilled and one retryable 503. */
async function expectOneRetryable503(results) {
  const settled = await Promise.allSettled(results);
  const rejected = settled.filter(r => r.status === 'rejected');
  expect(settled.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  const err = rejected[0].reason;
  expect(err).toBeInstanceOf(RetryableTransactionError);
  expect(err.statusCode).toBe(503);
  expect(err.status).toBe(503);
}

beforeAll(async () => {
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [rowA?.id, rowB?.id].filter(Boolean) } } }), 'users');
  rowA = await makeUser('a');
  rowB = await makeUser('b');
});

afterAll(() => cleanup.run(), 30000);

describe('transient transaction conflicts map to the retryable 503 (Equoria-l9bde)', () => {
  it('a real deadlock (two transactions locking rows in opposite order)', async () => {
    const bothLocked = barrier();
    const side = (first, second) =>
      withRetryableTxMapping(
        prisma.$transaction(
          async tx => {
            await bump(tx, first);
            await bothLocked();
            await bump(tx, second);
          },
          { timeout: 20000, maxWait: 10000 },
        ),
      );

    await expectOneRetryable503([side(rowA.id, rowB.id), side(rowB.id, rowA.id)]);
  }, 30000);

  it('a real serialization failure (two SERIALIZABLE read-then-write transactions)', async () => {
    const bothRead = barrier();
    const side = target =>
      withRetryableTxMapping(
        prisma.$transaction(
          async tx => {
            await tx.user.findMany({ where: { id: { in: [rowA.id, rowB.id] } }, select: { money: true } });
            await bothRead();
            await bump(tx, target);
          },
          { isolationLevel: 'Serializable', timeout: 20000, maxWait: 10000 },
        ),
      );

    await expectOneRetryable503([side(rowA.id), side(rowB.id)]);
  }, 30000);

  it('a real deadlock on raw SQL (the raw-query error form)', async () => {
    const bothLocked = barrier();
    const rawBump = (tx, id) => tx.$executeRaw`UPDATE "User" SET money = money + 1 WHERE id = ${id}`;
    const side = (first, second) =>
      withRetryableTxMapping(
        prisma.$transaction(
          async tx => {
            await rawBump(tx, first);
            await bothLocked();
            await rawBump(tx, second);
          },
          { timeout: 20000, maxWait: 10000 },
        ),
      );

    await expectOneRetryable503([side(rowA.id, rowB.id), side(rowB.id, rowA.id)]);
  }, 30000);

  it('stays narrow: a bare 40001 in a message (an id) and other Prisma faults are not retryable', () => {
    expect(isRetryableTxError({ code: 'P2025', message: 'Horse 40001 not found' })).toBe(false);
    expect(isRetryableTxError(new Error('User 40P01 does not exist'))).toBe(false);
    expect(isRetryableTxError({ code: 'P2002', meta: { target: ['email'] } })).toBe(false);
  });

  it('reads the conflict phrases only on a Prisma error: a plain Error or an AppError saying "deadlock detected" is not retryable', () => {
    expect(isRetryableTxError(new Error('deadlock detected in the stable roster'))).toBe(false);
    expect(isRetryableTxError(new AppError('deadlock detected', 409))).toBe(false);
    expect(isRetryableTxError(new Error('PostgresError { code: "40P01" } quoted in a log line'))).toBe(false);
    expect(isRetryableTxError(new Error('could not serialize access due to concurrent update'))).toBe(false);
  });
});
