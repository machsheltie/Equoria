/**
 * Equoria-0elk — Cron heartbeat / observability tests.
 *
 * Validates that:
 *   1. CronJobService.runWithHeartbeat() records lastStartedAt + lastFinishedAt
 *      on success, and lastFinishedAt + error on failure.
 *   2. getHealth() flags STALE when no run has been recorded for a job.
 *   3. getHealth() flags STALE when the last finishedAt is older than the
 *      job's staleness threshold.
 *   4. Top-level anyStale boolean tracks the per-job stale flags.
 *
 * Approach: instantiate the cron service singleton (no node-cron schedules
 * involved). Call runWithHeartbeat with a stub handler. Inspect getHealth().
 *
 * No DB, no scheduler timers, no real-time waits — purely heartbeat-map
 * semantics. (Persistence + cross-restart history is filed as a follow-up
 * issue; this in-memory layer is enough to detect the original
 * Equoria-0elk failure mode of "cron never scheduled at startup".)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import cronJobService from '../services/cronJobs.mjs';
import { snapshotCronSingleton, restoreCronSingleton } from './helpers/cronSingletonIsolation.mjs';

// Equoria-vi125: both describe blocks below mutate the shared CronJobService
// singleton (clear .heartbeats, conditionally seed 'dailyHorseAging' into
// .jobs). Snapshot the singleton once before this file's suites run and
// restore it after, so those mutations do not leak into sibling suites in the
// same jest worker that iterate cronJobService.jobs.
let cronSnapshot;
beforeAll(() => {
  cronSnapshot = snapshotCronSingleton();
});
afterAll(() => {
  restoreCronSingleton(cronSnapshot);
});

describe('CronJobService.runWithHeartbeat (Equoria-0elk)', () => {
  beforeEach(() => {
    // Reset heartbeats to a known clean state for each test
    cronJobService.heartbeats.clear();
  });

  it('records lastStartedAt + lastFinishedAt + status=success on a successful run', async () => {
    const result = await cronJobService.runWithHeartbeat('dailyHorseAging', async () => ({
      totalProcessed: 5,
      birthdaysFound: 2,
      milestonesTriggered: 0,
      errors: 0,
      duration: 42,
    }));

    expect(result.totalProcessed).toBe(5);

    const hb = cronJobService.heartbeats.get('dailyHorseAging');
    expect(hb).toBeDefined();
    expect(hb.status).toBe('success');
    expect(hb.startedAt).toBeInstanceOf(Date);
    expect(hb.finishedAt).toBeInstanceOf(Date);
    expect(hb.summary).toEqual(
      expect.objectContaining({
        totalProcessed: 5,
        birthdaysFound: 2,
        milestonesTriggered: 0,
        errors: 0,
        duration: 42,
      }),
    );
    expect(hb.error).toBeNull();
  });

  it('records status=error + error message on a failed run, and re-throws', async () => {
    await expect(
      cronJobService.runWithHeartbeat('dailyHorseAging', async () => {
        throw new Error('synthetic-failure');
      }),
    ).rejects.toThrow('synthetic-failure');

    const hb = cronJobService.heartbeats.get('dailyHorseAging');
    expect(hb.status).toBe('error');
    expect(hb.error).toBe('synthetic-failure');
    expect(hb.finishedAt).toBeInstanceOf(Date);
  });

  it('summarizes non-object results as null without crashing', async () => {
    await cronJobService.runWithHeartbeat('dailyHorseAging', async () => undefined);
    const hb = cronJobService.heartbeats.get('dailyHorseAging');
    expect(hb.status).toBe('success');
    expect(hb.summary).toBeNull();
  });
});

describe('CronJobService.getHealth (Equoria-0elk)', () => {
  beforeEach(() => {
    cronJobService.heartbeats.clear();
  });

  it('flags every job as STALE when no run has been recorded yet', () => {
    // Re-seed the jobs map if the service has not been started in this test
    // run — getHealth iterates this.jobs, so it needs at least one entry.
    if (cronJobService.jobs.size === 0) {
      cronJobService.jobs.set('dailyHorseAging', { running: false, scheduled: false });
    }

    const health = cronJobService.getHealth();
    expect(health.anyStale).toBe(true);
    const aging = health.jobs.dailyHorseAging;
    expect(aging.stale).toBe(true);
    expect(aging.lastFinishedAt).toBeNull();
    expect(aging.status).toBe('never-run');
  });

  it('clears STALE flag when a job records a fresh successful run', async () => {
    if (cronJobService.jobs.size === 0) {
      cronJobService.jobs.set('dailyHorseAging', { running: false, scheduled: false });
    }

    await cronJobService.runWithHeartbeat('dailyHorseAging', async () => ({
      totalProcessed: 1,
    }));

    const health = cronJobService.getHealth();
    const aging = health.jobs.dailyHorseAging;
    expect(aging.stale).toBe(false);
    expect(aging.status).toBe('success');
    expect(aging.lastFinishedAt).not.toBeNull();
  });

  it('flags STALE when last run is older than staleness threshold', async () => {
    if (cronJobService.jobs.size === 0) {
      cronJobService.jobs.set('dailyHorseAging', { running: false, scheduled: false });
    }

    // Manually inject an old heartbeat (48h ago) — daily job threshold is 30h.
    const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    cronJobService.recordHeartbeat('dailyHorseAging', {
      startedAt: longAgo,
      finishedAt: longAgo,
      status: 'success',
    });

    const health = cronJobService.getHealth();
    expect(health.jobs.dailyHorseAging.stale).toBe(true);
    expect(health.anyStale).toBe(true);
  });
});
