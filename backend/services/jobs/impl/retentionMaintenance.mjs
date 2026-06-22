/**
 * Retention / maintenance cluster (Equoria-urqic.3.3 cronJobs split).
 *
 * Holds the seven single-delegator retention/maintenance cron wrappers —
 * extracted out of the CronJobService class so the orchestrator
 * (backend/services/cronJobs.mjs) stays a thin scheduler + heartbeat +
 * persistence + health surface. Each wrapper is the SAME shape: call an
 * already-extracted domain/retention service, build a log line + a JSON-safe
 * summary, return it.
 *
 *   purgeExpiredAuditLogs        -> modules/admin purgeExpiredAuditLogs
 *   purgeExpiredCronRunLogs      -> cronRunLogRetentionService
 *   recordDocCoverageSnapshot    -> apiDocumentationService.recordCoverageSnapshot
 *                                   + docCoverageSnapshotRetentionService
 *   decayHoofConditions          -> modules/horses decayHoofConditions
 *   processFoalMilestones        -> utils/horseAgingSystem processFoalMilestoneEvaluations
 *   tickRiderTrainerCareerWeeks  -> modules/trainers incrementWeeklyCareerWeeks
 *   executeOvernightShows        -> modules/competition executeClosedShows
 *
 * PLAIN FREE FUNCTIONS (no `service` handle): unlike the foal-trait /
 * horse-aging clusters, NONE of these jobs re-enters any sibling
 * CronJobService method — each is a self-contained summary-building wrapper
 * around an already-extracted domain function. So they take no `service`
 * handle (mirroring electionTransition.mjs / flagEvaluation.mjs, not
 * horseAging.mjs).
 *
 * The class keeps thin delegators with the SAME public names because every
 * registry handler (jobs/dailyMilestoneJob, jobs/weeklyRiderTrainerCareerJob,
 * jobs/nightlyShowExecutionJob, jobs/auditLogRetentionJob,
 * jobs/hoofConditionDecayJob, jobs/docCoverageSnapshotJob,
 * jobs/cronRunLogRetentionJob) invokes them on the singleton via
 * `service.<method>()`, and integration suites
 * (cronJobsOvernightShowExecution.test.mjs calls
 * cronJobService.executeOvernightShows directly) exercise them on the
 * singleton too — those entrypoints MUST stay instance methods.
 *
 * NAME-COLLISION OWNERSHIP (Equoria-urqic.3.3): cronJobs.mjs previously
 * imported `{ purgeExpiredAuditLogs }` (modules/admin), `{ decayHoofConditions }`
 * (modules/horses), `{ purgeExpiredCronRunLogs }` (cronRunLogRetentionService),
 * `{ incrementWeeklyCareerWeeks }` (modules/trainers), `{ executeClosedShows }`
 * (modules/competition), `{ processFoalMilestoneEvaluations }`
 * (utils/horseAgingSystem), and `{ recordCoverageSnapshot }` +
 * `{ purgeExpiredDocCoverageSnapshots }` (api-doc/doc-coverage services) AND
 * had same-named class methods for the first three. The imported domain
 * functions and the class wrappers shadowed each other only by lexical scope
 * (the method body called the free import). After this move, THIS impl module
 * owns all those imports; cronJobs.mjs keeps only the class delegators (each
 * forwards here), so the collisions — and all those now-unused imports — are
 * gone from the orchestrator.
 *
 * NO log-then-rethrow wrapper (Equoria-urqic.3.3 / Equoria-ej9k1 doctrine):
 * the pre-split processFoalMilestones, tickRiderTrainerCareerWeeks,
 * executeOvernightShows, purgeExpiredAuditLogs, and decayHoofConditions each
 * had a `try { ... } catch (error) { logger.error(...); throw error; }` outer
 * wrapper. All five were DROPPED in the move (not carried over) because the
 * cron orchestrator's runWithHeartbeat already logs job failures with the job
 * key + full context — a local catch that only logged then `throw error`'d
 * would double-log and add nothing. (purgeExpiredCronRunLogs +
 * recordDocCoverageSnapshot already had no such wrapper pre-split.) This
 * ratchets the cronJobs.mjs rethrow-after-log baseline DOWN by 5 (5 -> 0,
 * the cronJobs.mjs entry is removed from the baseline JSON).
 *
 * CAUTION (CLAUDE.md / GENERAL_RULES): no inline horse-age math here.
 * processFoalMilestones defers ALL age-window logic to
 * processFoalMilestoneEvaluations (utils/horseAgingSystem, canonical
 * arithmetic); the retention purges key off each row's stored timestamp, not
 * horse age. Nothing to route through backend/utils/horseAge.mjs.
 */

