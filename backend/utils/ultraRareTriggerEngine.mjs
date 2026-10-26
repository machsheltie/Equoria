/**
 * Ultra-Rare Trait Trigger Engine
 * Evaluates complex trigger conditions for ultra-rare and exotic traits
 * Integrates with existing milestone evaluation and care history systems
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from './logger.mjs';
import { ULTRA_RARE_TRAITS, EXOTIC_TRAITS } from './ultraRareTraits.mjs';
import {
  evaluateShadowFollowerConditions,
  evaluateGhostwalkerConditions,
  evaluateSoulbondedConditions,
  evaluateFeyKissedConditions,
  evaluateDreamtwinConditions,
} from './exoticTriggerEvaluators.mjs';
import {
  topBondThreshold,
  topConformationThreshold,
  careGapDays,
  asPlainObject,
  textIncludesAny,
  hasCareGap,
} from './ultraRareTriggerHelpers.mjs';

// Thresholds and pure helpers live in ultraRareTriggerHelpers.mjs and the five
// exotic evaluators in exoticTriggerEvaluators.mjs (split by Equoria-owj33; the
// Equoria-oey96.9 notes on how each condition maps onto existing relations travel
// with them).

/**
 * Evaluate ultra-rare trait trigger conditions for a horse
 * @param {number} horseId - ID of the horse to evaluate
 * @param {Object} evaluationContext - Context data for evaluation
 * @returns {Promise<Array>} Array of triggered ultra-rare traits
 */
export async function evaluateUltraRareTriggers(horseId, evaluationContext = {}) {
  logger.info(`[ultraRareTriggerEngine] Evaluating ultra-rare triggers for horse ${horseId}`);

  const triggeredTraits = [];

  // Get horse data with related information
  const horse = await getHorseWithHistory(horseId);
  if (!horse) {
    throw new Error(`Horse with ID ${horseId} not found`);
  }

  // Evaluate each ultra-rare trait
  for (const [traitKey, traitDef] of Object.entries(ULTRA_RARE_TRAITS)) {
    const isTriggered = await evaluateTraitTriggerConditions(horse, traitDef, evaluationContext);

    if (isTriggered) {
      logger.info(
        `[ultraRareTriggerEngine] Ultra-rare trait triggered: ${traitDef.name} for horse ${horseId}`,
      );
      triggeredTraits.push({
        name: traitDef.name,
        key: traitKey,
        tier: 'ultra-rare',
        baseChance: traitDef.baseChance,
        definition: traitDef,
      });
    }
  }

  return triggeredTraits;
}

/**
 * Evaluate exotic trait unlock conditions for a horse
 * @param {number} horseId - ID of the horse to evaluate
 * @param {Object} evaluationContext - Context data for evaluation
 * @returns {Promise<Array>} Array of unlocked exotic traits
 */
export async function evaluateExoticUnlocks(horseId, evaluationContext = {}) {
  logger.info(`[ultraRareTriggerEngine] Evaluating exotic unlocks for horse ${horseId}`);

  const unlockedTraits = [];

  // Get horse data with related information
  const horse = await getHorseWithHistory(horseId);
  if (!horse) {
    throw new Error(`Horse with ID ${horseId} not found`);
  }

  // Evaluate each exotic trait
  for (const [traitKey, traitDef] of Object.entries(EXOTIC_TRAITS)) {
    const isUnlocked = await evaluateExoticUnlockConditions(horse, traitDef, evaluationContext);

    if (isUnlocked) {
      logger.info(
        `[ultraRareTriggerEngine] Exotic trait unlocked: ${traitDef.name} for horse ${horseId}`,
      );
      unlockedTraits.push({
        name: traitDef.name,
        key: traitKey,
        tier: 'exotic',
        definition: traitDef,
      });
    }
  }

  return unlockedTraits;
}

/**
 * Get horse data with comprehensive history for evaluation
 * @param {number} horseId - ID of the horse
 * @returns {Promise<Object>} Horse with related data
 */
