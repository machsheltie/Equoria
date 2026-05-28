/**
 * Equoria-iot0h — Postgres advisory-lock gate for cron jobs.
 *
 * PROBLEM (from Equoria-iot0h)
 * ---------------------------
 * `backend/services/cronJobs.mjs` schedules dailyHorseAging, decayHoofConditions,
 * executeClosedShows, auditLogRetention, processHorseBirthdays, etc. with
 * `node-cron`. node-cron schedules fire **per process** — every Railway replica
 * runs every schedule. On a single-replica deployment this is invisible. The
 * instant horizontal scaling enables `replicas > 1` (or two staging boxes share
 * the same Postgres), every nightly handler fires N times in parallel:
 *
 *   - dailyHorseAging:    every horse ages N times in a row → off-by-N years
 *   - executeClosedShows: every prize is paid N times → double-spend
 *   - decayHoofConditions: every horse's hoof-condition decays N rungs at once
 *   - auditLogRetention:   N parallel scoped-DELETEs of audit_logs rows
 *   - processHorseBirthdays: notifications and milestones fired N times
 *
 * In-process Map heartbeat (current code) does NOT prevent this — each
 * replica has its own Map.
 *
 * SOLUTION
 * --------
 * Wrap each cron handler in `pg_try_advisory_xact_lock(key)` inside a
 * Prisma transaction. The transaction-scoped advisory lock is bound to
 * the transaction's connection AND released automatically when the
 * transaction ends (COMMIT or ROLLBACK). Only ONE caller across the whole
 * DB cluster can hold a given key at a time. Other callers see
 * `pg_try_advisory_xact_lock` return `false` and early-exit (recorded as
 * `status: 'skipped-locked'` so /api/admin/cron/health surfaces the skip
 * rather than silently dropping it).
 *
 * WHY xact_lock RATHER THAN SESSION lock
 * --------------------------------------
 * Prisma's connection pool means two consecutive `$queryRaw` calls can
 * land on DIFFERENT pooled connections — i.e. different Postgres sessions.
 * Session-scoped `pg_try_advisory_lock` acquired on connection A is NOT
 * visible on connection B. The TX-scoped variant (`pg_try_advisory_xact_lock`)
 * binds the lock to the active transaction's connection, so any subsequent
 * query in that same transaction sees the lock and the lock is released
 * the moment the transaction commits (or rolls back on throw). No stale-
 * lock leakage possible.
 *
 * The cron handler is invoked INSIDE the transaction so its own DB writes
 * (heartbeat persist, etc.) reuse the same transactional connection. We
 * deliberately set a long transaction timeout (default Prisma is 5s, which
 * is much too short for dailyHorseAging) so the lock is held for the full
 * duration of the work.
 *
 * KEY DERIVATION
 * --------------
 * Postgres advisory-lock keys are bigints. We hash the canonical job name
 * (`dailyHorseAging`, `auditLogRetention`, …) with SHA-256 and take the
 * first 8 bytes as a signed bigint. Deterministic across replicas (same
 * name → same key) and collision-resistant for the O(10) job names in use.
 * The conversion to a signed 63-bit bigint stays within Postgres `bigint`
 * range (-2^63 .. 2^63-1) so no overflow can occur.
 *
 * FAIL-CLOSED CONTRACT (EDGE_CASE_FIX_DISCIPLINE §3)
 * --------------------------------------------------
 * If `pg_try_advisory_xact_lock` THROWS (DB down, connection lost), we
 * MUST NOT silently fall through and run the handler — that would defeat
 * the whole point and re-introduce the double-execution bug. Throwing the
 * error up means the caller (`runWithHeartbeat`) records the failure as a
 * status:'error' heartbeat. If it returns FALSE (lock held by another
 * replica), we return `{ acquired: false, result: null }`.
 */

import { createHash } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import logger from './logger.mjs';

