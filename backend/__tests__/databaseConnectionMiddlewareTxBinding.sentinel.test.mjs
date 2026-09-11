/**
 * Equoria-6p398.8 sentinel — `databaseConnectionMiddleware` must not re-bind
 * `$queryRaw` / `$executeRaw` away from the interactive-transaction client.
 *
 * Tracker: Equoria-6p398.8, under epic Equoria-6p398 (2026-09-05 Codex
 * security audit remediation). Repair landed in d5dcb7331 with NO sentinel;
 * this file is that missing sentinel.
 *
 * THE DEFECT THIS FILE GUARDS
 *   `databaseConnectionMiddleware` (backend/middleware/resourceManagement.mjs,
 *   mounted globally at app.mjs:308) counts queries by monkey-patching
 *   `$queryRaw` / `$executeRaw` on the SHARED Prisma client for the life of a
 *   request. An interactive transaction client (`tx`) reaches those two
 *   methods through the very properties the middleware replaced, so the
 *   wrapper runs with `this === tx`.
 *
 *   The original wrapper forwarded with `.apply(prisma, args)` — hard-binding
 *   every call back to the ROOT client. Each raw statement issued inside a
 *   `prisma.$transaction` was then sent down the root client instead: its own
 *   connection, its own implicit transaction, committed on the spot and immune
 *   to the surrounding ROLLBACK. The repair forwards `this` instead.
 *
 * WHY THE EXISTING TESTS DO NOT CATCH IT
 *   The three cases in resourceManagement.test.mjs ('tracks database queries',
 *   'warns about high query counts', 'restores original methods') only ever
 *   call `prisma.$queryRaw` DIRECTLY — never `tx.$queryRaw` inside a
 *   transaction. Re-binding to the root client is invisible to all three: they
 *   stay green against the broken form. Nothing else in the tree asserts this;
 *   the other `txid_current()` matches in backend/ are prose in comments.
 *
 * HOW THE ASSERTIONS DISCRIMINATE (no mocks, no sleeps, real PostgreSQL)
 *   On the root client each raw statement is its OWN implicit transaction.
 *   That is the signal:
 *
 *   1. `$queryRaw` — two `SELECT txid_current()` statements in ONE
 *      `prisma.$transaction` report the SAME id when `this` is forwarded and
 *      DIFFERENT ids when it is not. This is the exact measurement from the
 *      audit (350655/350657 broken, 350670/350670 repaired).
 *
 *   2. `$executeRaw` — `pg_advisory_xact_lock` is held only for the life of
 *      the transaction that took it, on that transaction's connection. Taken
 *      via a re-bound `$executeRaw` it lands on the root client's one-statement
 *      implicit transaction and is released immediately, so `pg_locks` shows
 *      nothing for this transaction's backend. This is the shape
 *      groomEngagementService.acquirePayWeekLockTx and cronLock.withAdvisoryLock
 *      use in production, and it is the worst failure mode of the defect: the
 *      lock call RETURNS SUCCESSFULLY while holding nothing, so cron mutual
 *      exclusion and the groom pay-week guard silently stop excluding anything.
 *
 * THE VACUOUS-PASS GUARD (this is load-bearing — read before editing)
 *   Both assertions above pass trivially if the middleware is simply ABSENT:
 *   with no wrapper at all, `tx` raw statements are naturally in-transaction.
 *   A sentinel that can pass by the guard disappearing is not a guard. So each
 *   case also asserts the `X-DB-Queries` header proves the wrapper actually
 *   intercepted the in-transaction raw statements. If the middleware stops
 *   being mounted, stops counting, or stops seeing `tx` traffic, these fail.
 *
 * WHY `function` AND NOT AN ARROW
 *   Arrow functions cannot carry a caller's `this`. Simplifying either wrapper
 *   back to an arrow re-breaks the binding, and both cases below fail.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import prisma from '../../packages/database/prismaClient.mjs';
import { databaseConnectionMiddleware } from '../middleware/resourceManagement.mjs';

/**
 * Build a minimal app that mounts ONLY the middleware under test, then runs the
 * supplied probe inside a real interactive transaction. Mounting the real
 * factory is the HTTP middleware path the tracker asks for, and isolating it
 * keeps the middleware the only variable in the measurement.
 *
 * @param {(tx: import('@prisma/client').Prisma.TransactionClient) => Promise<unknown>} probe
 * @returns {import('express').Express}
 */
function buildProbeApp(probe) {
  const app = express();
  app.use(databaseConnectionMiddleware(prisma));
  app.get('/probe', async (req, res) => {
    try {
      const result = await prisma.$transaction(async tx => probe(tx));
      res.json({ ok: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  return app;
}

describe('Equoria-6p398.8 — databaseConnectionMiddleware transaction binding', () => {
  afterAll(async () => {
    // This suite creates no rows: the two probes read txid_current() and take a
    // transaction-scoped advisory lock that PostgreSQL releases at COMMIT.
    // Nothing to clean up, so there is no tracker here by design.
    await prisma.$disconnect();
  });

  it('keeps two tx.$queryRaw statements inside ONE transaction (same txid)', async () => {
    const app = buildProbeApp(async tx => {
      const first = await tx.$queryRaw`SELECT txid_current() AS id`;
      const second = await tx.$queryRaw`SELECT txid_current() AS id`;
      return {
        first: String(first[0].id),
        second: String(second[0].id),
      };
    });

    const response = await request(app).get('/probe').expect(200);
    expect(response.body.ok).toBe(true);

    const { first, second } = response.body.result;

    // The regression signature. Re-bound to the root client these are two
    // separate implicit transactions and the ids differ.
    expect(second).toBe(first);

    // Vacuous-pass guard: prove the wrapper actually saw the in-transaction
    // raw statements, so this case cannot pass by the middleware vanishing.
    expect(Number(response.headers['x-db-queries'])).toBeGreaterThanOrEqual(2);
  });

  it('keeps a tx.$executeRaw advisory xact lock held by THIS transaction', async () => {
    // A key in the same space cronLock uses, randomised so a real cron advisory
    // lock can never collide with (or satisfy) this assertion.
    const lockKey = BigInt(Math.floor(Math.random() * 1_000_000_000)) + 8_000_000_000n;

    const app = buildProbeApp(async tx => {
      // Production shape: groomEngagementService.acquirePayWeekLockTx.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

      // Still INSIDE the transaction that took the lock. If the lock landed on
      // this transaction's connection it is still held and visible against this
      // backend; if $executeRaw was re-bound, it was taken and released on the
      // root client's connection and nothing is held here.
      const held = await tx.$queryRaw`
        SELECT count(*)::int AS n
        FROM pg_locks
        WHERE locktype = 'advisory' AND pid = pg_backend_pid()
      `;
      return { held: held[0].n };
    });

    const response = await request(app).get('/probe').expect(200);
    expect(response.body.ok).toBe(true);

    // Re-bound, the lock is already gone by the time this is read: n === 0.
    expect(response.body.result.held).toBeGreaterThanOrEqual(1);

    // Vacuous-pass guard, as above.
    expect(Number(response.headers['x-db-queries'])).toBeGreaterThanOrEqual(2);
  });
});
