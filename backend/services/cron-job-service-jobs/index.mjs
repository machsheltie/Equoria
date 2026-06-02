/**
 * cronJobService cron job registry (Equoria-1j167 cronJobService split).
 *
 * Single ordered list of every scheduled-job descriptor that
 * initializeCronJobs() (backend/services/cronJobService.mjs) wires in its init
 * loop. Mirrors the fx4e7 registry pattern (backend/services/jobs/index.mjs)
 * but for the FUNCTION-based cronJobService (not the CronJobService class) — so
 * each descriptor's `run` is the module-local work function itself, not a
 * `service => service.method()` thunk.
 *
 * Each descriptor is `{ jobName, schedule, lockKey, run }`:
 *   - jobName  — canonical key (runningJobs Map key / getCronJobStatus() key).
 *   - schedule — node-cron schedule string (UTC).
 *   - lockKey  — Postgres advisory-lock key passed to withAdvisoryLock so the
 *                side-effect runs EXACTLY ONCE cluster-wide (Equoria-dx65z).
 *   - run()    — the async work function (also re-exported by its own module so
 *                the manual trigger* helpers and tests can call it directly).
 *
 * ORDER IS PRESERVED from the pre-split `runningJobs.set(...)` registration
 * sequence so the Map insertion order (and therefore getCronJobStatus()
 * iteration order, and the canonical-jobs sentinel in cronJobService.test) is
 * byte-identical to before the split:
 *   weeklySalaries, tokenCleanup, foaling, riderTrainerRetirement,
 *   userRankSnapshot.
 */

import weeklySalariesJob from './weeklySalariesJob.mjs';
import tokenCleanupJob from './tokenCleanupJob.mjs';
import foalingJob from './foalingJob.mjs';
import riderTrainerRetirementJob from './riderTrainerRetirementJob.mjs';
import userRankSnapshotJob from './userRankSnapshotJob.mjs';

export const CRON_JOB_SERVICE_REGISTRY = Object.freeze([
  weeklySalariesJob,
  tokenCleanupJob,
  foalingJob,
  riderTrainerRetirementJob,
  userRankSnapshotJob,
]);

export default CRON_JOB_SERVICE_REGISTRY;
