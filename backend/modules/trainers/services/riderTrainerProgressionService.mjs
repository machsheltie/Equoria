/**
 * Rider + Trainer Career Progression Service (Equoria-r1nr)
 *
 * Owner ruling 2026-10-21 (Equoria-dea06): trainers, riders and grooms are
 * game-generated NPCs. They never earn XP from training sessions, shows or
 * grooming, and each keeps the level it was generated with. The XP awards and
 * the XP-to-level recompute that used to live here are gone; the `experience`
 * and `level` columns are no longer written after a staff member is created.
 *
 * Owner ruling 2026-10-22 (Equoria-0d4wa): a rider's prestige also stays at
 * its generated value - wins never raise it - so the 1st/2nd prestige bump is
 * gone too. The show bonus still reads the fixed prestige (utils/riderBonus.mjs).
 *
 * What remains: the weekly career-week ticker (retentionMaintenance job).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { tickEveryActiveStaff } from '../../../utils/staffCareerTicks.mjs';

/**
 * Increment careerWeeks for every active (non-retired) rider AND trainer.
 * Intended for invocation from a weekly cron, alongside groom career
 * progression. Returns counts for audit logging.
 *
 * Equoria-puj1e.5 (Codex r2 #3): each half adds its weeks and records them in
 * one statement, so the record matches what committed even when one half fails
 * after the other committed. Both halves always finish before the pass reports,
 * and a failure in either fails the pass (the run log says 'error').
 */
export async function incrementWeeklyCareerWeeks() {
  const at = new Date();
  const [riders, trainers] = await Promise.allSettled([
    tickEveryActiveStaff(prisma, 'rider', at),
    tickEveryActiveStaff(prisma, 'trainer', at),
  ]);
  const failed = [riders, trainers].find(half => half.status === 'rejected');
  if (failed) {
    const outcome = half => (half.status === 'fulfilled' ? `${half.value} aged` : 'failed');
    logger.error(
      `[riderTrainerProgressionService.incrementWeeklyCareerWeeks] riders ${outcome(riders)}, trainers ${outcome(trainers)}.`,
    );
    throw failed.reason;
  }
  logger.info(
    `[riderTrainerProgressionService.incrementWeeklyCareerWeeks] ${riders.value} riders + ${trainers.value} trainers ticked.`,
  );
  return { ridersTicked: riders.value, trainersTicked: trainers.value };
}

export default {
  incrementWeeklyCareerWeeks,
};
