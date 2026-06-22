/**
 * Horse-aging cluster (Equoria-urqic.3.1 cronJobs split).
 *
 * Holds the daily horse-aging cron wrapper, extracted out of the
 * CronJobService class so the orchestrator (backend/services/cronJobs.mjs)
 * stays a thin scheduler + heartbeat + persistence + health surface.
 *
 * WHY A `service` HANDLE on processHorseAging:
 * processHorseAging re-enters logAgingSummary (a sibling method that
 * cronJobs.test.mjs / aging integration suites may spy on the singleton). To
 * keep the `this`-coupled call graph intact across the split — so a test that
 * stubs/spies cronJobService.logAgingSummary still observes the call — the
 * class keeps thin delegators (processHorseAging / logAgingSummary /
 * manualHorseAging stay on the singleton because integration tests invoke
 * them there) and forwards `this` as the `service` handle. processHorseAging
 * re-enters through `service.logAgingSummary`, NOT a direct sibling
 * free-function call.
 *
 * CAUTION (CLAUDE.md GENERAL_RULES / Equoria-vdw5): NO inline horse-age math
 * here. processHorseAging is purely the cron wrapper around
 * processHorseBirthdays() in backend/utils/horseAgingSystem.mjs, which owns the
 * age arithmetic (calculateAgeFromBirth / game-year math). This extraction
 * relocates only the wrapper + audit-summary logging — it touches no date
 * arithmetic, so there is nothing to route through backend/utils/horseAge.mjs.
 *
 * NO log-then-rethrow wrapper (Equoria-urqic.3.1): the pre-split
 * processHorseAging had a `try { ... } catch (error) { logger.error(...);
 * throw error; }` outer wrapper. It was DROPPED in the move (not carried over)
 * because the cron orchestrator's runWithHeartbeat already logs job failures
 * with the job key + full context (the rethrow-after-log doctrine,
 * Equoria-ej9k1). A local catch that only logged then `throw error`'d would
 * double-log and add nothing.
 */

import logger from '../../../utils/logger.mjs';
import { processHorseBirthdays } from '../../../utils/horseAgingSystem.mjs';

/**
 * Daily horse aging process. Processes all horses for birthday updates and
 * milestone evaluation, then writes an aging audit summary.
 *
 * @param {Object} service - the CronJobService instance (for `this`-coupled
 *   re-entry into logAgingSummary so a test spy on the singleton still fires).
 * @param {Object} [options] - Processing options (e.g. { horseIds } filter,
 *   { specificHorseId }, { dryRun }) — forwarded verbatim to
 *   processHorseBirthdays.
 * @returns {Promise<Object>} the processHorseBirthdays result.
 */
export async function processHorseAging(service, options = {}) {
  const startTime = Date.now();
  logger.info('[CronJobService.processHorseAging] Starting daily horse aging process');

  const result = await processHorseBirthdays(options);

  const duration = Date.now() - startTime;
  logger.info(`[CronJobService.processHorseAging] Completed aging process in ${duration}ms`);
  logger.info(
    `[CronJobService.processHorseAging] Summary: ${result.totalProcessed} horses processed, ${result.birthdaysFound} birthdays, ${result.milestonesTriggered} milestones, ${result.errors} errors`,
  );

  // Log audit summary (re-enter via the service handle so a singleton spy fires)
  await service.logAgingSummary({
    timestamp: new Date(),
    ...result,
    duration,
  });

  return result;
}

/**
 * Log aging audit summary. Best-effort: a logging failure here is swallowed so
 * it never aborts the surrounding aging flow.
 * @param {Object} summary - Summary data (timestamp + processHorseBirthdays result).
 */
export async function logAgingSummary(summary) {
  try {
    const auditSummary = {
      type: 'DAILY_HORSE_AGING_SUMMARY',
      timestamp: summary.timestamp.toISOString(),
      statistics: {
        horsesProcessed: summary.totalProcessed,
        birthdaysFound: summary.birthdaysFound,
        milestonesTriggered: summary.milestonesTriggered,
        errors: summary.errors,
        duration: summary.duration,
      },
    };

    logger.info(`[CronJobService.AUDIT] Aging summary: ${JSON.stringify(auditSummary)}`);
  } catch (error) {
    logger.error(`[CronJobService.logAgingSummary] Error logging aging summary: ${error.message}`);
  }
}
