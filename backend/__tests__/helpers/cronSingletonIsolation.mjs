/**
 * Equoria-vi125 — snapshot / restore helpers for the shared CronJobService
 * singleton (the default export of backend/services/cronJobs.mjs).
 *
 * Why this exists
 * ---------------
 * The cron test suites mutate the singleton's `jobs`, `heartbeats`, and
 * `staleAlertState` Maps directly (adding synthetic jobs, clearing
 * heartbeats). Because the singleton is shared across every suite that runs
 * in the same jest worker, those mutations LEAK into sibling suites that
 * iterate `cronJobService.jobs` (getHealth / getStatus / evaluateStaleAlerts).
 * This is the same shared-mutable-state-under-parallel-workers class as the
 * known flakes (Equoria-bv8iq / 3n2g4 / dgvka); it is currently latent (the
 * colliding suites tolerate extra job keys) but is a real isolation gap.
 *
 * A suite snapshots the three Maps in `beforeAll` and restores them in
 * `afterAll`, returning the singleton to its exact pre-suite state.
 *
 * Why a shallow Map copy is a faithful snapshot
 * ---------------------------------------------
 * CronJobService only ever REPLACES map values (`.set` with a fresh object)
 * or removes them (`.delete` / `.clear`) — it never mutates a stored value
 * object in place. So copying the entries by reference preserves the exact
 * original values; restoring those references reproduces the pre-suite state.
 */

import cronJobService from '../../services/cronJobs.mjs';

/**
 * Capture the current state of the CronJobService singleton's three Maps.
 * @returns {{jobs: Map, heartbeats: Map, staleAlertState: Map}} snapshot
 */
export function snapshotCronSingleton() {
  return {
    jobs: new Map(cronJobService.jobs),
    heartbeats: new Map(cronJobService.heartbeats),
    staleAlertState: new Map(cronJobService.staleAlertState),
  };
}

/**
 * Restore the CronJobService singleton's three Maps to a prior snapshot,
 * dropping any keys added since and re-adding any keys cleared since.
 * @param {{jobs: Map, heartbeats: Map, staleAlertState: Map}} snapshot
 */
export function restoreCronSingleton(snapshot) {
  replaceMapContents(cronJobService.jobs, snapshot.jobs);
  replaceMapContents(cronJobService.heartbeats, snapshot.heartbeats);
  replaceMapContents(cronJobService.staleAlertState, snapshot.staleAlertState);
}

// Mutate `target` in place so the singleton keeps the SAME Map instance
// (callers and the service hold a reference to it) while its contents are
// reset to match `source`.
function replaceMapContents(target, source) {
  target.clear();
  for (const [key, value] of source) {
    target.set(key, value);
  }
}
