/**
 * Cron Job Service
 *
 * Handles scheduled tasks including weekly salary processing
 */

import cron from 'node-cron';
import logger from '../utils/logger.mjs';
import { processWeeklySalaries } from './groomSalaryService.mjs';
import { cleanupExpiredTokens } from '../utils/tokenRotationService.mjs';
import _prisma from '../db/index.mjs';

// Track running jobs
const runningJobs = new Map();

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  try {
    logger.info('[cronJobService] Initializing cron jobs...');

    // Weekly salary processing - Every Monday at 9:00 AM
    const salaryJob = cron.schedule('0 9 * * 1', async () => {
      await runSalaryProcessing();
    }, {
      scheduled: false,
      timezone: 'UTC',
    });

    runningJobs.set('weeklySalaries', salaryJob);

    // Token cleanup - Daily at 3:00 AM (CWE-613: Insufficient Session Expiration)
    const tokenCleanupJob = cron.schedule('0 3 * * *', async () => {
      await runTokenCleanup();
    }, {
      scheduled: false,
      timezone: 'UTC',
    });

    runningJobs.set('tokenCleanup', tokenCleanupJob);

    // Start all jobs
    salaryJob.start();
    tokenCleanupJob.start();

    logger.info('[cronJobService] All cron jobs initialized and started');

  } catch (error) {
    logger.error(`[cronJobService] Error initializing cron jobs: ${error.message}`);
  }
}

/**
 * Run weekly salary processing
 */
async function runSalaryProcessing() {
  try {
    logger.info('[cronJobService] Starting weekly salary processing...');

    const results = await processWeeklySalaries();

    logger.info(`[cronJobService] Weekly salary processing completed. Results: ${JSON.stringify(results)}`);

    // Log summary
    if (results.successful > 0) {
      logger.info(`[cronJobService] Successfully processed $${results.totalAmount} in salaries for ${results.successful} users`);
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

/**
 * Stop all cron jobs
 */
export function stopCronJobs() {
  try {
    logger.info('[cronJobService] Stopping all cron jobs...');

    for (const [jobName, job] of runningJobs.entries()) {
      job.stop();
      logger.info(`[cronJobService] Stopped job: ${jobName}`);
    }

    runningJobs.clear();
    logger.info('[cronJobService] All cron jobs stopped');

  } catch (error) {
    logger.error(`[cronJobService] Error stopping cron jobs: ${error.message}`);
  }
}

/**
 * Get status of all cron jobs
 * @returns {Object} Job status information
 */
export function getCronJobStatus() {
  try {
    const status = {};

    for (const [jobName, job] of runningJobs.entries()) {
      status[jobName] = {
        running: job.running,
        scheduled: job.scheduled,
      };
    }

    return {
      totalJobs: runningJobs.size,
      jobs: status,
    };

  } catch (error) {
    logger.error(`[cronJobService] Error getting cron job status: ${error.message}`);
    return {
      totalJobs: 0,
      jobs: {},
      error: error.message,
    };
  }
}

/**
 * Run token cleanup - Remove expired refresh tokens (CWE-613)
 * Uses tokenRotationService for comprehensive cleanup including expired and old invalidated tokens
 */
async function runTokenCleanup() {
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

    logger.info(`[cronJobService] Token cleanup completed. Removed ${result.removedCount} expired/invalidated tokens`);

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

/**
 * Manually trigger salary processing (for testing/admin use)
 * @returns {Object} Processing results
 */
export async function triggerSalaryProcessing() {
  try {
    logger.info('[cronJobService] Manually triggering salary processing...');

    const results = await processWeeklySalaries();

    logger.info(`[cronJobService] Manual salary processing completed: ${JSON.stringify(results)}`);

    return results;

  } catch (error) {
    logger.error(`[cronJobService] Error in manual salary processing: ${error.message}`);
    return {
      processed: 0,
      successful: 0,
      failed: 1,
      terminated: 0,
      totalAmount: 0,
      errors: [error.message],
    };
  }
}

/**
 * Manually trigger token cleanup (for testing/admin use)
 * @returns {Object} Cleanup results
 */
export async function triggerTokenCleanup() {
  try {
    logger.info('[cronJobService] Manually triggering token cleanup...');

    const results = await runTokenCleanup();

    logger.info(`[cronJobService] Manual token cleanup completed: ${JSON.stringify(results)}`);

    return results;

  } catch (error) {
    logger.error(`[cronJobService] Error in manual token cleanup: ${error.message}`);
    return {
      removed: 0,
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}
