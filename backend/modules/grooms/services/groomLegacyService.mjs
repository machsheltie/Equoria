/**
 * Groom Legacy Service
 *
 * This service handles the legacy system where retired high-level grooms mentor one
 * of the player's existing grooms (a protégé), who inherits a perk. The GAME makes the
 * pairing at retirement (autoCreateLegacyOnRetirement); players never create grooms
 * (owner ruling 2026-10-21, Q14; Equoria-bhoka removed POST /grooms/:id/legacy/create
 * and the protégé-creation service behind it).
 *
 * Legacy Rules:
 * - Only retired grooms at Advanced or above are eligible (the star level equivalent to
 *   the old level 7, owner ruling 2026-10-28, q229). Stars give no bonus for now (q244):
 *   every groom's mentoring level is staffCareerStarLevel (Rookie, old level 1), so no
 *   groom mentors until staff growth (Equoria-xlw03) - as before, when every game-made
 *   groom sat at level 1.
 * - Each retired groom mentors at most one protégé
 * - Protégés inherit one random perk from mentor's personality type
 * - Legacy relationships are permanently tracked
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { staffCareerStarLevel, staffLevelAtLeast } from '../../../constants/staffLevels.mjs';

/**
 * Legacy system constants
 */
export const LEGACY_CONSTANTS = {
  // The star level equivalent to the old level 7 (q229). The old protégé +1 level bonus
  // went with the old level.
  MINIMUM_MENTOR_STAR_LEVEL: 'advanced',
  // Equoria-ixya8: the old +50 starting experience is gone (staff never gain XP, owner
  // ruling 2026-10-21; every groom starts as a Rookie, q177).
  PROTEGE_SKILL_BONUS: 0.1, // 10% bonus to starting skills
};

/**
 * Whether a groom's level allows mentoring. The level read is staffCareerStarLevel, not
 * the groom's stars: stars give no bonus for now (owner ruling 2026-10-28, q244).
 * @returns {boolean}
 */
function meetsMentorLevel() {
  return staffLevelAtLeast(staffCareerStarLevel, LEGACY_CONSTANTS.MINIMUM_MENTOR_STAR_LEVEL);
}

/**
 * Legacy perks by personality type
 * Each perk provides specific bonuses to the protégé
 */
export const LEGACY_PERKS = {
  calm: [
    {
      id: 'gentleHands',
      name: 'Gentle Hands',
      description: 'Inherited gentle touch technique',
      effect: { bondingBonus: 0.05 },
    },
    {
      id: 'empathicSync',
      name: 'Empathic Sync',
      description: 'Natural ability to read horse emotions',
      effect: { milestoneAccuracy: 0.1, reactiveHorseBonus: 0.15 },
    },
    {
      id: 'patienceMastery',
      name: 'Patience Mastery',
      description: 'Exceptional patience with difficult horses',
      effect: { consistencyBonus: 0.1 },
    },
  ],
  energetic: [
    {
      id: 'playtimePro',
      name: 'Playtime Pro',
      description: 'Expert at engaging horses through play',
      effect: { milestoneVariety: 0.1, curiosityBonus: 0.15 },
    },
    {
      id: 'fearBuster',
      name: 'Fear Buster',
      description: 'Specialized in building horse confidence',
      effect: { braveryChance: 0.15, confidenceBonus: 0.2 },
    },
    {
      id: 'energyChanneling',
      name: 'Energy Channeling',
      description: 'Ability to direct horse energy positively',
      effect: { hyperactiveBonus: 0.2, focusImprovement: 0.1 },
    },
  ],
  methodical: [
    {
      id: 'dataDriven',
      name: 'Data Driven',
      description: 'Systematic approach to trait development',
      effect: { traitAccuracy: 0.05, analysisBonus: 0.1 },
    },
    {
      id: 'memoryBuilder',
      name: 'Memory Builder',
      description: 'Exceptional at building horse-groom synergy',
      effect: { synergyRate: 0.2, memoryBonus: 0.15 },
    },
    {
      id: 'precisionTraining',
      name: 'Precision Training',
      description: 'Meticulous attention to training details',
      effect: { taskQuality: 0.1, precisionBonus: 0.15 },
    },
  ],
};

/**
 * A legacy perk as a player sees it: its authored name and description only. The
 * `effect` map is internal (its keys are code names, never shown to players), and the
 * frontend keeps no copy of this table: it reads the perks from these responses
 * (Equoria-gghoi).
 * @param {{ id: string, name: string, description: string }} perk
 * @returns {{ id: string, name: string, description: string }}
 */
export function toPlayerLegacyPerk(perk) {
  return { id: perk.id, name: perk.name, description: perk.description };
}

/**
 * The perks a groom of this personality could pass on, as players see them.
 * @param {string} personality
 * @returns {Array<{ id: string, name: string, description: string }>}
 */
export function getPlayerLegacyPerks(personality) {
  return getLegacyPerks(personality).map(toPlayerLegacyPerk);
}

/**
 * The legacy perk with this id, as players see it, or null when no personality grants it.
 * @param {string} perkId
 * @returns {{ id: string, name: string, description: string } | null}
 */