async function getHorseWithHistory(horseId) {
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    include: {
      // Milestone trait logs for milestone tracking
      milestoneTraitLogs: {
        orderBy: { timestamp: 'asc' },
      },
      // Trait history for trait development tracking
      traitHistoryLogs: {
        orderBy: { timestamp: 'asc' },
      },
      // Groom interactions for care history
      groomInteractions: {
        orderBy: { timestamp: 'asc' },
        include: {
          groom: true,
        },
      },
      // Competition results for performance tracking
      competitionResults: {
        omit: { scoreInputs: true },
        orderBy: { createdAt: 'asc' },
      },
      // Parent information for lineage checks (ultraRareTraits JSON is a scalar,
      // loaded automatically; traitHistoryLogs included for name-based matching)
      sire: {
        include: {
          traitHistoryLogs: true,
        },
      },
      dam: {
        include: {
          traitHistoryLogs: true,
        },
      },
      // Ultra-rare trait events for tracking
      ultraRareTraitEvents: {
        orderBy: { timestamp: 'asc' },
      },
    },
  });

  if (!horse) {
    return null;
  }

  // Equoria-oey96.9: full siblings (share BOTH sire AND dam) for Dreamtwin. This
  // is NOT a Prisma relation — it is derived by a parent-id query. Only run it
  // when both parents are recorded (a twin requires shared sire AND dam).
  if (
    horse.sireId !== null &&
    horse.sireId !== undefined &&
    horse.damId !== null &&
    horse.damId !== undefined
  ) {
    horse.fullSiblings = await prisma.horse.findMany({
      where: {
        sireId: horse.sireId,
        damId: horse.damId,
        NOT: { id: horse.id },
      },
      include: {
        groomInteractions: { orderBy: { timestamp: 'asc' } },
      },
    });
  } else {
    horse.fullSiblings = [];
  }

  return horse;
}

/**
 * Evaluate trigger conditions for a specific ultra-rare trait
 * @param {Object} horse - Horse data with history
 * @param {Object} traitDef - Trait definition
 * @param {Object} context - Evaluation context
 * @returns {Promise<boolean>} True if conditions are met
 */
async function evaluateTraitTriggerConditions(horse, traitDef, _context) {
  const conditions = traitDef.triggerConditions;

  switch (traitDef.name) {
    case 'Phoenix-Born':
      return await evaluatePhoenixBornConditions(horse, conditions);

    case 'Iron-Willed':
      return await evaluateIronWilledConditions(horse, conditions);

    case 'Empathic Mirror':
      return await evaluateEmpathicMirrorConditions(horse, conditions);

    case 'Born Leader':
      return await evaluateBornLeaderConditions(horse, conditions);

    case 'Stormtouched':
      return await evaluateStormtouchedConditions(horse, conditions);

    default:
      logger.warn(`[ultraRareTriggerEngine] Unknown ultra-rare trait: ${traitDef.name}`);
      return false;
  }
}

/**
 * Evaluate unlock conditions for a specific exotic trait
 * @param {Object} horse - Horse data with history
 * @param {Object} traitDef - Trait definition
 * @param {Object} context - Evaluation context
 * @returns {Promise<boolean>} True if conditions are met
 */
async function evaluateExoticUnlockConditions(horse, traitDef, _context) {
  const conditions = traitDef.unlockConditions;

  switch (traitDef.name) {
    case 'Shadow-Follower':
      return await evaluateShadowFollowerConditions(horse, conditions);

    case 'Ghostwalker':
      return await evaluateGhostwalkerConditions(horse, conditions);

    case 'Soulbonded':
      return await evaluateSoulbondedConditions(horse, conditions);

    case 'Fey-Kissed':
      return await evaluateFeyKissedConditions(
        horse,
        conditions,
        new Set([...Object.keys(ULTRA_RARE_TRAITS), ...Object.keys(EXOTIC_TRAITS)]),
      );

    case 'Dreamtwin':
      return await evaluateDreamtwinConditions(horse, conditions);

    default:
      logger.warn(`[ultraRareTriggerEngine] Unknown exotic trait: ${traitDef.name}`);
      return false;
  }
}