import logger from '../../../utils/logger.mjs';
import { processFoalMilestoneEvaluations } from '../../../utils/horseAgingSystem.mjs';
import { incrementWeeklyCareerWeeks } from '../../../modules/trainers/index.mjs';
import { purgeExpiredAuditLogs as purgeExpiredAuditLogsService } from '../../../modules/admin/index.mjs';
import { decayHoofConditions as decayHoofConditionsService } from '../../../modules/horses/index.mjs';
import { executeClosedShows } from '../../../modules/competition/index.mjs';
import { recordCoverageSnapshot } from '../../apiDocumentationService.mjs';
import { purgeExpiredDocCoverageSnapshots } from '../../docCoverageSnapshotRetentionService.mjs';
import { purgeExpiredCronRunLogs as purgeExpiredCronRunLogsService } from '../../cronRunLogRetentionService.mjs';

/**
 * Equoria-3yxz: Daily foal milestone evaluation pass.
 * Iterates active foals in developmental windows and writes a MilestoneTraitLog
 * row for any window the foal has just entered (and not yet been evaluated for).
 *
 * @param {Object} options - { dryRun, specificHorseId }
 * @returns {Promise<Object>} Processing results
 *   ({ totalProcessed, milestonesEvaluated, milestonesSkipped, errors })
 */
export async function processFoalMilestones(options = {}) {
  const startTime = Date.now();
  logger.info('[CronJobService.processFoalMilestones] Starting daily foal milestone evaluation');

  const result = await processFoalMilestoneEvaluations(options);
  const duration = Date.now() - startTime;
  logger.info(
    `[CronJobService.processFoalMilestones] Completed in ${duration}ms — foals: ${result.totalProcessed}, evaluated: ${result.milestonesEvaluated}, skipped: ${result.milestonesSkipped}, errors: ${result.errors}`,
  );
  return result;
}

/**
 * Equoria-r1nr: Weekly career-week ++ pass for riders and trainers.
 * Mirrors the groom progression cron for the other NPC types.
 *
 * @returns {Promise<{ ridersTicked: number, trainersTicked: number }>}
 */
export async function tickRiderTrainerCareerWeeks() {
  const startTime = Date.now();
  logger.info(
    '[CronJobService.tickRiderTrainerCareerWeeks] Starting weekly rider/trainer career-week tick',
  );

  const result = await incrementWeeklyCareerWeeks();
  const duration = Date.now() - startTime;
  logger.info(
    `[CronJobService.tickRiderTrainerCareerWeeks] Completed in ${duration}ms — riders: ${result.ridersTicked}, trainers: ${result.trainersTicked}`,
  );
  return result;
}

/**
 * Equoria-aghl (FR-CN8): Overnight show execution pass.
 *
 * Invokes the competition module's executeClosedShows handler with no req/res
 * (the controller already gracefully handles missing res — see
 * showController.mjs `if (res)` guards on success/error branches), which means
 * it functions as both an HTTP-callable admin endpoint AND a cron-callable
 * service action without duplicating the scoring/prize/XP pipeline.
 *
 * Behaviour: finds every Show where status='open' AND closeDate <= now, scores
 * all entries, awards prizes, awards rider XP, sets firstEverWin milestones,
 * and marks each show 'completed' with executedAt populated.
 *
 * Returns nothing meaningful — executeClosedShows handles its own
 * persistence; the cron layer only needs success/failure (recorded by
 * runWithHeartbeat).
 *
 * @returns {Promise<void>}
 */
export async function executeOvernightShows() {
  const startTime = Date.now();
  logger.info('[CronJobService.executeOvernightShows] Starting nightly overnight show execution');

  // Pass undefined for req/res — controller's `if (res)` guards both response
  // paths (200-on-success, 500-on-error), so when called from cron those sends
  // are skipped and the handler runs purely as a service.
  await executeClosedShows(undefined, undefined);
  const duration = Date.now() - startTime;
  logger.info(`[CronJobService.executeOvernightShows] Completed in ${duration}ms`);
}

/**
 * Equoria-54qq8 (OWASP A09 follow-up): nightly audit-log retention purge.
 *
 * Delegates to auditLogRetentionService.purgeExpiredAuditLogs() (modules/admin
 * barrel), a scoped DELETE of audit_logs rows older than the retention window.
 * The returned summary ({ deletedCount, retentionDays, cutoff }) flows into the
 * heartbeat layer so /api/admin/cron/health surfaces what was purged.
 *
 * @returns {Promise<{ deletedCount: number, retentionDays: number, cutoff: string }>}
 */
export async function purgeExpiredAuditLogs() {
  const startTime = Date.now();
  logger.info('[CronJobService.purgeExpiredAuditLogs] Starting audit-log retention purge');

  const result = await purgeExpiredAuditLogsService();
  const duration = Date.now() - startTime;
  logger.info(
    `[CronJobService.purgeExpiredAuditLogs] Completed in ${duration}ms — ` +
      `deleted ${result.deletedCount} row(s), retention ${result.retentionDays}d`,
  );
  return result;
}

