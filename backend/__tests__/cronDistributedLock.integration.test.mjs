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
 * To prove the production lock actually fires, the race test exercises it
 * across two distinct Postgres sessions — the exact shape of the
 * multi-replica production race. We DECOUPLE "is our lock logic correct?"
 * from "does Prisma reliably hold an idle interactive transaction under
 * load?" — conflating the two is what made the prior version flaky:
 *
 *   - Session A (the incumbent holder) takes the lock via a DEDICATED raw
 *     `pg` client using SESSION-level pg_try_advisory_lock(key). A session
 *     lock is deterministic: it is held until explicit unlock or disconnect,
 *     with NO interactive-transaction / autocommit surface that can silently
 *     release it mid-test. That silent release was the fefh2.44 failure
 *     mode — under full 8-shard load a Prisma `$transaction` degraded to
 *     autocommit-per-statement, releasing the xact-scoped lock BETWEEN
 *     statements (proven: txid_current() differed across two statements of
 *     one transaction, e.g. A txid 1138146/1138147), so the "held" lock was
 *     already gone when B attempted and B legitimately acquired → count=2
 *     with a CORRECT production lock. Re-exporting the same @prisma/client
 *     copy (the original fefh2.44 fix) did NOT close this, because the
 *     degradation is in Prisma's idle-transaction durability under pool
 *     pressure, not in client-copy identity.
 *   - Session B (the second replica) runs the REAL production
 *     withAdvisoryLock, whose pg_try_advisory_xact_lock(key) shares ONE
 *     advisory lock space with A's session lock. With A holding, B MUST see
 *     the lock and return acquired:false; its handler never runs.
 *
 * A working production lock → B skips, the side-effect counter stays at 1.
 * A broken production lock (wrong key derivation, no try-lock, etc.) → B
 * acquires, its handler runs, the counter hits 2 and the test fails loudly.
 * That is the sentinel-positive guarantee. Because B drives the REAL
 * production path AND derives its key the same way A's raw holder does
 * (jobNameToLockKey), this also cross-checks that the production key
 * derivation matches.
 *
 * (Whether PRODUCTION withAdvisoryLock should itself hold the lock on a
 * dedicated connection rather than a long-lived Prisma interactive
 * transaction — to remove the same idle-transaction-durability risk from
 * the real cron path under Railway replicas>1 — is tracked separately under
 * Equoria-mquci; this test no longer depends on it.)
 *
 * Real DB. No mocks. Per CLAUDE.md §3, `.env.test` already points at the
 * canonical Equoria DB; cleanup is scoped by a unique TAG.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import cronJobService from '../services/cronJobs.mjs';
import { snapshotCronSingleton, restoreCronSingleton } from './helpers/cronSingletonIsolation.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { withAdvisoryLock, jobNameToLockKey } from '../utils/cronLock.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. Replaces the prior
// `cronRunLog.deleteMany(...)` whose error was logged-and-swallowed in a
// console.warn catch arm — a failed scoped delete would leak TAG-prefixed
// cronRunLog rows into the canonical DB (CLAUDE.md §2) and stay invisible.
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

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
  });

  beforeEach(() => {
    cronJobService.heartbeats.clear();
  });

  afterAll(async () => {
    // Advisory locks (session + xact) auto-release on disconnect / commit —
    // the race test's dedicated raw `pg` holder is closed in its own finally,
    // so no manual unlock is needed here.
    // Equoria-1ohys: scoped, fail-loud cleanup of this suite's TAG-prefixed
    // cronRunLog rows. A failed delete now fails the suite instead of being
    // logged-and-swallowed.
    const cleanup = createCleanupTracker();
    cleanup.add(() => prisma.cronRunLog.deleteMany({ where: { jobName: { startsWith: TAG } } }), 'cronRunLog');
    // Restore the shared cron singleton BEFORE asserting cleanup success, so a
    // cleanup failure cannot strand the singleton restore.
    restoreCronSingleton(cronSnapshot);
    await cleanup.run();
  });

  it('skips the production handler when another session already holds the lock (real cross-session race)', async () => {
    // DETERMINISTIC CONTENTION (no timing window), with the holder decoupled
    // from Prisma's interactive-transaction durability (see the file header).
    // Session A is a DEDICATED raw `pg` client holding a SESSION-level
    // advisory lock on the job key — held unconditionally until we close the
    // connection, with no autocommit-degradation surface. Session B runs the
    // REAL production withAdvisoryLock, whose pg_try_advisory_xact_lock shares
    // one advisory lock space with A's session lock, so on a working lock B
    // MUST return acquired:false and never run its handler. A broken lock
    // (wrong key, no try-lock) lets B acquire → sideEffectCount hits 2 and the
    // test fails loudly — the sentinel-positive guarantee.
    let sideEffectCount = 0;
    const key = jobNameToLockKey(JOB_RACE);

    // Dedicated holder connection (the "first replica"). Its own Postgres
    // session means B genuinely contends cross-session, the multi-replica
    // production shape.
    const holder = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await holder.connect();
    try {
      const pidRow = await holder.query('SELECT pg_backend_pid() AS pid');
      const holderPid = pidRow.rows?.[0]?.pid ?? null;

      // A acquires the session-level lock. Passed as a decimal string because
      // jobNameToLockKey can be a negative 64-bit BigInt; ::bigint parses it.
      const acq = await holder.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [key.toString()]);
      const aAcquired = acq.rows?.[0]?.locked === true;
      // Holder acquiring is a test precondition, not the assertion under test;
      // if it ever fails, surface why before the meaningful assertions run.
      expect(`holderPid=${holderPid} aAcquired=${aAcquired}`).toBe(`holderPid=${holderPid} aAcquired=true`);
      sideEffectCount++; // session A's "handler" ran exactly once

      // Session B (second replica) runs the REAL production path while A holds
      // the lock cross-session.
      const b = await withAdvisoryLock(JOB_RACE, async () => {
        sideEffectCount++;
        return { totalProcessed: 1 };
      });

      // Exactly one handler ran. On failure, surface holder pid + both
      // acquire flags: a cross-session double-acquire is impossible on a
      // working lock, so these ARE the diagnosis.
      const evidence = `holderPid=${holderPid} aAcquired=${aAcquired} bAcquired=${b.acquired}`;
      expect(`count=${sideEffectCount} ${evidence}`).toBe(`count=1 ${evidence}`);
      expect(b.acquired).toBe(false);
      expect(b.result).toBeNull();
    } finally {
      // Closing the connection releases the session advisory lock (no manual
      // pg_advisory_unlock needed). Bare end() — no silent catch arm.
      await holder.end();
    }
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
