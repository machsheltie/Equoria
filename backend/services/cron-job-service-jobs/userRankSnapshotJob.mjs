/**
 * UserRankSnapshot capture job descriptor (Equoria-1j167 cronJobService split).
 *
 * Registry entry consumed by initializeCronJobs() in cronJobService.mjs.
 * Behaviour identical to the pre-split inline `cron.schedule('0 2 * * *', ...)`:
 * Daily 02:00 UTC, advisory-locked under 'cronJobService:userRankSnapshot'.
 * Walks every user, computes their current rank across the four leaderboard
 * categories, and persists a UserRankSnapshot row per category. Frontend chart
 * consumes this history via leaderboardController.getUserRankSummary
 * (Equoria-dbdk).
 *
 * `runUserRankSnapshotCapture` stays the work function; cronJobService.mjs has a
 * sibling triggerUserRankSnapshotCapture that calls captureAllUserRankSnapshots
 * directly for testing/admin.
 */

import logger from '../../utils/logger.mjs';
import { captureAllUserRankSnapshots } from '../../modules/leaderboards/index.mjs';

/**
 * Run the nightly UserRankSnapshot capture pass (Equoria-dbdk).
 */
export async function runUserRankSnapshotCapture() {
  try {
    logger.info('[cronJobService] Starting nightly UserRankSnapshot capture...');
    const result = await captureAllUserRankSnapshots();
    logger.info(
      `[cronJobService] UserRankSnapshot capture complete. Snapshots written for ${result.captured} users.`,
    );
    return result;
  } catch (error) {
    logger.error(`[cronJobService] Error in UserRankSnapshot capture: ${error.message}`);
    return { captured: 0, error: error.message };
  }
}

export default Object.freeze({
  jobName: 'userRankSnapshot',
  // Daily at 02:00 UTC.
  schedule: '0 2 * * *',
  lockKey: 'cronJobService:userRankSnapshot',
  run: runUserRankSnapshotCapture,
});