// Long-running cron transaction budget. dailyHorseAging can touch every horse;
// auditLogRetention does a scoped DELETE that scales with corpus age. Set a
// generous ceiling so the lock isn't dropped mid-work. Prisma units: ms.
const DEFAULT_LOCK_TX_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
const DEFAULT_LOCK_TX_MAX_WAIT_MS = 5 * 1000; // 5 seconds to start the txn

/**
 * Derive a deterministic, signed-bigint advisory-lock key from a job name.
 *
 * SHA-256 the canonical jobName → first 8 bytes → signed 64-bit bigint.
 * Exported for the sentinel test (so the test can release a lock by key
 * if needed) AND for any future operational tooling.
 *
 * @param {string} jobName
 * @returns {bigint}
 */
export function jobNameToLockKey(jobName) {
  if (typeof jobName !== 'string' || jobName.length === 0) {
    throw new TypeError('jobNameToLockKey: jobName must be a non-empty string');
  }
  const hash = createHash('sha256').update(jobName, 'utf8').digest();
  const unsigned = hash.readBigUInt64BE(0);
  const TWO_POW_63 = 1n << 63n;
  const TWO_POW_64 = 1n << 64n;
  const signed = unsigned >= TWO_POW_63 ? unsigned - TWO_POW_64 : unsigned;
  return signed;
}

/**
 * Run `handler` under a Postgres transaction-scoped advisory lock keyed on
 * `jobName`. Behaviour:
 *
 * - Lock acquired (true)  → runs handler inside the txn, lock + txn commit
 *                            together → returns `{ acquired: true, result }`.
 * - Lock contended (false)→ commits an empty txn, returns
 *                            `{ acquired: false, result: null }`.
 * - Acquire THREW         → rethrows (caller treats as status:'error').
 * - Handler THREW         → txn rolls back, lock released, error rethrown.
 *
 * @template T
 * @param {string} jobName
 * @param {() => Promise<T>} handler
 * @param {Object} [opts]
 * @param {number} [opts.timeoutMs]  - transaction body timeout (default 60min)
 * @param {number} [opts.maxWaitMs]  - max wait to start the txn (default 5s)
 * @returns {Promise<{acquired: boolean, result: T|null}>}
 */
export async function withAdvisoryLock(jobName, handler, opts = {}) {
  const key = jobNameToLockKey(jobName);
  const timeout = opts.timeoutMs ?? DEFAULT_LOCK_TX_TIMEOUT_MS;
  const maxWait = opts.maxWaitMs ?? DEFAULT_LOCK_TX_MAX_WAIT_MS;

  let outcome = { acquired: false, result: null };
  // Lock-release / outcome contract:
  // - Lock acquired + handler returns → COMMIT releases lock; outcome.acquired=true
  // - Lock acquired + handler throws  → ROLLBACK releases lock; error propagates
  // - Lock contended                  → COMMIT (no held lock); outcome.acquired=false
  // - DB unreachable                  → throw propagates (fail-closed per
  //                                     EDGE_CASE_FIX_DISCIPLINE §3)
  // No try/catch here because $transaction's own rollback handles release.
  await prisma.$transaction(
    async tx => {
      // Acquire the TX-scoped lock on THIS transaction's connection.
      // pg_try_advisory_xact_lock returns true if acquired, false if
      // another transaction (on any replica) already holds it.
      const rows = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(${key}::bigint) AS locked`;
      const acquired = rows?.[0]?.locked === true;
      if (!acquired) {
        logger.info(
          `[cronLock.withAdvisoryLock] Lock NOT acquired for job '${jobName}' (key=${key.toString()}) — another replica is running; skipping.`,
        );
        outcome = { acquired: false, result: null };
        return; // commit empty txn → releases nothing (nothing held)
      }
      // Acquired — run handler inside the same txn so the lock is held
      // for the full duration. Lock auto-releases on COMMIT (returning
      // here) or ROLLBACK (throw propagates out of $transaction).
      const result = await handler();
      outcome = { acquired: true, result };
    },
    { timeout, maxWait },
  );
  return outcome;
}
