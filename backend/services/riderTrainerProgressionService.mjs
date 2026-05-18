/**
 * Rider + Trainer Career Progression Service (Equoria-r1nr)
 *
 * Models had experience/level/careerWeeks/prestige columns since launch,
 * but no code path ever incremented them. This service supplies the XP
 * awards, level recompute, and career-week ticker used by:
 *   - showController (post-show rider XP / prestige on placement)
 *   - trainHorse (post-session trainer XP)
 *   - a weekly cron (riders + trainers career-week++ alongside groom progression)
 *
 * Mirrors the design of groomProgressionService — same level curve (100*level
 * per level, cap at 10) so XP semantics stay uniform across NPC entities.
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

const LEVEL_CAP = 10;

/**
 * XP curve: identical to groom progression (100*level per level).
 * Level 1: 0-99, Level 2: 100-299, Level 3: 300-599, etc.
 */
export function calculateLevel(experience) {
  if (experience < 100) {
    return 1;
  }
  let total = 0;
  for (let level = 1; level <= LEVEL_CAP; level++) {
    const xpForLevel = 100 * level;
    if (experience < total + xpForLevel) {
      return level;
    }
    total += xpForLevel;
  }
  return LEVEL_CAP;
}

/**
 * XP rewards for rider events (per AC: per competition, per win, by placement).
 * Tuned conservatively so a casual rider hits L2 around ~10 competitions and
 * a competitive winner hits L5 within ~30-40 placements.
 */
export const RIDER_XP_REWARDS = {
  competition_entered: 5,
  placement_1st: 25,
  placement_2nd: 15,
  placement_3rd: 10,
  placement_top10: 5,
};

/**
 * Prestige bumps for rider wins. Capped at 100.
 */
export const RIDER_PRESTIGE_BUMPS = {
  placement_1st: 2,
  placement_2nd: 1,
};

export const TRAINER_XP_REWARDS = {
  session_completed: 5,
  stat_gain_session: 10, // bonus when the training session actually moved a stat
};

/**
 * Generic level-recompute updater for either prisma.rider or prisma.trainer.
 * Awards XP, optionally bumps prestige (rider only), recomputes level.
 *
 * @param {object} client - prisma.rider | prisma.trainer
 * @param {string} kind - 'rider' | 'trainer' (for logging)
 * @param {number} id
 * @param {string} source - free-form source identifier for the log line
 * @param {number} xpAmount
 * @param {number} [prestigeAmount] - optional prestige delta (rider only)
 * @returns {Promise<object|null>} updated record or null on failure
 */
async function awardXpAndRecomputeLevel(client, kind, id, source, xpAmount, prestigeAmount = 0) {
  try {
    const current = await client.findUnique({
      where: { id },
      select: {
        id: true,
        experience: true,
        level: true,
        ...(kind === 'rider' ? { prestige: true } : {}),
      },
    });
    if (!current) {
      logger.warn(
        `[riderTrainerProgressionService] ${kind} ${id} not found — XP award (${xpAmount}) skipped.`,
      );
      return null;
    }
    const oldExp = current.experience || 0;
    const oldLevel = current.level || 1;
    const newExp = oldExp + xpAmount;
    const newLevel = calculateLevel(newExp);

    const data = { experience: newExp, level: newLevel };
    if (kind === 'rider' && prestigeAmount > 0) {
      const oldPrestige = current.prestige || 0;
      data.prestige = Math.max(0, Math.min(100, oldPrestige + prestigeAmount));
    }

    const updated = await client.update({ where: { id }, data });
    if (newLevel > oldLevel) {
      logger.info(
        `[riderTrainerProgressionService] ${kind} ${id} LEVEL UP: ${oldLevel} → ${newLevel} (+${xpAmount} XP, source=${source}).`,
      );
    } else {
      logger.info(
        `[riderTrainerProgressionService] ${kind} ${id} gained ${xpAmount} XP (${oldExp} → ${newExp}, source=${source}).`,
      );
    }
    return updated;
  } catch (error) {
    logger.error(
      `[riderTrainerProgressionService] Failed to award ${kind} XP for ${id} (source=${source}): ${error.message}`,
    );
    return null;
  }
}

/**
 * Award rider XP for a competition result.
 * @param {number} riderId
 * @param {number} placement - 1 = win, 2/3 = podium, > 10 = ignored for placement XP
 * @returns {Promise<object|null>}
 */
export async function awardRiderCompetitionXP(riderId, placement) {
  let xp = RIDER_XP_REWARDS.competition_entered;
  let prestige = 0;
  let sourceTag = 'competition';
  if (placement === 1) {
    xp += RIDER_XP_REWARDS.placement_1st;
    prestige = RIDER_PRESTIGE_BUMPS.placement_1st;
    sourceTag = 'placement_1st';
  } else if (placement === 2) {
    xp += RIDER_XP_REWARDS.placement_2nd;
    prestige = RIDER_PRESTIGE_BUMPS.placement_2nd;
    sourceTag = 'placement_2nd';
  } else if (placement === 3) {
    xp += RIDER_XP_REWARDS.placement_3rd;
    sourceTag = 'placement_3rd';
  } else if (typeof placement === 'number' && placement >= 4 && placement <= 10) {
    xp += RIDER_XP_REWARDS.placement_top10;
    sourceTag = 'placement_top10';
  }
  return awardXpAndRecomputeLevel(prisma.rider, 'rider', riderId, sourceTag, xp, prestige);
}

/**
 * Award trainer XP for a completed training session.
 * @param {number} trainerId
 * @param {boolean} statGain - true if the session actually moved a horse stat
 * @returns {Promise<object|null>}
 */
export async function awardTrainerSessionXP(trainerId, statGain = false) {
  const xp =
    TRAINER_XP_REWARDS.session_completed + (statGain ? TRAINER_XP_REWARDS.stat_gain_session : 0);
  const sourceTag = statGain ? 'training_stat_gain' : 'training_session';
  return awardXpAndRecomputeLevel(prisma.trainer, 'trainer', trainerId, sourceTag, xp);
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
  calculateLevel,
  awardRiderCompetitionXP,
  awardTrainerSessionXP,
  incrementWeeklyCareerWeeks,
  RIDER_XP_REWARDS,
  RIDER_PRESTIGE_BUMPS,
  TRAINER_XP_REWARDS,
};
