/**
 * Groom Legacy Service
 *
 * This service handles the legacy replacement system where retired high-level grooms
 * can mentor new hires (protégés) who inherit perks and bonuses.
 *
 * Legacy Rules:
 * - Only retired grooms level 7+ are eligible
 * - Each retired groom can only create one legacy protégé
 * - Protégés inherit one random perk from mentor's personality type
 * - Protégés start with bonus experience and slight stat bonuses
 * - Legacy relationships are permanently tracked
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
// Equoria-ypb7d fix round 1 (F8): a legacy protégé is a THIRD groom-creation path
// alongside the two hire controllers, and it was left unmigrated. A protégé born with
// no `startAge` breaks invariant A1 ("drawn once at creation or hire"), and one born
// with a `userId` but no engagement row breaks invariant E1 ("`Groom.userId IS NOT
// NULL` <=> an open engagement row exists"). Both self-healed via the weekly
// backstops, so the damage was bounded to a window rather than permanent — but
// "self-heals incidentally" is not the same as "is correct at birth", and relying on a
// backstop without saying so is how an invariant quietly stops being one.
import { drawStartAge } from './groomAgeService.mjs';
import { openEngagementTx } from './groomEngagementService.mjs';

/**
 * Legacy system constants
 */
export const LEGACY_CONSTANTS = {
  MINIMUM_MENTOR_LEVEL: 7,
  PROTEGE_EXPERIENCE_BONUS: 50,
  PROTEGE_LEVEL_BONUS: 1,
  PROTEGE_SKILL_BONUS: 0.1, // 10% bonus to starting skills
};

/**
 * Legacy perks by personality type
 * Each perk provides specific bonuses to the protégé
 */
export const LEGACY_PERKS = {
  calm: [
    {
      id: 'gentle_hands',
      name: 'Gentle Hands',
      description: 'Inherited gentle touch technique',
      effect: { bondingBonus: 0.05, stressReduction: 0.1 },
    },
    {
      id: 'empathic_sync',
      name: 'Empathic Sync',
      description: 'Natural ability to read horse emotions',
      effect: { milestoneAccuracy: 0.1, reactiveHorseBonus: 0.15 },
    },
    {
      id: 'patience_mastery',
      name: 'Patience Mastery',
      description: 'Exceptional patience with difficult horses',
      effect: { burnoutResistance: 0.2, consistencyBonus: 0.1 },
    },
  ],
  energetic: [
    {
      id: 'playtime_pro',
      name: 'Playtime Pro',
      description: 'Expert at engaging horses through play',
      effect: { milestoneVariety: 0.1, curiosityBonus: 0.15 },
    },
    {
      id: 'fear_buster',
      name: 'Fear Buster',
      description: 'Specialized in building horse confidence',
      effect: { braveryChance: 0.15, confidenceBonus: 0.2 },
    },
    {
      id: 'energy_channeling',
      name: 'Energy Channeling',
      description: 'Ability to direct horse energy positively',
      effect: { hyperactiveBonus: 0.2, focusImprovement: 0.1 },
    },
  ],
  methodical: [
    {
      id: 'data_driven',
      name: 'Data Driven',
      description: 'Systematic approach to trait development',
      effect: { traitAccuracy: 0.05, analysisBonus: 0.1 },
    },
    {
      id: 'memory_builder',
      name: 'Memory Builder',
      description: 'Exceptional at building horse-groom synergy',
      effect: { synergyRate: 0.2, memoryBonus: 0.15 },
    },
    {
      id: 'precision_training',
      name: 'Precision Training',
      description: 'Meticulous attention to training details',
      effect: { taskQuality: 0.1, precisionBonus: 0.15 },
    },
  ],
};

/**
 * Check if a retired groom is eligible for legacy creation
 * @param {number} groomId - ID of the retired groom
 * @returns {Promise<Object>} Eligibility status and details
 */
