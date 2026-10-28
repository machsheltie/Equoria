/**
 * Epigenetic-flag cluster (Equoria-urqic.3.2 cronJobs split).
 *
 * Holds the two epigenetic-flag cron wrappers — the weekly flag evaluation and
 * the daily temporary-flag expiry sweep — extracted out of the CronJobService
 * class so the orchestrator (backend/services/cronJobs.mjs) stays a thin
 * scheduler + heartbeat + persistence + health surface.
 *
 * PLAIN FREE FUNCTIONS (no `service` handle): unlike the foal-trait /
 * horse-aging clusters, neither of these jobs re-enters any sibling
 * CronJobService method — each is a self-contained summary-building wrapper
 * around an already-extracted domain function. So they take no `service`
 * handle (mirroring electionTransition.mjs, not horseAging.mjs).
 *
 * The class keeps thin `evaluateWeeklyFlags()` / `sweepExpiredTemporaryFlags()`
 * delegators because the registry handlers
 * (jobs/weeklyFlagEvaluationJob.mjs, jobs/temporaryFlagExpiryJob.mjs) invoke
 * them on the singleton via `service.evaluateWeeklyFlags()` /
 * `service.sweepExpiredTemporaryFlags()`, and integration suites call them on
 * the singleton too — those entrypoints MUST stay instance methods.
 *
 * NAME-COLLISION OWNERSHIP (Equoria-urqic.3.2): cronJobs.mjs previously
 * imported `{ sweepExpiredTemporaryFlags }` from ../../modules/traits/index.mjs
 * AND had a same-named method on the class — the imported domain function and
 * the class wrapper shadowed each other only by lexical scope (the method body
 * called the free import). After this move, THIS impl module owns the
 * modules/traits barrel import; cronJobs.mjs keeps only the class method (its
 * delegator forwards here), so the collision is gone from the orchestrator —
 * no leftover unused import, no shadowed name.
 *
 * NO log-then-rethrow wrapper (Equoria-urqic.3.2 / Equoria-ej9k1 doctrine):
 * the pre-split evaluateWeeklyFlags + sweepExpiredTemporaryFlags each had a
 * `try { ... } catch (error) { logger.error(...); throw error; }` outer
 * wrapper. Both were DROPPED in the move (not carried over) because the cron
 * orchestrator's runWithHeartbeat already logs job failures with the job key +
 * full context. A local catch that only logged then `throw error`'d would
 * double-log and add nothing. This ratchets the cronJobs.mjs rethrow-after-log
 * baseline DOWN by 2.
 *
 * CAUTION (CLAUDE.md / GENERAL_RULES): no inline horse-age math here. The
 * weekly evaluation defers all age-window logic to getEligibleHorses (which
 * uses canonical game-year arithmetic) + evaluateHorseFlags; the sweep keys off
 * each temp-flag entry's stored expiresAt, not horse age. Nothing to route
 * through backend/utils/horseAge.mjs.
 */

import logger from '../../../utils/logger.mjs';
import { sweepExpiredTemporaryFlags } from '../../../modules/traits/index.mjs';

/**
 * Equoria-yzqhj.5: daily temporary-flag expiry sweep.
 *
 * Delegates to temporaryFlagSystem.sweepExpiredTemporaryFlags() (reached via
 * the modules/traits/index.mjs barrel, which this impl module now owns), which
 * does a SCOPED read of only the horses with a non-empty
 * temporaryEpigeneticFlags array and removes any { flag, expiresAt, source }
 * entry whose expiresAt is in the past. The returned summary
 * ({ horsesScanned, horsesUpdated, flagsRemoved }) flows into the heartbeat
 * layer so /api/admin/cron/health surfaces what was swept.
 *
 * Failure mode: errors bubble up so runWithHeartbeat records them; the cron
 * service does NOT crash. Idempotent — a second run with the same clock
 * finds nothing expired and is a no-op.
 *
 * Named `...Job` (not `sweepExpiredTemporaryFlags`) ON PURPOSE: this impl module
 * imports the domain function `sweepExpiredTemporaryFlags` from the modules/traits
 * barrel, so exporting a wrapper of the SAME name would re-create inside this
 * module the very import/method shadow the split was meant to remove. The class
 * delegator (CronJobService.sweepExpiredTemporaryFlags) keeps the public name;
 * it forwards to this distinctly-named wrapper.
 *
 * @returns {Promise<{ horsesScanned:number, horsesUpdated:number,
 *                      flagsRemoved:number }>}
 */
export async function sweepExpiredTemporaryFlagsJob() {
  const startTime = Date.now();
  logger.info('[CronJobService.sweepExpiredTemporaryFlags] Starting temporary-flag expiry sweep');

  const result = await sweepExpiredTemporaryFlags();
  const duration = Date.now() - startTime;
  logger.info(
    `[CronJobService.sweepExpiredTemporaryFlags] Completed in ${duration}ms — ` +
      `scanned ${result.horsesScanned} horse(s), updated ${result.horsesUpdated}, ` +
      `removed ${result.flagsRemoved} expired flag(s)`,
  );
  return result;
}
