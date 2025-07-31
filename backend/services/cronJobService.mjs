/**
 * Cron Job Service
 * 
 * Handles scheduled tasks including weekly salary processing
 */

import cron from 'node-cron';
import logger from '../utils/logger.mjs';
import { processWeeklySalaries } from './groomSalaryService.mjs';

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
      timezone: 'UTC'
    });

    runningJobs.set('weeklySalaries', salaryJob);

    // Start all jobs
    salaryJob.start();

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
        scheduled: job.scheduled
      };
    }

    return {
      totalJobs: runningJobs.size,
      jobs: status
    };

  } catch (error) {
    logger.error(`[cronJobService] Error getting cron job status: ${error.message}`);
    return {
      totalJobs: 0,
      jobs: {},
      error: error.message
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
      errors: [error.message]
    };
  }
}
