/**
 * Cron job registry (Equoria-fx4e7 cronJobs split).
 *
 * Single ordered list of every scheduled-job descriptor that CronJobService
 * wires in `start()`. Each descriptor is `{ jobName, schedule, applyLock,
 * staleAfterMs, run }`:
 *   - jobName      — canonical key (CronJobService.jobs / heartbeats key,
 *                    /api/admin/cron/health key).
 *   - schedule     — node-cron schedule string (UTC).
 *   - applyLock    — true => wrap in pg_try_advisory_xact_lock so the
 *                    side-effect runs EXACTLY ONCE cluster-wide (Equoria-iot0h).
 *   - staleAfterMs — heartbeat staleness budget (Equoria-0elk) — surfaced in
 *                    the cron-health endpoint and used by getHealth().
 *   - run(service) — thunk invoking the matching CronJobService instance
 *                    method. The domain impls stay as instance methods on the
 *                    class because integration tests call them directly on the
 *                    singleton (e.g. evaluateFoalTraits, transitionElectionStatuses,
 *                    executeOvernightShows, evaluateWeeklyFlags, manualHorseAging)
 *                    and they share a `this`-coupled call graph; moving the
 *                    bodies to free functions would break that contract. This
 *                    registry extracts the per-job METADATA + wiring, which is
 *                    what bloated start()/JOB_STALENESS_MS.
 *
 * ORDER IS PRESERVED from the pre-split `start()` registration sequence so the
 * Map insertion order (and therefore getStatus()/getHealth() iteration order)
 * is byte-identical to before the split.
 */

import dailyTraitJob from './dailyTraitJob.mjs';
import dailyAgingJob from './dailyAgingJob.mjs';
import dailyMilestoneJob from './dailyMilestoneJob.mjs';
import weeklyRiderTrainerCareerJob from './weeklyRiderTrainerCareerJob.mjs';
import electionTransitionJob from './electionTransitionJob.mjs';
import nightlyShowExecutionJob from './nightlyShowExecutionJob.mjs';
import auditLogRetentionJob from './auditLogRetentionJob.mjs';
import hoofConditionDecayJob from './hoofConditionDecayJob.mjs';
import weeklyFlagEvaluationJob from './weeklyFlagEvaluationJob.mjs';
import temporaryFlagExpiryJob from './temporaryFlagExpiryJob.mjs';

/**
 * Ordered registry. The sequence matches the original `this.jobs.set(...)`
 * order in cronJobs.mjs#start() exactly:
 *   dailyTraitEvaluation, dailyHorseAging, dailyFoalMilestoneEvaluation,
 *   weeklyRiderTrainerCareerWeeks, electionStatusTransition,
 *   nightlyShowExecution, auditLogRetention, hoofConditionDecay,
 *   weeklyFlagEvaluation, temporaryFlagExpiry.
 */
export const CRON_JOB_REGISTRY = Object.freeze([
  dailyTraitJob,
  dailyAgingJob,
  dailyMilestoneJob,
  weeklyRiderTrainerCareerJob,
  electionTransitionJob,
  nightlyShowExecutionJob,
  auditLogRetentionJob,
  hoofConditionDecayJob,
  weeklyFlagEvaluationJob,
  temporaryFlagExpiryJob,
]);

export default CRON_JOB_REGISTRY;