/**
 * Phoenix-Born: the care rule that earned it was removed (owner ruling
 * 2026-10-26, Equoria-b76x0), so nothing earns it for now.
 */
async function evaluatePhoenixBornConditions() {
  return false;
}

/**
 * Iron-Willed: No skipped milestones + no negative traits by age 3
 */
async function evaluateIronWilledConditions(horse, conditions) {
  try {
    // Check if all milestones were completed (no skipped milestones)
    const milestoneCount = horse.milestoneTraitLogs.length;
    const expectedMilestones = 4; // Assuming 4 milestones

    // Check for negative traits in current epigenetic modifiers
    const currentTraits = horse.epigeneticModifiers || { positive: [], negative: [], hidden: [] };
    const hasNegativeTraits = currentTraits.negative && currentTraits.negative.length > 0;

    // Check bond consistency using current bond score and groom interactions
    const groomInteractions = horse.groomInteractions || [];
    const bondScores = groomInteractions
      .filter(interaction => interaction.bondScore !== null)
      .map(interaction => interaction.bondScore);

    // Use current bond score as fallback
    const currentBondScore = horse.bondScore || 0;
    bondScores.push(currentBondScore);

    const avgBondScore =
      bondScores.length > 0
        ? bondScores.reduce((sum, score) => sum + score, 0) / bondScores.length
        : currentBondScore;

    const bondConsistency = avgBondScore / 100; // Convert to percentage

    const meetsConditions =
      milestoneCount >= expectedMilestones &&
      !hasNegativeTraits &&
      bondConsistency >= conditions.minBondConsistency;

    logger.debug(
      `[ultraRareTriggerEngine] Iron-Willed evaluation: milestones: ${milestoneCount}, negative traits: ${hasNegativeTraits}, bond consistency: ${bondConsistency}, meets conditions: ${meetsConditions}`,
    );

    return meetsConditions;
  } catch (error) {
    logger.error(
      `[ultraRareTriggerEngine] Error evaluating Iron-Willed conditions: ${error.message}`,
    );
    return false;
  }
}

/**
 * Empathic Mirror: Same groom from birth + high bond entire time
 */
async function evaluateEmpathicMirrorConditions(horse, conditions) {
  try {
    // Check if same groom was assigned from birth using groom interactions
    const groomInteractions = horse.groomInteractions || [];
    const groomAssignments = groomInteractions.map(interaction => interaction.groomId);
    const uniqueGrooms = [...new Set(groomAssignments)];
    const sameGroomFromBirth = uniqueGrooms.length <= 1; // Allow for no grooms or single groom

    // Check bond scores throughout development
    const bondScores = groomInteractions
      .filter(interaction => interaction.bondScore !== null)
      .map(interaction => interaction.bondScore);

    // Use current bond score as fallback
    const currentBondScore = horse.bondScore || 0;
    if (bondScores.length === 0) {
      bondScores.push(currentBondScore);
    }

    const minBondScore = bondScores.length > 0 ? Math.min(...bondScores) : currentBondScore;
    const avgBondScore =
      bondScores.length > 0
        ? bondScores.reduce((sum, score) => sum + score, 0) / bondScores.length
        : currentBondScore;

    const meetsConditions =
      sameGroomFromBirth &&
      minBondScore >= conditions.minBondScore &&
      avgBondScore >= conditions.minBondScore;

    logger.debug(
      `[ultraRareTriggerEngine] Empathic Mirror evaluation: same groom: ${sameGroomFromBirth}, min bond: ${minBondScore}, avg bond: ${avgBondScore}, meets conditions: ${meetsConditions}`,
    );

    return meetsConditions;
  } catch (error) {
    logger.error(
      `[ultraRareTriggerEngine] Error evaluating Empathic Mirror conditions: ${error.message}`,
    );
    return false;
  }
}

/**
 * Born Leader: Top bond + steady/assertive temperament + top 3 conformation
 */
