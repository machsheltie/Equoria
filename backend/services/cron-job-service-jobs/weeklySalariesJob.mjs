/**
 * Weekly salary processing job descriptor (Equoria-1j167 cronJobService split).
 *
 * Registry entry consumed by initializeCronJobs() in cronJobService.mjs.
 * Behaviour identical to the pre-split inline `cron.schedule('0 9 * * 1', ...)`:
 * Every Monday 09:00 UTC, advisory-locked under 'cronJobService:weeklySalaries'.
 *
 * `runSalaryProcessing` stays the work function (also re-exported by
 * cronJobService.mjs as the manual triggerSalaryProcessing path's impl is a
 * sibling that calls processWeeklySalaries directly).
 */

import logger from '../../utils/logger.mjs';
import { processWeeklySalaries } from '../../modules/grooms/index.mjs';

/**
 * Run weekly salary processing
 */
export async function runSalaryProcessing() {
  try {
    logger.info('[cronJobService] Starting weekly salary processing...');

    const results = await processWeeklySalaries();

    logger.info(
      `[cronJobService] Weekly salary processing completed. Results: ${JSON.stringify(results)}`,
    );

    // Log summary
    if (results.successful > 0) {
      logger.info(
        `[cronJobService] Successfully processed $${results.totalAmount} in salaries for ${results.successful} users`,
      );
    }

    if (results.failed > 0) {
      logger.warn(`[cronJobService] Failed to process salaries for ${results.failed} users`);
      results.errors.forEach(error => {
        logger.warn(`[cronJobService] Salary processing error: ${error}`);
      });
    }
  } catch (error) {
    logger.error(`[cronJobService] Error in weekly salary processing: ${error.message}`);
  }
}

export default Object.freeze({
  jobName: 'weeklySalaries',
  // Every Monday at 09:00 UTC.
  schedule: '0 9 * * 1',
  lockKey: 'cronJobService:weeklySalaries',
  run: runSalaryProcessing,
});
