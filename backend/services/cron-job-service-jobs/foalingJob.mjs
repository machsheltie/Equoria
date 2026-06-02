/**
 * Foaling job descriptor (Equoria-1j167 cronJobService split).
 *
 * Registry entry consumed by initializeCronJobs() in cronJobService.mjs.
 * Behaviour identical to the pre-split inline `cron.schedule('5 0 * * *', ...)`:
 * Daily 00:05 UTC, advisory-locked under 'cronJobService:foaling'. Mares whose
 * inFoalSinceDate is older than 7 days are foaled and their pregnancy columns
 * are cleared. (B5, parent Equoria-3gqg / Equoria-wmnq)
 *
 * `runFoalingJobScheduled` stays the work function; cronJobService.mjs has a
 * sibling triggerFoalingJob that calls runFoalingJob directly for admin use.
 */

import logger from '../../utils/logger.mjs';
import { runFoalingJob } from '../../modules/horses/index.mjs';

/**
 * Run the foaling job — finds mares whose 7-day gestation has elapsed,
 * delivers their foals, and clears pregnancy state.
 */
export async function runFoalingJobScheduled() {
  try {
    logger.info('[cronJobService] Starting foaling job...');
    const results = await runFoalingJob();
    logger.info(
      `[cronJobService] Foaling job completed. Foals born: ${results.foalsBorn}, errors: ${results.errors.length}`,
    );
    return results;
  } catch (error) {
    logger.error(`[cronJobService] Error in foaling job: ${error.message}`);
    return { foalsBorn: 0, errors: [{ damId: null, error: error.message }] };
  }
}

export default Object.freeze({
  jobName: 'foaling',
  // Daily at 00:05 UTC.
  schedule: '5 0 * * *',
  lockKey: 'cronJobService:foaling',
  run: runFoalingJobScheduled,
});
