/**
 * Rider/Trainer auto-retirement job descriptor (Equoria-1j167 cronJobService
 * split).
 *
 * Registry entry consumed by initializeCronJobs() in cronJobService.mjs.
 * Behaviour identical to the pre-split inline `cron.schedule('30 9 * * 1', ...)`:
 * Every Monday 09:30 UTC (just after weekly salary processing), advisory-locked
 * under 'cronJobService:riderTrainerRetirement'. Retires any rider/trainer
 * whose careerWeeks have crossed the mandatory-retirement threshold
 * (Equoria-osum).
 *
 * `runRiderTrainerRetirement` stays the work function; cronJobService.mjs has a
 * sibling triggerRiderTrainerRetirement that calls processRiderTrainerRetirement
 * directly for testing/admin.
 */

import logger from '../../utils/logger.mjs';
import { processRiderTrainerRetirement } from '../../modules/trainers/index.mjs';

/**
 * Run Rider + Trainer auto-retirement pass (Equoria-osum).
 * Retires any rider/trainer with careerWeeks above the mandatory-retirement
 * threshold and deactivates their active assignments.
 */
export async function runRiderTrainerRetirement() {
  try {
    logger.info('[cronJobService] Starting rider/trainer auto-retirement pass...');
    const results = await processRiderTrainerRetirement();
    logger.info(
      '[cronJobService] Rider/trainer auto-retirement complete. ' +
        `Riders retired: ${results.riders.retiredCount}; ` +
        `trainers retired: ${results.trainers.retiredCount}.`,
    );
    return results;
  } catch (error) {
    logger.error(`[cronJobService] Error in rider/trainer auto-retirement: ${error.message}`);
    return { riders: null, trainers: null, error: error.message };
  }
}

export default Object.freeze({
  jobName: 'riderTrainerRetirement',
  // Every Monday at 09:30 UTC.
  schedule: '30 9 * * 1',
  lockKey: 'cronJobService:riderTrainerRetirement',
  run: runRiderTrainerRetirement,
});
