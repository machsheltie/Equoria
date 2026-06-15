/**
 * Equoria-iot0h — Distributed-lock cron sentinel integration tests.
 *
 * Validates that the multi-replica race condition documented in Equoria-iot0h
 * is actually closed by a pg_try_advisory_xact_lock-based gate. Today (without
 * the fix), an in-process Map heartbeat lets every replica re-run the same
 * dailyHorseAging / decayHoofConditions / executeClosedShows / auditLogRetention
 * / processHorseBirthdays handler simultaneously on Railway, producing
 * double-aging, double-payouts, double-decay, double-deletion.
 *
 * SENTINEL-POSITIVE TEST DESIGN
 * -----------------------------
 * To prove the lock actually fires, we MUST exercise it across two distinct
 * Postgres backend connections (= two distinct Postgres sessions, which is
 * what the production race-condition is). A SINGLE PrismaClient instance
 * pools connections and may serialize two `$transaction` calls onto the
 * same backend pid — in that scenario the first transaction commits and
 * releases the lock BEFORE the second begins, so both succeed even though
 * the lock implementation is correct.
 *
 * The test instantiates a SECOND PrismaClient (`prismaB`) so the two
 * concurrent `withAdvisoryLockOn(...)` calls genuinely run on TWO different
 * Postgres backends in parallel — the exact shape of the multi-replica
 * production race. With this setup, a working lock returns
 * `acquired: true` on the first session and `acquired: false` on the
 * second; a broken lock returns true on both and the side-effect counter
 * increments to 2.
 *
 * Real DB. No mocks. Per CLAUDE.md §3, `.env.test` already points at the
 * canonical Equoria DB; cleanup is scoped by a unique TAG.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import cronJobService from '../services/cronJobs.mjs';
import { snapshotCronSingleton, restoreCronSingleton } from './helpers/cronSingletonIsolation.mjs';
import prisma, { PrismaClient } from '../../packages/database/prismaClient.mjs';
import { withAdvisoryLock, jobNameToLockKey } from '../utils/cronLock.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. Replaces the prior
// `cronRunLog.deleteMany(...)` whose error was logged-and-swallowed in a
// console.warn catch arm — a failed scoped delete would leak TAG-prefixed
// cronRunLog rows into the canonical DB (CLAUDE.md §2) and stay invisible.
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

// Second PrismaClient instance to simulate a SECOND Railway replica — its
// own backend connection means the two parallel withAdvisoryLock calls
// land on different Postgres sessions, exercising the real cross-session
// lock semantics. (A single Prisma client may pool both calls onto the
// same backend connection and serialize them, which would let both
// `$transaction` blocks succeed even though the lock implementation is
// correct.)
//
// CRITICAL (Equoria-fefh2.44, 2026-06-12): PrismaClient MUST come from
// prismaClient.mjs's re-export — the SAME @prisma/client copy the singleton
// uses. The previous absolute-path dynamic import loaded a SECOND copy of
// the generated client sharing one native query engine; in ~50% of full
// shard-7 processes the singleton's interactive transactions then silently
// degraded to AUTOCOMMIT-per-statement (proven: txid_current() differed
// across two statements of one $transaction — A txid 1044126/1044127 —
// while pg_locks showed the "held" xact advisory lock already gone at B's
// attempt).
//
// The eslint no-restricted-imports ban on deep generated-client paths
// (Equoria-4qjo) does NOT guard this regression in test files: that rule is
// turned OFF in the test-files override block, and no-restricted-imports
// never flags DYNAMIC import() anyway. The actual durable guard is the
// source-scan sentinel noDeepPrismaClientImportInTests.sentinel.test.mjs,
// which fires on both static and dynamic deep imports across the test tree.
const prismaB = new PrismaClient();

/**
 * Variant of withAdvisoryLock that takes an explicit PrismaClient so the
 * test can drive the lock from a SECOND connection. The production code
 * uses the module-level singleton (one client per replica); the test needs
 * two clients in one process to simulate two replicas.
 */
