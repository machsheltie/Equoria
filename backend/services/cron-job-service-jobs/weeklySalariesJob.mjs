/**
 * Weekly staff pay-week end (Equoria-hc96y; registry entry consumed by
 * initializeCronJobs() in cronJobService.mjs).
 *
 * Owner rulings 2026-10-28 (q262/q265 notes) and 2026-10-29 (q268): payday is a player
 * action — the player presses Pay Groom / Pay Rider any time during the week — and the
 * week ends Sunday midnight Eastern, then the unpaid rules apply. So this job TAKES NO
 * MONEY. Just after Sunday 00:00 Eastern it settles the pay week that has just ended:
 * every groom or rider left unpaid for it gets the existing consequence (the week is
 * owed and they cannot work or ride until paid; one already unpaid for an earlier week
 * leaves for the hiring pool).
 *
 * Old contract: every Monday 09:00 Eastern this job took every groom's and rider's
 * weekly pay from the player automatically. The owner's manual groom payday (q262,
 * POST /api/v1/staff/payroll/grooms/run behind the emailed staff check-in) is unchanged.
 *
 * The job name and lock key are kept so the heartbeat history and health checks carry on.
 */

import logger from '../../utils/logger.mjs';
import { settleEndedGroomPayWeek } from '../../modules/grooms/index.mjs';
import { settleEndedRiderPayWeek } from '../../modules/riders/index.mjs';

/** Settle the pay week that has just ended, for grooms and then riders. */
export async function runSalaryProcessing() {
  // Each pass in its own try, so a groom-pass failure never skips the riders, nor the reverse.
  try {
    const results = await settleEndedGroomPayWeek();
    logger.info(`[cronJobService] Groom pay week settled: ${JSON.stringify(results)}`);
  } catch (error) {
    logger.error(`[cronJobService] Error settling the groom pay week: ${error.message}`);
  }
  try {
    const results = await settleEndedRiderPayWeek();
    logger.info(`[cronJobService] Rider pay week settled: ${JSON.stringify(results)}`);
  } catch (error) {
    logger.error(`[cronJobService] Error settling the rider pay week: ${error.message}`);
  }
}

export default Object.freeze({
  jobName: 'weeklySalaries',
  // Sunday 00:07 Eastern: just after the pay week ends at Sunday midnight. Not 00:05 —
  // that minute is dailyHorseAging's, and the cron collision sentinel keeps every
  // locked job on its own start minute (Equoria-bvddn.15). 00:07 is free every day.
  schedule: '7 0 * * 0',
  lockKey: 'cronJobService:weeklySalaries',
  // Heartbeat staleness budget (Equoria-cmw85.9): 168h period + 24h tolerance, as the primary registry.
  staleAfterMs: 192 * 60 * 60 * 1000,
  run: runSalaryProcessing,
});