export function findPlayerLegacyPerk(perkId) {
  for (const perks of Object.values(LEGACY_PERKS)) {
    const perk = perks.find(p => p.id === perkId);
    if (perk) {
      return toPlayerLegacyPerk(perk);
    }
  }
  return null;
}

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
      reason: 'groomNotFound',
    };
  }

  // Check if groom is retired
  if (!groom.retired) {
    return {
      eligible: false,
      reason: 'notRetired',
      starLevel: groom.starLevel,
    };
  }

  // Check if legacy already exists
  const existingLegacy = await prisma.groomLegacyLog.findFirst({
    where: { retiredGroomId: groomId },
  });

  if (existingLegacy) {
    return {
      eligible: false,
      reason: 'legacyAlreadyCreated',
      existingLegacyId: existingLegacy.id,
    };
  }

  // Check the mentoring level last, so a groom that has already mentored is named as
  // such (the level read is staffCareerStarLevel, q244).
  if (!meetsMentorLevel()) {
    return {
      eligible: false,
      reason: 'insufficientLevel',
      starLevel: groom.starLevel,
      requiredStarLevel: LEGACY_CONSTANTS.MINIMUM_MENTOR_STAR_LEVEL,
    };
  }

  // Get available perks for this groom's personality (authored labels only, Equoria-gghoi)
  const availablePerks = getPlayerLegacyPerks(groom.personality);

  return {
    eligible: true,
    starLevel: groom.starLevel,
    experience: groom.experience,
    personality: groom.personality,
    assignmentCount: groom.groomAssignmentLogs.length,
    availablePerks,
  };
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
 * @returns {Promise<Object>} Created legacy log
 */
export async function createLegacyLog(retiredGroomId, legacyGroomId, inheritedPerk) {
  const legacyLog = await prisma.groomLegacyLog.create({
    data: {
      retiredGroomId,
      legacyGroomId,
      inheritedPerk,
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
        select: { id: true, name: true, starLevel: true, personality: true },
      },
      legacyGroom: {
        select: { id: true, name: true, starLevel: true, experience: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return legacyLogs.map(log => ({
    id: log.id,
    // Equoria-gghoi: the inherited perk's authored name and description, so the
    // frontend reads the perk from the game instead of keeping its own table. null for
    // a perk id no personality grants any more.
    inheritedPerkDetail: findPlayerLegacyPerk(log.inheritedPerk),
    retiredGroomId: log.retiredGroomId,
    retiredGroomName: log.retiredGroom.name,
    retiredGroomStarLevel: log.retiredGroom.starLevel,
    protegeGroomId: log.legacyGroomId,
    protegeGroomName: log.legacyGroom.name,
    protegeGroomStarLevel: log.legacyGroom.starLevel,
    inheritedPerk: log.inheritedPerk,
    createdAt: log.createdAt,
  }));
}

/**
 * Equoria-c0vo: Auto-create a GroomLegacyLog when a mentor-eligible groom retires.
 *
 * Eligibility: the mentoring level (meetsMentorLevel) is at least
 * LEGACY_CONSTANTS.MINIMUM_MENTOR_STAR_LEVEL (Advanced).
 * Protégé selection: the least experienced active (non-retired) groom of the same user,
 * excluding the retiring groom itself, that is not already a legacy protégé.
 * If no eligible protégé exists yet, returns null and logs an info message (there
 * is no player-made protégé: Equoria-bhoka, owner ruling 2026-10-21 Q14).
 *
 * Called by groomRetirementService.processRetirement AFTER its transaction
 * commits, never inside it: a legacy log is a bonus, and failing to create one
 * must not undo a retirement the player has already been notified of.
 *
 * @param {Object} retiredGroom - The freshly retired groom record (must include id, userId, personality)
 * @returns {Promise<Object|null>} The created legacy log, or null if not eligible / no protégé.
 */
export async function autoCreateLegacyOnRetirement(retiredGroom) {
  if (!retiredGroom || !meetsMentorLevel()) {
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

  // Find the least experienced active groom of the same user, not already a legacy protégé.
  const protegeCandidate = await prisma.groom.findFirst({
    where: {
      userId: retiredGroom.userId,
      retired: false,
      isActive: true,
      id: { not: retiredGroom.id },
      legacyGroomMentors: { none: {} }, // not already a protégé in any legacy log
    },
    orderBy: [{ experience: 'asc' }, { id: 'asc' }],
  });

  if (!protegeCandidate) {
    logger.info(
      `[groomLegacyService.autoCreateLegacyOnRetirement] No eligible protégé for retired mentor groom ${retiredGroom.id}; legacy deferred.`,
    );
    return null;
  }

  // Select a random perk from the mentor's personality pool.
  const perkPool = getLegacyPerks(retiredGroom.personality);
  if (perkPool.length === 0) {
    logger.warn(
      `[groomLegacyService.autoCreateLegacyOnRetirement] No legacy perks defined for personality '${retiredGroom.personality}'; skipping auto-legacy for groom ${retiredGroom.id}.`,
    );
    return null;
  }
  const perk = perkPool[Math.floor(Math.random() * perkPool.length)];

  const legacyLog = await createLegacyLog(retiredGroom.id, protegeCandidate.id, perk.id);

  logger.info(
    `[groomLegacyService.autoCreateLegacyOnRetirement] Auto-created legacy log ${legacyLog.id}: retired mentor ${retiredGroom.id} → protégé ${protegeCandidate.id}, perk ${perk.id}.`,
  );
  return legacyLog;
}

export default {
  checkLegacyEligibility,
  getLegacyPerks,
  getPlayerLegacyPerks,
  findPlayerLegacyPerk,
  createLegacyLog,
  getUserLegacyHistory,
  autoCreateLegacyOnRetirement,
  LEGACY_CONSTANTS,
  LEGACY_PERKS,
};
