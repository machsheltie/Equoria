/**
 * Equoria-6p398.8 / Equoria-6q7wr sentinel — a raw statement issued on an
 * interactive transaction client MUST execute inside that transaction.
 *
 * WHAT THIS GUARDS, AND WHY IT OUTLIVED THE MIDDLEWARE THAT CAUSED IT
 *   `databaseConnectionMiddleware` used to count queries by reassigning
 *   `$queryRaw` / `$executeRaw` on the SHARED Prisma client for the life of a
 *   request, forwarding with `.apply(prisma, args)`. An interactive
 *   transaction client (`tx`) reaches those methods through the very
 *   properties that were replaced, so every raw statement issued inside a
 *   `prisma.$transaction` was re-bound to the ROOT client and ran on its own
 *   connection, in its own implicit transaction — committed on the spot and
 *   immune to the surrounding ROLLBACK (2026-09-05 audit, Finding 1).
 *
 *   That middleware is gone (Equoria-6q7wr): it had no consumer outside its
 *   own tests, it counted only raw statements so it was blind to the ORM N+1
 *   it purported to alarm on, and it mutated a shared singleton on every
 *   request. Deleting it removed the defect class outright.
 *
 *   This file remains as the standing guard. Any future wrapper — middleware,
 *   instrumentation, a metrics shim — that re-binds these methods away from
 *   their caller reintroduces the same silent loss of atomicity, and the
 *   baseline case below fails the moment it is mounted.
 *
 * WHY THE ASSERTIONS DISCRIMINATE (no mocks, no sleeps, real PostgreSQL)
 *   On the root client each raw statement is its OWN implicit transaction.
 *   That is the signal:
 *
 *   1. `$queryRaw` — two `SELECT txid_current()` in ONE `prisma.$transaction`
 *      report the SAME id when the call reaches the transaction client, and
 *      DIFFERENT ids when it is re-bound. This is the audit's own measurement
 *      (350655/350657 broken, 350670/350670 correct).
 *
 *   2. `$executeRaw` — `pg_advisory_xact_lock` is held only for the life of
 *      the transaction that took it, on that transaction's connection. Taken
 *      through a re-bound `$executeRaw` it lands on a one-statement implicit
 *      transaction and is released immediately, so nothing is held against
 *      this backend. This is the production shape of
 *      groomEngagementService.acquirePayWeekLockTx and
 *      cronLock.withAdvisoryLock, and the worst failure mode of the defect:
 *      the lock call RETURNS SUCCESS while holding nothing, so cron replica
 *      mutual exclusion and the groom pay-week guard silently stop excluding.
 *
 * THE POSITIVE CONTROL (this is load-bearing — read before editing)
 *   A baseline that only ever observes correct behaviour cannot prove it would
 *   notice the regression; with no wrapper installed, `tx` raw statements are
 *   naturally in-transaction and case 1 passes for free. So the second case
 *   PLANTS the exact hazard — the deleted middleware's `.apply(prisma, args)`
 *   re-binding — and asserts both probes swing to the failure signature, then
 *   restores the client in `finally`. Without that, a future refactor could
 *   weaken the probes and leave this file green and useless.
 *   (Sentinel-positive shape, OPTIMAL_FIX_DISCIPLINE §2.)
 */

import { describe, it, expect, afterAll } from '@jest/globals';

import prisma from '../../packages/database/prismaClient.mjs';

/**
 * Run both probes inside ONE interactive transaction.
 *
 * @returns {Promise<{ firstTxid: string, secondTxid: string, advisoryLocksHeld: number }>}
 */
async function probeTransactionBinding() {
  // A key in the space cronLock uses, randomised so a real cron advisory lock
  // can never collide with — or vacuously satisfy — the assertion.
  const lockKey = BigInt(Math.floor(Math.random() * 1_000_000_000)) + 8_000_000_000n;

  return prisma.$transaction(async tx => {
    const first = await tx.$queryRaw`SELECT txid_current() AS id`;
    const second = await tx.$queryRaw`SELECT txid_current() AS id`;

    // Production shape: groomEngagementService.acquirePayWeekLockTx.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

    // Still INSIDE the transaction that took the lock. Held on this
    // transaction's connection, it is visible against this backend; taken on
    // the root client it was already released before this statement ran.
    const held = await tx.$queryRaw`
      SELECT count(*)::int AS n
      FROM pg_locks
      WHERE locktype = 'advisory' AND pid = pg_backend_pid()
    `;

    return {
      firstTxid: String(first[0].id),
      secondTxid: String(second[0].id),
      advisoryLocksHeld: held[0].n,
    };
  });
}

describe('raw statements stay inside their interactive transaction', () => {
  afterAll(async () => {
    // No rows are created: the probes read txid_current() and take a
    // transaction-scoped advisory lock PostgreSQL releases at COMMIT. Nothing
    // to clean up, so there is no cleanup tracker here by design.
    await prisma.$disconnect();
  });

  it('baseline — tx raw statements share the transaction that issued them', async () => {
    const { firstTxid, secondTxid, advisoryLocksHeld } = await probeTransactionBinding();

    expect(secondTxid).toBe(firstTxid);
    expect(advisoryLocksHeld).toBeGreaterThanOrEqual(1);
  });

  it('positive control — a re-binding wrapper is detected by both probes', async () => {
    const originalQueryRaw = prisma.$queryRaw;
    const originalExecuteRaw = prisma.$executeRaw;

    // Exactly the deleted middleware's defect: forward to the ROOT client
    // instead of the caller, so `tx` never reaches its own connection.
    prisma.$queryRaw = function reboundQueryRaw(...args) {
      return originalQueryRaw.apply(prisma, args);
    };
    prisma.$executeRaw = function reboundExecuteRaw(...args) {
      return originalExecuteRaw.apply(prisma, args);
    };

    try {
      const { firstTxid, secondTxid, advisoryLocksHeld } = await probeTransactionBinding();

      // Each statement became its own implicit transaction.
      expect(secondTxid).not.toBe(firstTxid);
      // The advisory lock was taken and released on the root connection.
      expect(advisoryLocksHeld).toBe(0);
    } finally {
      // Restore unconditionally — this is the shared singleton, and leaving it
      // patched would corrupt every later test in this process.
      prisma.$queryRaw = originalQueryRaw;
      prisma.$executeRaw = originalExecuteRaw;
    }
  });

  it('leaves the shared client unpatched after the positive control', async () => {
    const { firstTxid, secondTxid, advisoryLocksHeld } = await probeTransactionBinding();

    expect(secondTxid).toBe(firstTxid);
    expect(advisoryLocksHeld).toBeGreaterThanOrEqual(1);
  });
});
