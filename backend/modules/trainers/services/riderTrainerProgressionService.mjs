/**
 * Rider + Trainer Career Progression Service (Equoria-r1nr)
 *
 * Owner ruling 2026-10-21 (Equoria-dea06): trainers, riders and grooms are
 * game-generated NPCs. They never earn XP from training sessions, shows or
 * grooming, and each keeps the level it was generated with. The XP awards and
 * the XP-to-level recompute that used to live here are gone; the `experience`
 * and `level` columns are no longer written after a staff member is created.
 *
 * What remains:
 *   - a rider's prestige bump for a 1st/2nd place finish (showExecutionService).
 *     Prestige is not XP; whether it should still grow is an open owner
 *     question on Equoria-dea06, so its behaviour is unchanged.
 *   - the weekly career-week ticker (retentionMaintenance job).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Prestige bumps for rider wins. Capped at 100.
 */
export const RIDER_PRESTIGE_BUMPS = {
  placement_1st: 2,
  placement_2nd: 1,
};

const PRESTIGE_CAP = 100;

/**
 * Bump a rider's prestige for a 1st or 2nd place finish. Any other placement is
 * a no-op. Writes only `prestige` — never experience or level.
 * Fail-soft: returns null on failure so a show is never blocked by it.
 *
 * @param {number} riderId
 * @param {number} placement - 1 = win, 2 = second; anything else adds nothing
 * @returns {Promise<object|null>} the updated rider, the unchanged rider for a
 *   placement that earns nothing, or null when the rider is missing or the
 *   write failed
 */
export async function awardRiderCompetitionPrestige(riderId, placement) {
  const bump =
    placement === 1
      ? RIDER_PRESTIGE_BUMPS.placement_1st
      : placement === 2
        ? RIDER_PRESTIGE_BUMPS.placement_2nd
        : 0;
  try {
    const current = await prisma.rider.findUnique({
      where: { id: riderId },
      select: { id: true, prestige: true },
    });
    if (!current) {
      logger.warn(
        `[riderTrainerProgressionService] rider ${riderId} not found — prestige bump (${bump}) skipped.`,
      );
      return null;
    }
    if (bump === 0) {
      return current;
    }
    const prestige = Math.max(0, Math.min(PRESTIGE_CAP, (current.prestige || 0) + bump));
    return await prisma.rider.update({ where: { id: riderId }, data: { prestige } });
  } catch (error) {
    logger.error(
      `[riderTrainerProgressionService] Failed to bump prestige for rider ${riderId}: ${error.message}`,
    );
    return null;
  }
}

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
  awardRiderCompetitionPrestige,
  incrementWeeklyCareerWeeks,
  RIDER_PRESTIGE_BUMPS,
};
