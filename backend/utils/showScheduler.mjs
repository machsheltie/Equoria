/**
 * showScheduler (BA-4)
 *
 * Polls every 10 minutes for shows whose closeDate has passed.
 * Delegates execution to showController.executeClosedShows.
 *
 * Usage: import and call startShowScheduler() once at app startup.
 */

import logger from './logger.mjs';
import { executeClosedShows } from '../controllers/showController.mjs';

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let schedulerTimer = null;

export function startShowScheduler() {
  if (schedulerTimer) return; // already running

  logger.info('Show scheduler started (10-minute poll interval)');

  async function runCycle() {
    try {
      await executeClosedShows(null, null);
    } catch (error) {
      logger.error('Show scheduler cycle error:', error);
    }
  }

  // Run once immediately on startup, then on interval
  runCycle();
  schedulerTimer = setInterval(runCycle, POLL_INTERVAL_MS);
}

export function stopShowScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info('Show scheduler stopped');
  }
}
