/**
 * Token cleanup job descriptor (Equoria-1j167 cronJobService split).
 *
 * Registry entry consumed by initializeCronJobs() in cronJobService.mjs.
 * Behaviour identical to the pre-split inline `cron.schedule('0 3 * * *', ...)`:
 * Daily 03:00 UTC, advisory-locked under 'cronJobService:tokenCleanup'.
 * Removes expired refresh tokens (CWE-613: Insufficient Session Expiration).
 *
 * `runTokenCleanup` stays the work function; cronJobService.mjs re-exports it
 * via triggerTokenCleanup for testing/admin use.
 */

import logger from '../../utils/logger.mjs';
import { cleanupExpiredTokens } from '../../utils/tokenRotationService.mjs';

/**
 * Run token cleanup - Remove expired refresh tokens (CWE-613)
 * Uses tokenRotationService for comprehensive cleanup including expired and old invalidated tokens
 */
export async function runTokenCleanup() {
  try {
    logger.info('[cronJobService] Starting expired token cleanup...');

    // Use tokenRotationService for comprehensive cleanup
    // This removes both expired tokens AND old invalidated tokens (30+ days)
    const result = await cleanupExpiredTokens({ olderThanDays: 30 });

    if (result.error) {
      logger.error(`[cronJobService] Token cleanup error: ${result.error}`);
      return {
        removed: 0,
        timestamp: new Date().toISOString(),
        error: result.error,
      };
    }

    logger.info(
      `[cronJobService] Token cleanup completed. Removed ${result.removedCount} expired/invalidated tokens`,
    );

    return {
      removed: result.removedCount,
      expired: result.expiredCount,
      invalidated: result.invalidatedCount,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`[cronJobService] Error in token cleanup: ${error.message}`);
    return {
      removed: 0,
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}

export default Object.freeze({
  jobName: 'tokenCleanup',
  // Daily at 03:00 UTC.
  schedule: '0 3 * * *',
  lockKey: 'cronJobService:tokenCleanup',
  run: runTokenCleanup,
});
