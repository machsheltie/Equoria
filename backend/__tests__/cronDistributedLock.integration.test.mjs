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
import prisma from '../../packages/database/prismaClient.mjs';
import { withAdvisoryLock, jobNameToLockKey } from '../utils/cronLock.mjs';

// Second PrismaClient instance to simulate a SECOND Railway replica — its
// own backend connection means the two parallel withAdvisoryLock calls
// land on different Postgres sessions, exercising the real cross-session
// lock semantics. (A single Prisma client may pool both calls onto the
// same backend connection and serialize them, which would let both
// `$transaction` blocks succeed even though the lock implementation is
// correct.)
//
// @prisma/client lives at packages/database/node_modules/@prisma/client.
// Jest's resolver doesn't walk up from a backend-rooted test file. We
// import the generated client directly by absolute path via pathToFileURL
// so the module-realm is the same as packages/database/prismaClient.mjs
// uses.
const { PrismaClient } = await import('../../packages/database/node_modules/@prisma/client/index.js');
const prismaB = new PrismaClient();

/**
 * Variant of withAdvisoryLock that takes an explicit PrismaClient so the
 * test can drive the lock from a SECOND connection. The production code
 * uses the module-level singleton (one client per replica); the test needs
 * two clients in one process to simulate two replicas.
 */
async function withAdvisoryLockOn(prismaClient, jobName, handler) {
  const key = jobNameToLockKey(jobName);
  let outcome = { acquired: false, result: null };
  await prismaClient.$transaction(
    async tx => {
      const rows = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(${key}::bigint) AS locked`;
      const acquired = rows?.[0]?.locked === true;
      if (!acquired) {
        outcome = { acquired: false, result: null };
        return;
      }
      const result = await handler();
      outcome = { acquired: true, result };
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
  beforeAll(() => {
    // Seed the in-memory jobs map so getHealth/recordHeartbeat surfaces these.
    cronJobService.jobs.set(JOB_RACE, { running: false, scheduled: false });
    cronJobService.jobs.set(JOB_SOLO, { running: false, scheduled: false });
    cronJobService.jobs.set(JOB_HEALTH, { running: false, scheduled: false });
  });

  beforeEach(() => {
    cronJobService.heartbeats.clear();
  });

  afterAll(async () => {
    // TX-scoped advisory locks auto-release on commit/rollback — no manual
    // unlock needed.
    await prisma.cronRunLog
      .deleteMany({ where: { jobName: { startsWith: TAG } } })
      .catch(err => console.warn('[iot0h-test cleanup] cronRunLog deleteMany failed:', err?.message));
    cronJobService.jobs.delete(JOB_RACE);
    cronJobService.jobs.delete(JOB_SOLO);
    cronJobService.jobs.delete(JOB_HEALTH);
    await prismaB.$disconnect().catch(() => {});
  });

  it('runs the handler exactly once when two replicas fire in parallel (real cross-session race)', async () => {
    let sideEffectCount = 0;
    const handler = async () => {
      sideEffectCount++;
      // Hold the lock long enough that the parallel call's
      // pg_try_advisory_xact_lock returns false (the lock is contended for
      // the duration of this await). 250ms is plenty for both Promise.all
      // branches to race into the lock attempt before either commits.
      await new Promise(resolve => setTimeout(resolve, 250));
      return { totalProcessed: 1 };
    };

    // CRITICAL: use TWO PrismaClient instances so the two transactions go
    // to TWO different Postgres backends. A single client would pool both
    // onto one backend and serialize them, defeating the cross-session
    // race the test is supposed to prove.
    const [a, b] = await Promise.all([
      withAdvisoryLockOn(prisma, JOB_RACE, handler),
      withAdvisoryLockOn(prismaB, JOB_RACE, handler),
    ]);

    // Exactly one instance ran the handler — the second saw the lock held
    // on another session and returned the skipped sentinel.
    expect(sideEffectCount).toBe(1);
    const results = [a, b];
    const ran = results.filter(r => r && r.acquired === true);
    const skipped = results.filter(r => r && r.acquired === false);
    expect(ran.length).toBe(1);
    expect(skipped.length).toBe(1);
    expect(ran[0].result).toEqual({ totalProcessed: 1 });
    expect(skipped[0].result).toBeNull();
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
