/**
 * Groom career-progression cluster (Equoria-m9lz1).
 *
 * Holds the weekly groom career-progression + auto-retirement work, extracted out
 * of the CronJobService class so the orchestrator (backend/services/cronJobs.mjs)
 * stays a thin scheduler + heartbeat + persistence + health surface, matching the
 * fx4e7 impl convention used by horseAging, flagEvaluation and friends.
 *
 * WHY THIS EXISTS AT ALL
 *   The owner ruled (2026-09-08) that "grooms retire automatically at a randomly
 *   selected age by the game". `processWeeklyCareerProgression` is the only thing
 *   that advances a groom's career age and therefore the only thing that can ever
 *   retire one, and before this job it sat in NO cron registry — so no groom's
 *   `careerWeeks` advanced and no groom ever retired. The player-facing retirement
 *   trigger is closed (403) precisely because this pass is meant to be the whole
 *   mechanism.
 *
 * NO log-then-rethrow WRAPPER (Equoria-ej9k1): this delegates and returns. The
 * orchestrator's `runWithHeartbeat` already logs job failures with the job key
 * and full context, and records the failure on the CronRunLog row; a local
 * catch-log-rethrow would double-log and add nothing. Per-groom failures never
 * reach here — `processWeeklyCareerProgression` collects those internally and
 * keeps going, so an error at this level means the pass could not start.
 *
 * NO date arithmetic here (CLAUDE.md / Equoria-vdw5): the career-age tick and the
 * hidden-retirement-age comparison both live in
 * modules/grooms/services/groomRetirementService.mjs. This module is only the
 * wrapper.
 */

import logger from '../../../utils/logger.mjs';
import { processWeeklyCareerProgression } from '../../../modules/grooms/index.mjs';

/**
 * Weekly groom career-progression + auto-retirement pass.
 *
 * Per non-retired active groom: draw and persist the hidden retirement age if it
 * has none yet, advance `careerWeeks` by one game-year, and retire the groom if
 * it has reached that age — ending its active assignments and notifying the
 * player inside one transaction.
 *
 * @returns {Promise<Object>} the processWeeklyCareerProgression result
 *   ({ processed, retired, scheduled, errors, retirements }).
 */
export async function runGroomCareerProgression() {
  logger.info('[CronJobService.runGroomCareerProgression] Starting weekly groom career pass');

  const result = await processWeeklyCareerProgression();

  logger.info(
    `[CronJobService.runGroomCareerProgression] Completed: ${result.processed} processed, ` +
      `${result.retired} retired, ${result.scheduled} newly scheduled, ` +
      `${result.errors.length} errors`,
  );

  return result;
}