export async function checkLegacyEligibility(groomId) {
  const groom = await prisma.groom.findUnique({
    where: { id: groomId },
    include: {
      groomAssignmentLogs: true,
    },
  });

  if (!groom) {
    return {
      eligible: false,
      reason: 'groom_not_found',
    };
  }

  // Check if groom is retired
  if (!groom.retired) {
    return {
      eligible: false,
      reason: 'not_retired',
      level: groom.level,
    };
  }

  // Check minimum level requirement
  if (groom.level < LEGACY_CONSTANTS.MINIMUM_MENTOR_LEVEL) {
    return {
      eligible: false,
      reason: 'insufficient_level',
      level: groom.level,
      requiredLevel: LEGACY_CONSTANTS.MINIMUM_MENTOR_LEVEL,
    };
  }

  // Check if legacy already exists
  const existingLegacy = await prisma.groomLegacyLog.findFirst({
    where: { retiredGroomId: groomId },
  });

  if (existingLegacy) {
    return {
      eligible: false,
      reason: 'legacy_already_created',
      existingLegacyId: existingLegacy.id,
    };
  }

  // Get available perks for this groom's personality
  const availablePerks = getLegacyPerks(groom.personality);

  return {
    eligible: true,
    level: groom.level,
    experience: groom.experience,
    personality: groom.personality,
    assignmentCount: groom.groomAssignmentLogs.length,
    availablePerks,
  };
}

/**
 * Generate a legacy protégé from a retired mentor groom
 * @param {number} mentorGroomId - ID of the mentor groom
 * @param {Object} protegeData - Data for the new protégé groom
 * @param {string} userId - ID of the user hiring the protégé
 * @returns {Promise<Object>} Created protégé and legacy information
 */
export async function generateLegacyProtege(mentorGroomId, protegeData, userId) {
  // Check eligibility first
  const eligibility = await checkLegacyEligibility(mentorGroomId);
  if (!eligibility.eligible) {
    throw new Error(
      `Mentor groom ${mentorGroomId} is not eligible for legacy creation: ${eligibility.reason}`,
    );
  }

  // Get mentor groom details
  const mentorGroom = await prisma.groom.findUnique({
    where: { id: mentorGroomId },
  });

  // Select random perk from available perks
  const availablePerks = getLegacyPerks(mentorGroom.personality);
  const selectedPerk = availablePerks[Math.floor(Math.random() * availablePerks.length)];

  // Calculate protégé bonuses
  const experienceBonus = LEGACY_CONSTANTS.PROTEGE_EXPERIENCE_BONUS;
  const levelBonus = LEGACY_CONSTANTS.PROTEGE_LEVEL_BONUS;

  // Create protégé and legacy log in transaction
  const result = await withRetryableTxMapping(
    prisma.$transaction(async prismaTx => {
      // Create the protégé groom.
      // Equoria-tu4k9: legacy protégés are INTENTIONALLY EXEMPT from
      // MAX_GROOMS_PER_USER (product decision, 2026-07-03). Unlike the two hire
      // paths — hireGroom (Equoria-n4m5j) and hireFromMarketplace
      // (Equoria-hduc5) — which enforce the roster cap, generating a protégé
      // from a retired mentor is a legacy reward that MAY take a user above the
      // normal cap. The absence of a cap guard here is DELIBERATE; do not add
      // one (it would break the intended reward).
      const protege = await prismaTx.groom.create({
        data: {
          name: protegeData.name,
          personality: protegeData.personality,
          skillLevel: protegeData.skillLevel,
          speciality: protegeData.speciality,
          userId,
          experience: experienceBonus,
          level: 1 + levelBonus,
          sessionRate: protegeData.sessionRate || 15.0,
          bio: protegeData.bio || `Protégé of ${mentorGroom.name}`,
          availability: protegeData.availability || {},
          // Equoria-ypb7d.1 (F8): a protégé enters the game at an age like anyone
          // else, drawn from the same 18..24 band. Deliberately NOT inherited from
          // or related to the mentor: the owner's addendum forbids anything but
          // chance influencing retirement timing, and a protégé of an old mentor
          // starting old would be exactly that. Their retirement age is still drawn
          // by the weekly pass's `ensureRetirementDrawn` backstop, because this
          // service must not handle that value at all (the hiding doctrine).
          startAge: drawStartAge(),
          // Add legacy bonus to bonus trait map
          bonusTraitMap: {
            legacyPerk: selectedPerk.id,
            legacyMentor: mentorGroom.name,
            ...selectedPerk.effect,
          },
        },
      });

      // Equoria-ypb7d.2 (F8): a protégé arrives ON A PLAYER'S STAFF, so the
      // engagement that says so is opened here, in the same transaction as the
      // groom — not left to the fee pass's `ensureEngagementTx` backstop to
      // discover next Monday. Same rule as both hire paths.
      await openEngagementTx(prismaTx, protege.id, userId);

      // Create legacy log
      const legacyLog = await prismaTx.groomLegacyLog.create({
        data: {
          retiredGroomId: mentorGroomId,
          legacyGroomId: protege.id,
          inheritedPerk: selectedPerk.id,
          mentorLevel: mentorGroom.level,
        },
      });

      return { protege, legacyLog, inheritedPerk: selectedPerk };
    }),
    { message: 'Groom legacy service is busy right now, please retry in a moment.' },
  );

  logger.info(
    `Created legacy protégé ${result.protege.name} (ID: ${result.protege.id}) from mentor ${mentorGroom.name} (ID: ${mentorGroomId})`,
  );
  logger.info(`Inherited perk: ${result.inheritedPerk.name}`);

  return result;
}

