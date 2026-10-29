/**
 * Row-lock barrier for real-DB race tests (Equoria-8sag0 bundle).
 *
 * Forces an exact interleaving of concurrent requests WITHOUT mocks, sleeps or
 * production seams: the test itself holds a real PostgreSQL row lock on a
 * SECOND Prisma client, fires requests that queue behind it, observes them
 * really blocked (pg_blocking_pids, not a timer), then releases. Every query
 * the requests run is the real production query, only DELAYED by a lock the
 * database arbitrates. Same mechanism as inventorySettingsRace /
 * tackReturnOnHorseSaleRace, extracted so new race tests do not copy it.
 *
 * The barrier client is separate so the holder never competes with the app
 * singleton's three-connection test pool for the connections the blocked
 * requests hold (equoria-lock-barrier-tests-three-traps, trap 1). Waiters are
 * counted only when transitively blocked BY THE HOLDER's pid (trap 3), on a
 * fresh statement outside any transaction (trap 2).
 */

import { PrismaClient } from '../../../packages/database/prismaClient.mjs';
import { buildDatabaseUrl } from '../../../packages/database/dbPoolConfig.mjs';

/** A dedicated client for barrier transactions. Disconnect it in afterAll. */
export function createBarrierClient() {
  return new PrismaClient({
    datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
    log: [],
    errorFormat: 'minimal',
  });
}

/**
 * Opens a transaction on `client` that runs `lock(tx)` (which must take the
 * row locks, e.g. `SELECT ... FOR UPDATE`) and holds them until `release()`.
 * A barrier failure is recorded, never swallowed: `release()` rethrows it.
 * @param {object} client - from createBarrierClient()
 * @param {(tx: object) => Promise<unknown>} lock
 * @returns {Promise<{ pid: number, release: () => Promise<void> }>}
 */
export async function openRowLockBarrier(client, lock) {
  let release;
  let ready;
  const released = new Promise(r => {
    release = r;
  });
  const armed = new Promise(r => {
    ready = r;
  });

  let pid;
  let barrierFailure = null;
  const held = client
    .$transaction(
      async tx => {
        const rows = await tx.$queryRaw`SELECT pg_backend_pid()::int AS pid`;
        pid = Number(rows[0].pid);
        await lock(tx);
        ready();
        await released;
      },
      { maxWait: 20000, timeout: 120000 },
    )
    .catch(err => {
      barrierFailure = err;
    });

  await Promise.race([
    armed,
    held.then(() => {
      throw barrierFailure ?? new Error('barrier transaction ended before it was armed');
    }),
  ]);

  return {
    pid,
    async release() {
      release();
      await held;
      if (barrierFailure) {
        throw barrierFailure;
      }
    },
  };
}

/**
 * Resolves once `count` sessions are transitively blocked by `barrierPid`.
 * A real lock-state observation; throws on timeout.
 */
export async function waitForBlockedSessions(client, barrierPid, count, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rows = await client.$queryRaw`
      WITH RECURSIVE chain AS (
        SELECT pid FROM pg_stat_activity WHERE pid = ${barrierPid}
        UNION
        SELECT a.pid
        FROM pg_stat_activity a
        JOIN chain c ON c.pid = ANY (pg_blocking_pids(a.pid))
      )
      SELECT (count(*) - 1)::int AS blocked FROM chain`;
    const seen = Number(rows[0].blocked);
    if (seen >= count) {
      return seen;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for ${count} session(s) blocked by pid ${barrierPid}; saw ${seen}`,
      );
    }
    await new Promise(r => setTimeout(r, 20));
  }
}

/**
 * The pids of the sessions DIRECTLY blocked by `barrierPid`, ascending. For a
 * test that must act on a queued session itself, e.g. `pg_cancel_backend` to
 * fail a transaction at the exact statement it is queued on (Equoria-sgkjp).
 * @returns {Promise<number[]>}
 */
export async function blockedSessionPids(client, barrierPid) {
  const rows = await client.$queryRaw`
    SELECT pid::int AS pid FROM pg_stat_activity
    WHERE ${barrierPid}::int = ANY (pg_blocking_pids(pid))
    ORDER BY pid`;
  return rows.map(row => Number(row.pid));
}

/** `lock` for a barrier: the horse row FOR UPDATE, or FOR SHARE when mode is 'SHARE'. */
export const horseRowLock =
  (horseId, mode = 'UPDATE') =>
  tx =>
    mode === 'SHARE'
      ? tx.$queryRaw`SELECT "id" FROM "horses" WHERE "id" = ${horseId} FOR SHARE`
      : tx.$queryRaw`SELECT "id" FROM "horses" WHERE "id" = ${horseId} FOR UPDATE`;

/**
 * openRowLockBarrier plus `waitForQueued(n)` bound to the barrier's own pid
 * (Equoria-9a5ny / j8s5c tests).
 * @returns {Promise<{ pid: number, release: () => Promise<void>, waitForQueued: (n: number, timeoutMs?: number) => Promise<number> }>}
 */
export async function holdLock(client, lock) {
  const barrier = await openRowLockBarrier(client, lock);
  return {
    pid: barrier.pid,
    release: () => barrier.release(),
    waitForQueued: (count, timeoutMs) =>
      waitForBlockedSessions(client, barrier.pid, count, timeoutMs),
  };
}

/**
 * Start every sender while `lock` is held, wait until all of them are queued
 * behind it, release, and settle them all (in sender order).
 */
export async function raceBehindLock(client, lock, senders) {
  const barrier = await holdLock(client, lock);
  // A supertest request is thenable, not a Promise; Promise.resolve starts it.
  const inFlight = senders.map(send => Promise.resolve(send()));
  try {
    await barrier.waitForQueued(senders.length);
  } finally {
    await barrier.release();
  }
  return Promise.all(inFlight);
}