/**
 * Equoria-2tx16: nightly cron-run-log retention purge.
 *
 * Delegates to cronRunLogRetentionService.purgeExpiredCronRunLogs(), a scoped
 * DELETE of cron_run_logs rows older than the retention window. The returned
 * summary ({ deletedCount, retentionDays, cutoff }) flows into the heartbeat
 * layer so /api/admin/cron/health surfaces what was purged. Without this the
 * runWithHeartbeat() writer grows the table unbounded (one row per cycle,
 * ~11 jobs/day) — the same unbounded-observability-table class already closed
 * for audit_logs (Equoria-54qq8) and doc_coverage_snapshots (Equoria-qr114).
 *
 * @returns {Promise<{ deletedCount: number, retentionDays: number, cutoff: string }>}
 */
export async function purgeExpiredCronRunLogs() {
  const startTime = Date.now();
  logger.info('[CronJobService.purgeExpiredCronRunLogs] Starting cron-run-log retention purge');

  const result = await purgeExpiredCronRunLogsService();
  const duration = Date.now() - startTime;
  logger.info(
    `[CronJobService.purgeExpiredCronRunLogs] Completed in ${duration}ms — ` +
      `deleted ${result.deletedCount} row(s), retention ${result.retentionDays}d`,
  );
  return result;
}

/**
 * Equoria-qr114: daily documentation-coverage snapshot recording + retention.
 *
 * Step 1 — record: calls recordCoverageSnapshot() (Equoria-zr9kl), which
 * persists ONE DocCoverageSnapshot row capturing the CURRENT coverage +
 * quality score. A series of these rows is what deriveCoverageTrend() reads to
 * compute a real improving/declining/stable trend.
 *
 * Step 2 — purge: calls purgeExpiredDocCoverageSnapshots() (a scoped DELETE of
 * rows older than the retention window) so daily recording can't grow the
 * table unbounded. Mirrors the auditLogRetention pattern (env-overridable
 * window + 7-day floor + scoped DELETE).
 *
 * The two are independent maintenance steps: the purge runs even if a prior
 * run's recording succeeded. This wrapper SHAPES a flattened summary
 * (snapshotId/coveragePct/qualityScore from the record step,
 * deletedCount/retentionDays from the purge step) — the only non-trivial
 * summary-shaping wrapper in this cluster, hence its focused real-DB test.
 *
 * @returns {Promise<{
 *   snapshotId: number,
 *   coveragePct: number,
 *   qualityScore: number,
 *   deletedCount: number,
 *   retentionDays: number,
 * }>}
 */
export async function recordDocCoverageSnapshot() {
  const startTime = Date.now();
  logger.info('[CronJobService.recordDocCoverageSnapshot] Starting doc-coverage snapshot record');

  const snapshot = await recordCoverageSnapshot();
  const purge = await purgeExpiredDocCoverageSnapshots();
  const duration = Date.now() - startTime;
  logger.info(
    `[CronJobService.recordDocCoverageSnapshot] Completed in ${duration}ms — ` +
      `recorded snapshot id=${snapshot.id} (coverage=${snapshot.coveragePct.toFixed(1)}%, ` +
      `quality=${snapshot.qualityScore}); purged ${purge.deletedCount} expired row(s), ` +
      `retention ${purge.retentionDays}d`,
  );
  return {
    snapshotId: snapshot.id,
    coveragePct: snapshot.coveragePct,
    qualityScore: snapshot.qualityScore,
    deletedCount: purge.deletedCount,
    retentionDays: purge.retentionDays,
  };
}

/**
 * Equoria-gg3v: nightly hoof-condition decay (farrier re-booking loop).
 *
 * Delegates to hoofConditionDecayService.decayHoofConditions() (modules/horses
 * barrel), a decay-only scoped updateMany that steps a horse's hoofCondition
 * down one rung per elapsed HOOF_CONDITION_DECAY_DAYS interval since its last
 * farrier visit. The returned summary ({ decayedCount, decayDays, transitions })
 * flows into the heartbeat layer so /api/admin/cron/health surfaces what
 * decayed.
 *
 * @returns {Promise<{ decayedCount: number, decayDays: number,
 *                      transitions: Array<{from:string,to:string,count:number}> }>}
 */
export async function decayHoofConditions() {
  const startTime = Date.now();
  logger.info('[CronJobService.decayHoofConditions] Starting hoof-condition decay');

  const result = await decayHoofConditionsService();
  const duration = Date.now() - startTime;
  logger.info(
    `[CronJobService.decayHoofConditions] Completed in ${duration}ms — ` +
      `decayed ${result.decayedCount} horse(s), interval ${result.decayDays}d`,
  );
  return result;
}
