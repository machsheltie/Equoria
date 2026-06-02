/**
 * Cron Job Service
 *
 * Handles scheduled tasks including weekly salary processing.
 *
 * Equoria-1j167: the 5 inline `cron.schedule(...)` blocks that used to live in
 * initializeCronJobs() were extracted into a per-job descriptor registry under
 * backend/services/cron-job-service-jobs/ (mirroring the fx4e7
 * backend/services/jobs/ registry, adapted for this FUNCTION-based service
 * rather than the CronJobService class). initializeCronJobs() now loops the
 * registry to build + start the jobs; the schedules, advisory locks, canonical
 * job names, getCronJobStatus() shape, and legacyCronJobs.start()/stop()
 * delegation are all preserved byte-for-byte.
 */

import cron from 'node-cron';
import logger from '../utils/logger.mjs';
import { processWeeklySalaries } from '../modules/grooms/index.mjs';
import { runFoalingJob } from '../modules/horses/index.mjs';
import { processRiderTrainerRetirement } from '../modules/trainers/index.mjs';
import { captureAllUserRankSnapshots } from '../modules/leaderboards/index.mjs';
// Equoria-dx65z: every cron handler in this file now runs under a Postgres
// advisory lock from withAdvisoryLock — multi-replica deployments cannot
// double-execute. Sibling of Equoria-iot0h which introduced the helper.
import { withAdvisoryLock } from '../utils/cronLock.mjs';
import legacyCronJobs from './cronJobs.mjs';
// Equoria-1j167: per-job descriptors (jobName/schedule/lockKey/run) + the
// runTokenCleanup work function (re-exported below as triggerTokenCleanup uses
// it). The registry preserves the original runningJobs.set(...) order.
import CRON_JOB_SERVICE_REGISTRY from './cron-job-service-jobs/index.mjs';
import { runTokenCleanup } from './cron-job-service-jobs/tokenCleanupJob.mjs';

// Track running jobs
const runningJobs = new Map();

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  try {
    logger.info('[cronJobService] Initializing cron jobs...');

    // Build + register every job from the descriptor registry. Each job runs
    // its work function under the descriptor's advisory lock, on the
    // descriptor's UTC schedule. `scheduled: false` then explicit .start()
    // matches the pre-split create-then-start sequence exactly.
    for (const descriptor of CRON_JOB_SERVICE_REGISTRY) {
      const { jobName, schedule, lockKey, run } = descriptor;
      const job = cron.schedule(
        schedule,
        async () => {
          await withAdvisoryLock(lockKey, run);
        },
        {
          scheduled: false,
          timezone: 'UTC',
        },
      );
      runningJobs.set(jobName, job);
    }

    // Start all jobs (insertion order = registry order).
    for (const job of runningJobs.values()) {
      job.start();
    }

    // Start trait evaluation + horse aging jobs (defined in cronJobs.mjs)
    legacyCronJobs.start();

    logger.info('[cronJobService] All cron jobs initialized and started');
  } catch (error) {
    logger.error(`[cronJobService] Error initializing cron jobs: ${error.message}`);
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

    // Stop trait evaluation + horse aging jobs (defined in cronJobs.mjs)
    legacyCronJobs.stop();

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
 * Manually trigger the rider/trainer auto-retirement pass (for testing/admin).
 * @returns {Promise<Object>} Processing results
 */
export async function triggerRiderTrainerRetirement() {
  return processRiderTrainerRetirement();
}

/**
 * Manually trigger the UserRankSnapshot capture pass (for testing/admin).
 * @returns {Promise<Object>} Capture results
 */
export async function triggerUserRankSnapshotCapture() {
  return captureAllUserRankSnapshots();
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
 * Manually trigger the foaling job (for testing/admin use)
 * @returns {Promise<{foalsBorn:number, errors:Array}>}
 */
export async function triggerFoalingJob() {
  try {
    logger.info('[cronJobService] Manually triggering foaling job...');
    const results = await runFoalingJob();
    logger.info(`[cronJobService] Manual foaling job completed: ${JSON.stringify(results)}`);
    return results;
  } catch (error) {
    logger.error(`[cronJobService] Error in manual foaling job: ${error.message}`);
    return { foalsBorn: 0, errors: [{ damId: null, error: error.message }] };
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