async function evaluateBornLeaderConditions(horse, conditions) {
  try {
    // Top-tier bond — snapshot on the horse's current bondScore (Equoria-oey96.9:
    // replaces the average over the nonexistent per-day care-log relation).
    const topBondScore = (horse.bondScore || 0) >= topBondThreshold;

    // Steady / assertive temperament (real scalar column).
    const temperament = horse.temperament?.toLowerCase();
    const steadyOrAssertive = temperament === 'steady' || temperament === 'assertive';

    // Top-3 conformation — snapshot on conformationScores (Equoria-oey96.9: there
    // are no conformation-placement records, so the prior hardcoded `true` is
    // replaced by the horse's actual conformation quality).
    const conformation = asPlainObject(horse.conformationScores);
    let conformationScore = 0;
    if (conformation) {
      if (typeof conformation.overallConformation === 'number') {
        conformationScore = conformation.overallConformation;
      } else {
        const nums = Object.values(conformation).filter(v => typeof v === 'number');
        conformationScore = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
      }
    }
    const topConformation = conformationScore >= topConformationThreshold;

    // Leadership moments — from milestone finalTrait / reasoning and trait-history
    // traitName (Equoria-oey96.9: milestone logs have finalTrait/reasoning, NOT the
    // notes/traitName the prior code read, so leadershipMoments was always 0).
    const leadershipMoments =
      (horse.milestoneTraitLogs || []).filter(
        log =>
          textIncludesAny(log.finalTrait, ['leader', 'confiden']) ||
          textIncludesAny(log.reasoning, ['leadership', 'leader']),
      ).length +
      (horse.traitHistoryLogs || []).filter(log =>
        textIncludesAny(log.traitName, ['leader', 'confiden']),
      ).length;

    const meetsConditions =
      topBondScore &&
      steadyOrAssertive &&
      topConformation &&
      leadershipMoments >= conditions.leadershipMoments;

    logger.debug(
      `[ultraRareTriggerEngine] Born Leader evaluation: top bond: ${topBondScore}, temperament: ${steadyOrAssertive}, conformation: ${topConformation}, leadership moments: ${leadershipMoments}, meets conditions: ${meetsConditions}`,
    );

    return meetsConditions;
  } catch (error) {
    logger.error(
      `[ultraRareTriggerEngine] Error evaluating Born Leader conditions: ${error.message}`,
    );
    return false;
  }
}

/**
 * Stormtouched: Reactive temperament + missed care + novelty events
 */
async function evaluateStormtouchedConditions(horse, _conditions) {
  try {
    // Reactive / volatile temperament (real scalar column).
    const temperament = horse.temperament?.toLowerCase();
    const reactiveTemperament = temperament === 'reactive' || temperament === 'volatile';

    const interactions = horse.groomInteractions || [];

    // Missed care week — a >= 7-day gap between consecutive groom interactions
    // (Equoria-oey96.9: matches PRD-04 §3.3 "no groom interaction for 7+ days";
    // replaces the date scan over the nonexistent per-day care-log relation).
    const missedWeekOfCare = hasCareGap(interactions, careGapDays);

    // Novelty interaction event — a groom interaction whose taskType indicates a
    // novelty/new/exposure task (Equoria-oey96.9: taskType lives on
    // GroomInteraction, not the nonexistent groom-task-log relation).
    const noveltyInteractionEvent = interactions.some(i =>
      textIncludesAny(i.taskType, ['novelty', 'new', 'exposure']),
    );

    const meetsConditions = reactiveTemperament && missedWeekOfCare && noveltyInteractionEvent;

    logger.debug(
      `[ultraRareTriggerEngine] Stormtouched evaluation: reactive: ${reactiveTemperament}, missed care: ${missedWeekOfCare}, novelty: ${noveltyInteractionEvent}, meets conditions: ${meetsConditions}`,
    );

    return meetsConditions;
  } catch (error) {
    logger.error(
      `[ultraRareTriggerEngine] Error evaluating Stormtouched conditions: ${error.message}`,
    );
    return false;
  }
}
