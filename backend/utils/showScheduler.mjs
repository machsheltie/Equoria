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
const INITIAL_DELAY_MS = 60 * 1000; // Let Railway health checks and pool startup settle.

let schedulerTimer = null;
let initialRunTimer = null;

export function startShowScheduler() {
  if (schedulerTimer) {
    return;
  } // already running

  logger.info('Show scheduler started (10-minute poll interval, first run delayed 60 seconds)');

  async function runCycle() {
    try {
      await executeClosedShows(null, null);
    } catch (error) {
      logger.error('Show scheduler cycle error:', error);
    }
  }

  // Delay the first DB-heavy cycle so startup health checks do not compete
  // with background jobs for Supabase Session-mode pool clients.
  initialRunTimer = setTimeout(() => {
    initialRunTimer = null;
    runCycle();
  }, INITIAL_DELAY_MS);
  schedulerTimer = setInterval(runCycle, POLL_INTERVAL_MS);
}

export function stopShowScheduler() {
  if (initialRunTimer) {
    clearTimeout(initialRunTimer);
    initialRunTimer = null;
  }

  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info('Show scheduler stopped');
  }
}
