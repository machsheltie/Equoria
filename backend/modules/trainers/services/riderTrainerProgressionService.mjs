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

/**
 * Increment careerWeeks for every active (non-retired) rider AND trainer.
 * Intended for invocation from a weekly cron, alongside groom career
 * progression. Returns counts for audit logging.
 */
export async function incrementWeeklyCareerWeeks() {
  const [riderResult, trainerResult] = await Promise.all([
    prisma.rider.updateMany({
      where: { retired: false },
      data: { careerWeeks: { increment: 1 } },
    }),
    prisma.trainer.updateMany({
      where: { retired: false },
      data: { careerWeeks: { increment: 1 } },
    }),
  ]);
  logger.info(
    `[riderTrainerProgressionService.incrementWeeklyCareerWeeks] ${riderResult.count} riders + ${trainerResult.count} trainers ticked.`,
  );
  return { ridersTicked: riderResult.count, trainersTicked: trainerResult.count };
}

export default {
  incrementWeeklyCareerWeeks,
};
