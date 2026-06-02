/**
 * Equoria-vi125 — sentinel for the CronJobService singleton snapshot/restore
 * isolation helpers (backend/__tests__/helpers/cronSingletonIsolation.mjs).
 *
 * This is a SENTINEL-POSITIVE test: it does not merely assert that nothing is
 * wrong. It deliberately reproduces the exact leak the cron suites cause —
 * adding a synthetic job + heartbeat + stale-alert entry, and clearing the
 * heartbeats map — proves that mutation is OBSERVABLE before restore, then
 * proves `restoreCronSingleton` returns the singleton to its pre-mutation
 * state (synthetic keys gone, pre-existing keys re-added). If the restore
 * logic ever silently degrades (e.g. stops clearing, or drops a Map), this
 * test fails loudly.
 *
 * The sentinel is itself leak-free: it snapshots the TRUE baseline before
 * touching anything and restores to it in afterAll, so it cannot leave its
 * own fixtures in the shared singleton for sibling suites.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import cronJobService from '../services/cronJobs.mjs';
import { snapshotCronSingleton, restoreCronSingleton } from './helpers/cronSingletonIsolation.mjs';

const LEAK = 'vi125-synthetic-leak';
const BASELINE = 'vi125-baseline-job';

describe('Equoria-vi125: cron singleton snapshot/restore isolation', () => {
  let trueBaseline;

  beforeAll(() => {
    // Capture the real pre-test state so this sentinel itself does not leak.
    trueBaseline = snapshotCronSingleton();
  });

  afterAll(() => {
    restoreCronSingleton(trueBaseline);
  });

  it('restore drops test-added entries and re-adds cleared baseline entries', () => {
    // Establish a baseline entry that restore must PRESERVE (proves restore
    // is not just a blanket wipe — it returns to the snapshot, real keys and
    // all).
    cronJobService.jobs.set(BASELINE, { running: false, scheduled: true });
    const snapshot = snapshotCronSingleton();
    const baselineJobCount = cronJobService.jobs.size;

    // Reproduce the exact leak shape the cron suites cause: add synthetic
    // entries to all three maps, and clear heartbeats (the beforeEach
    // behavior that wipes sibling state).
    cronJobService.jobs.set(LEAK, { running: false, scheduled: false });
    cronJobService.heartbeats.set(LEAK, { status: 'success', finishedAt: new Date() });
    cronJobService.staleAlertState.set(LEAK, 1234567890);
    cronJobService.heartbeats.clear();

    // SENTINEL-POSITIVE: the mutation is observable before restore.
    expect(cronJobService.jobs.has(LEAK)).toBe(true);
    expect(cronJobService.jobs.size).toBe(baselineJobCount + 1);
    expect(cronJobService.heartbeats.has(BASELINE)).toBe(false); // was cleared

    restoreCronSingleton(snapshot);

    // After restore: synthetic leak gone from ALL three maps...
    expect(cronJobService.jobs.has(LEAK)).toBe(false);
    expect(cronJobService.heartbeats.has(LEAK)).toBe(false);
    expect(cronJobService.staleAlertState.has(LEAK)).toBe(false);
    // ...and the pre-existing baseline entry is intact (count back to baseline).
    expect(cronJobService.jobs.has(BASELINE)).toBe(true);
    expect(cronJobService.jobs.size).toBe(baselineJobCount);
  });

  it('snapshot is a copy, not a live view (later singleton mutations do not alter it)', () => {
    const snapshot = snapshotCronSingleton();
    const sizeAtSnapshot = snapshot.jobs.size;
    cronJobService.jobs.set(LEAK, { running: false, scheduled: false });
    // The snapshot taken earlier must not reflect the post-snapshot mutation.
    expect(snapshot.jobs.size).toBe(sizeAtSnapshot);
    expect(snapshot.jobs.has(LEAK)).toBe(false);
    // Clean up the live singleton mutation for the next test / afterAll.
    cronJobService.jobs.delete(LEAK);
  });
});
