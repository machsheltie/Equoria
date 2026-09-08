/**
 * Groom weekly career-progression + auto-retirement job descriptor
 * (Equoria-m9lz1).
 *
 * Registry entry consumed by initializeCronJobs() in cronJobService.mjs. This is
 * the ONLY thing that advances a groom's career age, and therefore the only
 * thing that can ever retire one: the owner's ruling (2026-09-08) is that
 * "grooms retire automatically at a randomly selected age by the game", and
 * before this descriptor existed `processWeeklyCareerProgression` sat in neither
 * cron registry, so no groom's `careerWeeks` advanced and no groom ever retired.
 * The player-facing trigger is closed (403) precisely because this is meant to
 * be the whole mechanism.
 *
 * Each pass, per non-retired active groom:
 *   - draws and persists the groom's hidden retirement age if it has none yet
 *     (the backstop for grooms predating Equoria-m9lz1, so the migration needs
 *     no backfill);
 *   - advances `careerWeeks` by one, which on Equoria's clock is one game-year
 *     of the groom's working life (backend/utils/horseAge.mjs);
 *   - retires the groom if it has reached that hidden age, ending its active
 *     assignments and notifying the player inside one transaction.
 *
 * WHY 09:45 ON MONDAY, AND WHY THE ORDER MATTERS
 *   Mondays 09:45 UTC, i.e. AFTER the two jobs it interacts with:
 *     09:00  weeklySalaries              — charges per ACTIVE groom assignment
 *     09:30  riderTrainerRetirement      — the sibling staff-retirement pass
 *     09:45  groomCareerProgression      — this job
 *   Running after payroll is deliberate: `processWeeklySalaries` bills per active
 *   assignment, so retiring a groom first would silently deprive them of their
 *   final week's wage and change what the player is charged. Running after the
 *   rider/trainer pass keeps all staff-lifecycle work in one contiguous window.
 *   Verified free of collisions across BOTH registries at the time of writing
 *   (backend/services/cron-job-service-jobs/index.mjs and
 *   backend/services/jobs/index.mjs); no other job uses `45 9 * * 1`.
 *
 * OBSERVABILITY LIMITATION — READ BEFORE RELYING ON THIS JOB
 *   This registry (the FUNCTION-based `cronJobService`) wraps handlers in
 *   `withAdvisoryLock` ONLY. It does NOT wrap them in `runWithHeartbeat`, writes
 *   no `CronRunLog` row, and is invisible to `GET /api/admin/cron/health` —
 *   `backend/modules/admin/controllers/adminController.mjs` imports only
 *   `services/cronJobs.mjs` (registry A). So if this job stops running, nothing
 *   surfaces it: players simply keep their grooms forever and no alert fires.
 *   Heartbeat coverage for registry B is tracked separately (Equoria-cmw85.9)
 *   and is deliberately NOT built here.
 *
 * The advisory lock (`cronJobService:groomCareerProgression`, Equoria-dx65z)
 * makes the pass run exactly once cluster-wide, which matters more here than for
 * most jobs: two concurrent passes would each try to advance `careerWeeks`. The
 * retirement itself is additionally protected by a guarded conditional update
 * inside `processRetirement` (count must be 1), so even a lock failure cannot
 * produce two retirements or two notifications for one groom.
 *
 * `runGroomCareerProgression` stays exported as the work function so tests and a
 * future admin trigger can call it directly, mirroring
 * riderTrainerRetirementJob.mjs.
 */

import logger from '../../utils/logger.mjs';
import { processWeeklyCareerProgression } from '../../modules/grooms/index.mjs';

/**
 * Run the weekly groom career-progression + auto-retirement pass.
 *
 * Returns rather than rethrows on failure, matching runRiderTrainerRetirement:
 * this registry has no heartbeat to record a thrown failure, so a rethrow would
 * be logged by node-cron and lost. `processWeeklyCareerProgression` already
 * collects per-groom errors internally, so a single bad groom never reaches
 * here — an error at this level means the whole pass could not start.
 *
 * @returns {Promise<Object>} the processWeeklyCareerProgression result, or an
 *   `{ error }` envelope if the pass could not run.
 */
export async function runGroomCareerProgression() {
  try {
    logger.info('[cronJobService] Starting weekly groom career-progression pass...');
    const results = await processWeeklyCareerProgression();
    logger.info(
      '[cronJobService] Groom career-progression pass complete. ' +
        `Grooms processed: ${results.processed}; retired: ${results.retired}; ` +
        `newly scheduled: ${results.scheduled}; errors: ${results.errors.length}.`,
    );
    return results;
  } catch (error) {
    logger.error(`[cronJobService] Error in groom career-progression pass: ${error.message}`);
    return { processed: 0, retired: 0, scheduled: 0, errors: [], error: error.message };
  }
}

export default Object.freeze({
  jobName: 'groomCareerProgression',
  // Every Monday at 09:45 UTC — after weeklySalaries (09:00) and
  // riderTrainerRetirement (09:30). See the header for why the order matters.
  schedule: '45 9 * * 1',
  lockKey: 'cronJobService:groomCareerProgression',
  run: runGroomCareerProgression,
});