async function withAdvisoryLockOn(prismaClient, jobName, handler) {
  const key = jobNameToLockKey(jobName);
  // pid + rawLocked captured for the race test's failure diagnostics
  // (Equoria-fefh2.44): a double-acquire is impossible across two healthy
  // sessions, so WHEN it happens the evidence (same backend pid? raw value
  // shape?) is the whole diagnosis. Cheap one extra SELECT per call.
  const outcome = {
    acquired: false,
    result: null,
    pid: null,
    rawLocked: null,
    keyEcho: null,
    holdersBefore: null,
  };
  await prismaClient.$transaction(
    async tx => {
      // Diagnostics (Equoria-fefh2.44): echo the key as Postgres received it
      // (rules out cross-client BigInt serialization divergence) and list
      // advisory-lock holder pids BEFORE try-locking (rules out — or proves —
      // that the supposed holder's lock was already gone).
      const diagRows = await tx.$queryRaw`
        SELECT pg_backend_pid() AS pid,
               txid_current()::text AS txid,
               (${key}::bigint)::text AS key_echo,
               (SELECT array_agg(pid) FROM pg_locks WHERE locktype = 'advisory') AS holders`;
      // pid + txid captured IN THE SAME STATEMENT as the lock. A REAL
      // interactive transaction shares one txid across its statements; if
      // lockTxid differs from the diag txid, these statements are running
      // AUTOCOMMIT (each its own transaction) and the xact lock dies at
      // statement end — the broken-binding mechanism behind fefh2.44.
      const rows =
        await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(${key}::bigint) AS locked, pg_backend_pid() AS lock_pid, txid_current()::text AS lock_txid`;
      const acquired = rows?.[0]?.locked === true;
      outcome.pid = diagRows?.[0]?.pid ?? null;
      outcome.txid = diagRows?.[0]?.txid ?? null;
      outcome.lockPid = rows?.[0]?.lock_pid ?? null;
      outcome.lockTxid = rows?.[0]?.lock_txid ?? null;
      outcome.keyEcho = diagRows?.[0]?.key_echo ?? null;
      outcome.holdersBefore = diagRows?.[0]?.holders ?? null;
      outcome.rawLocked = rows?.[0]?.locked;
      if (!acquired) {
        return;
      }
      const result = await handler();
      outcome.acquired = true;
      outcome.result = result;
    },
    { timeout: 60_000, maxWait: 5_000 },
  );
  return outcome;
}

const TAG = `iot0h-${randomBytes(4).toString('hex')}`;
const JOB_RACE = `${TAG}-race`;
const JOB_SOLO = `${TAG}-solo`;
const JOB_HEALTH = `${TAG}-health`;

describe('Equoria-iot0h: pg_try_advisory_lock prevents double-execution', () => {
  // Equoria-iwpcj: snapshot the shared CronJobService singleton BEFORE seeding
  // the test jobs, then restore it after the suite. This replaces the prior
  // ad-hoc per-job .delete() calls — restore removes the seeded jobs AND
  // restores .heartbeats/.staleAlertState (the beforeEach heartbeats.clear()
  // previously leaked, wiping sibling heartbeat state without restoring it).
  let cronSnapshot;

  beforeAll(async () => {
    cronSnapshot = snapshotCronSingleton();
    // Seed the in-memory jobs map so getHealth/recordHeartbeat surfaces these.
    cronJobService.jobs.set(JOB_RACE, { running: false, scheduled: false });
    cronJobService.jobs.set(JOB_SOLO, { running: false, scheduled: false });
    cronJobService.jobs.set(JOB_HEALTH, { running: false, scheduled: false });
    // Warm prismaB's connection BEFORE the race test. Its lazy first-connect
    // (TCP + auth + query-engine startup) otherwise happens INSIDE session
    // A's lock-hold window; under full-suite load that can outlast Prisma's
    // interactive-transaction timeout, killing A's tx, releasing the lock,
    // and letting B legitimately acquire — count=2 with a CORRECT lock
    // (observed once in postwave shard 7). Paying the connect cost here
    // keeps the hold window free of load-dependent latency.
    await prismaB.$queryRaw`SELECT 1`;
  });

  beforeEach(() => {
    cronJobService.heartbeats.clear();
  });

  afterAll(async () => {
    // TX-scoped advisory locks auto-release on commit/rollback — no manual
    // unlock needed.
    // Equoria-1ohys: scoped, fail-loud cleanup of this suite's TAG-prefixed
    // cronRunLog rows. A failed delete now fails the suite instead of being
    // logged-and-swallowed.
    const cleanup = createCleanupTracker();
    cleanup.add(() => prisma.cronRunLog.deleteMany({ where: { jobName: { startsWith: TAG } } }), 'cronRunLog');
    // Restore the shared cron singleton and disconnect the second client BEFORE
    // asserting cleanup success, so a cleanup failure cannot strand the
    // singleton restore or leak the prismaB connection. ($disconnect is
    // connection teardown, not a fixture delete — left as-is intentionally.)
    restoreCronSingleton(cronSnapshot);
    await prismaB.$disconnect().catch(() => {});
    await cleanup.run();
  });

  it('runs the handler exactly once when two replicas fire in parallel (real cross-session race)', async () => {
    // DETERMINISTIC CONTENTION (no timing window). The previous version
    // raced both sessions via Promise.all with a 250ms handler hold — under
    // full-suite --runInBand load, prismaB's LAZY first-connect (TCP + auth
    // + engine startup inside its first $transaction) can exceed 250ms, so
    // session A commits and releases the lock BEFORE session B ever attempts
    // it. Both then acquire, sideEffectCount hits 2, and the test fails even
    // though the lock implementation is correct. Explicit coordination
    // removes the window entirely: A provably HOLDS the lock (signalled from
    // inside its open transaction) for the full duration of B's attempt, so
    // B's pg_try_advisory_xact_lock MUST return false on a working lock —
    // and a broken lock still fails loudly (both acquire, count = 2).
    let sideEffectCount = 0;

    let signalAHoldsLock;
    const aHoldsLock = new Promise(resolve => {
      signalAHoldsLock = resolve;
    });
    let releaseA;
    const aMayCommit = new Promise(resolve => {
      releaseA = resolve;
    });

    // CRITICAL: TWO PrismaClient instances so the two transactions go to
    // TWO different Postgres backends (= two sessions, the multi-replica
    // production shape). A single client could pool both onto one backend
    // and serialize them, defeating the cross-session contention this test
    // exists to prove.
    const aPromise = withAdvisoryLockOn(prisma, JOB_RACE, async () => {
      sideEffectCount++;
      signalAHoldsLock(); // lock is now held on session A's open tx
      await aMayCommit; // hold it until B has finished its attempt
      return { totalProcessed: 1 };
    });

    await aHoldsLock;
    // Session B (second replica) attempts WHILE A's transaction holds the
    // lock — the exact production race, made deterministic. releaseA() runs
    // in finally so a B-side failure cannot leave A's transaction hanging
    // until its 60s timeout.
    let b;
    try {
      b = await withAdvisoryLockOn(prismaB, JOB_RACE, async () => {
        sideEffectCount++;
        return { totalProcessed: 1 };
      });
    } finally {
      releaseA();
    }
    const a = await aPromise;

    // Exactly one instance ran the handler — the second saw the lock held
    // on another session and returned the skipped sentinel. On failure,
    // surface the full session evidence (Equoria-fefh2.44 diagnostics): a
    // double-acquire across two healthy sessions is impossible, so the pids
    // and raw lock values ARE the diagnosis (same pid => same-session
    // re-acquire; different pids + both true => A's lock not actually held).
    const evidence = `A{acq:${a.acquired},pid:${a.pid}/${a.lockPid},txid:${a.txid}/${a.lockTxid},key:${a.keyEcho},holders:${JSON.stringify(a.holdersBefore)}} B{acq:${b.acquired},pid:${b.pid}/${b.lockPid},txid:${b.txid}/${b.lockTxid},holders:${JSON.stringify(b.holdersBefore)}}`;
    expect(`count=${sideEffectCount} ${evidence}`).toBe(`count=1 ${evidence}`);
    expect(a.acquired).toBe(true);
    expect(a.result).toEqual({ totalProcessed: 1 });
    expect(b.acquired).toBe(false);
    expect(b.result).toBeNull();
  });

  it('allows a second run AFTER the first has released the lock (not permanently locked)', async () => {
    let count = 0;
    const handler = async () => {
      count++;
      return { totalProcessed: 1 };
    };

    // Serial — second call must acquire because the first released.
    const a = await withAdvisoryLock(JOB_SOLO, handler);
    const b = await withAdvisoryLock(JOB_SOLO, handler);

    expect(count).toBe(2);
    expect(a.acquired).toBe(true);
    expect(b.acquired).toBe(true);
  });

  it('releases the lock even if the handler throws (no permanent lock leak)', async () => {
    const handler = async () => {
      throw new Error('iot0h-synthetic-failure');
    };

    await expect(withAdvisoryLock(JOB_SOLO, handler)).rejects.toThrow('iot0h-synthetic-failure');

    // Lock must be released after the throw — a fresh acquire must succeed.
    let postCount = 0;
    const recoveryHandler = async () => {
      postCount++;
      return { ok: true };
    };
    const recovery = await withAdvisoryLock(JOB_SOLO, recoveryHandler);
    expect(recovery.acquired).toBe(true);
    expect(postCount).toBe(1);
  });

  it('runWithHeartbeat (production singleton client) commits exactly one success + persists the run row', async () => {
    // Real-world cron schedule: the production code path uses the
    // singleton client. With a single client, two parallel calls serialize
    // onto one backend connection — both will succeed at the handler level
    // because the first commits + releases before the second begins. This
    // is the CORRECT production behavior for a SINGLE replica: each tick
    // runs once. The cross-replica protection is verified by the first
    // test above (two-client race). Here we verify that the heartbeat +
    // CronRunLog persistence path actually fires under applyLock=true.
    let sideEffectCount = 0;
    const handler = async () => {
      sideEffectCount++;
      return { totalProcessed: 1 };
    };

    await cronJobService.runWithHeartbeat(JOB_HEALTH, handler, { applyLock: true });
    expect(sideEffectCount).toBe(1);

    // CronRunLog row should be persisted with status 'success'.
    const rows = await prisma.cronRunLog.findMany({
      where: { jobName: JOB_HEALTH },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].status).toBe('success');
  });

  it('getHealth surfaces lockHeld:false after the run completes (AC #3)', async () => {
    await cronJobService.runWithHeartbeat(JOB_HEALTH, async () => ({ totalProcessed: 1 }), {
      applyLock: true,
    });

    const health = cronJobService.getHealth();
    const block = health.jobs[JOB_HEALTH];
    expect(block).toBeDefined();
    // After completion, lock is released → lockHeld false.
    expect(block.lockHeld).toBe(false);
    // Last run did acquire the lock (vs being skipped-locked).
    expect(block.lastLockAcquired).toBe(true);
  });
});