/**
 * Get available legacy perks for a personality type
 * @param {string} personality - Personality type (calm, energetic, methodical)
 * @returns {Array} Array of available perks
 */
export function getLegacyPerks(personality) {
  return LEGACY_PERKS[personality] || [];
}

/**
 * Create a legacy log entry (for manual tracking)
 * @param {number} retiredGroomId - ID of retired mentor groom
 * @param {number} legacyGroomId - ID of protégé groom
 * @param {string} inheritedPerk - ID of inherited perk
 * @param {number} mentorLevel - Level of mentor at retirement
 * @returns {Promise<Object>} Created legacy log
 */
export async function createLegacyLog(retiredGroomId, legacyGroomId, inheritedPerk, mentorLevel) {
  const legacyLog = await prisma.groomLegacyLog.create({
    data: {
      retiredGroomId,
      legacyGroomId,
      inheritedPerk,
      mentorLevel,
    },
  });

  logger.info(
    `Created legacy log: Groom ${legacyGroomId} inherits ${inheritedPerk} from mentor ${retiredGroomId}`,
  );
  return legacyLog;
}

/**
 * Get legacy history for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of legacy relationships
 */
export async function getUserLegacyHistory(userId) {
  const legacyLogs = await prisma.groomLegacyLog.findMany({
    where: {
      retiredGroom: { userId },
    },
    include: {
      retiredGroom: {
        select: { id: true, name: true, level: true, personality: true },
      },
      legacyGroom: {
        select: { id: true, name: true, level: true, experience: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return legacyLogs.map(log => ({
    id: log.id,
    retiredGroomId: log.retiredGroomId,
    retiredGroomName: log.retiredGroom.name,
    retiredGroomLevel: log.retiredGroom.level,
    protegeGroomId: log.legacyGroomId,
    protegeGroomName: log.legacyGroom.name,
    protegeGroomLevel: log.legacyGroom.level,
    inheritedPerk: log.inheritedPerk,
    mentorLevel: log.mentorLevel,
    createdAt: log.createdAt,
  }));
}

/**
 * Equoria-c0vo: Auto-create a GroomLegacyLog when a mentor-eligible groom retires.
 *
 * Eligibility: retiring groom level >= LEGACY_CONSTANTS.MINIMUM_MENTOR_LEVEL (7).
 * Protégé selection: lowest-level active (non-retired) groom of the same user,
 * excluding the retiring groom itself, that is not already a legacy protégé.
 * If no eligible protégé exists yet, returns null and logs an info message —
 * the user can still trigger generateLegacyProtege manually when they hire a
 * new groom.
 *
 * Called by groomRetirementService.processRetirement AFTER its transaction
 * commits, never inside it: a legacy log is a bonus, and failing to create one
 * must not undo a retirement the player has already been notified of.
 *
 * @param {Object} retiredGroom - The freshly retired groom record (must include id, userId, level, personality)
 * @returns {Promise<Object|null>} The created legacy log, or null if not eligible / no protégé.
 */
export async function autoCreateLegacyOnRetirement(retiredGroom) {
  if (!retiredGroom || retiredGroom.level < LEGACY_CONSTANTS.MINIMUM_MENTOR_LEVEL) {
    return null;
  }

  // Equoria-m9lz1 fix round 3: a groom with NO ENGAGEMENT — a free agent — has no
  // stable to leave a legacy to. `Groom.userId` is `String?`, and the protégé query
  // below filters `userId: retiredGroom.userId` — which Prisma compiles to
  // `WHERE "userId" IS NULL` when that value is null, so null stops identifying
  // ONE player's staff and becomes a matching key across EVERY free agent in the
  // database (62 of them locally when this guard was added). The game would then
  // pair two grooms who share nothing but the absence of an engagement as mentor
  // and protégé, and write a legacy log no player can ever see. A mentorship needs
  // a stable; without one there is nothing to pass on, so skip — beside the level
  // guard, and for the same reason: not eligible, not an error.
  //
  // Equoria-ypb7d.2 corrected the vocabulary here: this comment said "OWNERLESS",
  // "this groom's owner" and "ownerless groom", five ownership words for a relation
  // that is an ENGAGEMENT. Players never own grooms. The guard itself is unchanged —
  // `!retiredGroom.userId` is still exactly "this groom is on nobody's staff".
  if (!retiredGroom.userId) {
    logger.info(
      `[groomLegacyService.autoCreateLegacyOnRetirement] Groom ${retiredGroom.id} is on nobody's ` +
        'staff; no legacy is created (a free agent has no stable to pass a legacy to, and a null ' +
        'userId would otherwise match every other free agent).',
    );
    return null;
  }

  // Don't create a second legacy for a groom that already has one.
  const existingLegacy = await prisma.groomLegacyLog.findFirst({
    where: { retiredGroomId: retiredGroom.id },
  });
  if (existingLegacy) {
    return null;
  }

  // Find the lowest-level active groom of the same user, not already a legacy protégé.
  const protegeCandidate = await prisma.groom.findFirst({
    where: {
      userId: retiredGroom.userId,
      retired: false,
      isActive: true,
      id: { not: retiredGroom.id },
      legacyGroomMentors: { none: {} }, // not already a protégé in any legacy log
    },
    orderBy: [{ level: 'asc' }, { experience: 'asc' }],
  });

  if (!protegeCandidate) {
    logger.info(
      `[groomLegacyService.autoCreateLegacyOnRetirement] No eligible protégé for retired mentor groom ${retiredGroom.id} (level ${retiredGroom.level}); legacy deferred.`,
    );
    return null;
  }

  // Select a random perk from the mentor's personality pool.
  const perkPool = LEGACY_PERKS[retiredGroom.personality] || [];
  if (perkPool.length === 0) {
    logger.warn(
      `[groomLegacyService.autoCreateLegacyOnRetirement] No legacy perks defined for personality '${retiredGroom.personality}'; skipping auto-legacy for groom ${retiredGroom.id}.`,
    );
    return null;
  }
  const perk = perkPool[Math.floor(Math.random() * perkPool.length)];

  const legacyLog = await createLegacyLog(
    retiredGroom.id,
    protegeCandidate.id,
    perk.id,
    retiredGroom.level,
  );

  logger.info(
    `[groomLegacyService.autoCreateLegacyOnRetirement] Auto-created legacy log ${legacyLog.id}: retired mentor ${retiredGroom.id} (lvl ${retiredGroom.level}) → protégé ${protegeCandidate.id} (lvl ${protegeCandidate.level}), perk ${perk.id}.`,
  );
  return legacyLog;
}

export default {
  checkLegacyEligibility,
  generateLegacyProtege,
  getLegacyPerks,
  createLegacyLog,
  getUserLegacyHistory,
  autoCreateLegacyOnRetirement,
  LEGACY_CONSTANTS,
  LEGACY_PERKS,
};
