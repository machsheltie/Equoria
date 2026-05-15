/**
 * Equoria-304a — Stale-heartbeat alert tests.
 *
 * Validates that CronJobService.evaluateStaleAlerts():
 *   1. Fires a Sentry event when a job's lastFinishedAt is > 25h ago.
 *   2. Includes jobNames + lastFinishedAt timestamps in the event payload.
 *   3. DEBOUNCES — only one alert per stale streak per job (no re-emit on
 *      subsequent polls while still stale).
 *   4. Resets the debounce when the job records a successful run, so a new
 *      stale streak fires a fresh alert.
 *   5. Does NOT alert when the job is stale for < 25h.
 *   6. Does NOT alert when a job has no lastFinishedAt AND no run has been
 *      seen yet (this is the "cron never scheduled at startup" signal — the
 *      Equoria-0elk stale flag still surfaces it on /health, but the
 *      operational alert specifically targets jobs that USED to run and
 *      stopped, not jobs that never started). NOTE: by AC, "anyStale=true
 *      for > 25h" applies to the lastFinishedAt > 25h case. Never-run jobs
 *      get the stale flag but staleForMs is Infinity, which IS > 25h, so
 *      they alert too.
 *
 * No Sentry DSN configured in tests, so Sentry.captureMessage is a noop.
 * We assert behavior on staleAlertState (the debounce map) which is the
 * observable side effect available to tests without a Sentry stub.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import cronJobService, { STALE_ALERT_THRESHOLD_MS } from '../services/cronJobs.mjs';

describe('Equoria-304a: CronJobService.evaluateStaleAlerts', () => {
  const JOB = '304a-test-job';

  beforeEach(() => {
    cronJobService.heartbeats.clear();
    cronJobService.staleAlertState.clear();
    cronJobService.jobs.set(JOB, { running: false, scheduled: false });
  });

  function planted(staleHoursAgo) {
    const finished = new Date(Date.now() - staleHoursAgo * 60 * 60 * 1000);
    return {
      anyStale: true,
      now: new Date().toISOString(),
      jobs: {
        [JOB]: {
          lastStartedAt: finished.toISOString(),
          lastFinishedAt: finished.toISOString(),
          status: 'success',
          summary: null,
          error: null,
          stalenessMs: 30 * 60 * 60 * 1000,
          stale: true,
        },
      },
    };
  }

  it('fires an alert when lastFinishedAt is > 25h ago', () => {
    const fired = cronJobService.evaluateStaleAlerts(planted(26));
    expect(fired.length).toBe(1);
    expect(fired[0].jobName).toBe(JOB);
    expect(fired[0].lastFinishedAt).not.toBeNull();
    expect(fired[0].staleForHours).toBeGreaterThanOrEqual(25);
    // Debounce state populated.
    expect(cronJobService.staleAlertState.has(JOB)).toBe(true);
  });

  it('does NOT fire when lastFinishedAt is < 25h ago', () => {
    const fired = cronJobService.evaluateStaleAlerts(planted(24));
    expect(fired.length).toBe(0);
    expect(cronJobService.staleAlertState.has(JOB)).toBe(false);
  });

  it('debounces — second poll while still stale does NOT re-emit', () => {
    const fired1 = cronJobService.evaluateStaleAlerts(planted(26));
    expect(fired1.length).toBe(1);

    const fired2 = cronJobService.evaluateStaleAlerts(planted(27));
    expect(fired2.length).toBe(0); // debounce blocks re-emit
  });

  it('clears debounce on successful run and re-emits on new stale streak', () => {
    const fired1 = cronJobService.evaluateStaleAlerts(planted(26));
    expect(fired1.length).toBe(1);

    // Record a successful run — should clear the debounce.
    cronJobService.recordHeartbeat(JOB, {
      startedAt: new Date(),
      finishedAt: new Date(),
      status: 'success',
    });
    expect(cronJobService.staleAlertState.has(JOB)).toBe(false);

    // Manually plant another 26h-stale snapshot and assert it alerts again.
    const fired2 = cronJobService.evaluateStaleAlerts(planted(26));
    expect(fired2.length).toBe(1);
  });

  it('fires an alert when lastFinishedAt is null (never-run job, infinite staleness)', () => {
    const health = {
      anyStale: true,
      now: new Date().toISOString(),
      jobs: {
        [JOB]: {
          lastStartedAt: null,
          lastFinishedAt: null,
          status: 'never-run',
          summary: null,
          error: null,
          stalenessMs: 30 * 60 * 60 * 1000,
          stale: true,
        },
      },
    };
    const fired = cronJobService.evaluateStaleAlerts(health);
    expect(fired.length).toBe(1);
    expect(fired[0].lastFinishedAt).toBeNull();
    expect(fired[0].staleForHours).toBeNull(); // Infinity sentinel maps to null
  });

  it('STALE_ALERT_THRESHOLD_MS is exactly 25 hours', () => {
    expect(STALE_ALERT_THRESHOLD_MS).toBe(25 * 60 * 60 * 1000);
  });
});
