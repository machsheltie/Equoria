/**
 * Breeding Prediction Service
 *
 * The per-horse breeding data summary (GET /horses/:id/breeding-data) and the
 * temperament compatibility of a pair.
 *
 * Owner ruling 2026-10-19 (Equoria-6dace fix round 1): the pair inheritance
 * functions that read BOTH parents' raw trait history — another player's
 * hidden traits included — had no caller and were deleted
 * (calculateInheritanceProbabilities, calculateFlagInheritanceScore,
 * predictOffspringTraits). Breeding predictions live in the prediction
 * services, which read through predictionHorseView.
 *
 * Business Rules:
 * - Only traits before age 4 are considered
 * - History rows of traits still hidden on the horse are not counted
 * - A trait's rarity is never sent and never scored here: players do not see
 *   how rare a trait is (owner ruling 2026-10-27, q112), and the breeding-
 *   quality label gives no bonus for rare traits, which hinted at which traits
 *   are rare (owner ruling 2026-10-28, q170; Equoria-qw4kp).
 * - No trait category counts (owner ruling 2026-10-28, q169): the six old
 *   categories did not fit the twenty-trait roster.
 * - No breeding compatibility block (owner ruling 2026-10-28, q167; Equoria-
 *   8grnh): no genetics reports for players.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { NotFoundError } from '../../../errors/index.mjs';
import { hiddenTraitSet, publicTraitModifiers } from '../../../utils/publicTraitView.mjs';
import { getTraitsByType } from '../../../utils/epigeneticTraits.mjs';

// Constants for inheritance calculations
const AGE_CUTOFF_DAYS = 1460; // 4 years in days

// Negative traits, keyed on the twenty-trait roster's polarity (q135) from
// utils/epigeneticTraits.mjs, their one source (Equoria-qw4kp).
const NEGATIVE_TRAITS = Object.freeze(getTraitsByType('negative'));

/**
 * Calculate temperament influence and compatibility
 * @param {number} stallionId - ID of the stallion
 * @param {number} mareId - ID of the mare
 * @returns {Object} Temperament influence analysis
 */
export async function calculateTemperamentInfluence(stallionId, mareId) {
  logger.info(
    `[breedingPredictionService.calculateTemperamentInfluence] Calculating temperament influence for stallion ${stallionId} and mare ${mareId}`,
  );

  // Get horse temperaments
  const stallion = await prisma.horse.findUnique({
    where: { id: stallionId },
    select: { temperament: true },
  });

  const mare = await prisma.horse.findUnique({
    where: { id: mareId },
    select: { temperament: true },
  });

  if (!stallion || !mare) {
    // Equoria-ywsid: throw a TYPED NotFoundError (AppError subclass, statusCode
    // 404) for the missing-horse case so any HTTP handler can detect not-found
    // by type (AppError.isAppError + statusCode===404) rather than the fragile
    // error.message.includes('not found') string-sniff (the Equoria-93lhj
    // antipattern). Two horses are involved here (no single id), so the bare
    // NotFoundError('Horse') yields the identical message 'Horse not found' —
    // the original message is preserved verbatim.
    throw new NotFoundError('Horse');
  }

  // Calculate compatibility score
  const compatibilityMatrix = {
    'calm-calm': 85,
    'calm-spirited': 70,
    'calm-gentle': 90,
    'spirited-spirited': 60,
    'spirited-calm': 70,
    'spirited-gentle': 65,
    'gentle-gentle': 95,
    'gentle-calm': 90,
    'gentle-spirited': 65,
  };

  const compatibilityKey = `${stallion.temperament}-${mare.temperament}`;
  const compatibilityScore = compatibilityMatrix[compatibilityKey] || 50;

  // Predict offspring temperament
  const temperamentPredictions = {
    'calm-calm': ['calm', 'gentle'],
    'calm-spirited': ['calm', 'spirited', 'balanced'],
    'spirited-spirited': ['spirited', 'fiery'],
    'gentle-gentle': ['gentle', 'calm'],
  };

  const predictedOffspringTemperament = temperamentPredictions[compatibilityKey] || ['balanced'];

  // Calculate trait influence modifiers
  const traitInfluenceModifiers = {
    boldness:
      stallion.temperament === 'spirited' ? 1.2 : mare.temperament === 'spirited' ? 1.1 : 1.0,
    empathy: mare.temperament === 'gentle' ? 1.3 : stallion.temperament === 'gentle' ? 1.2 : 1.0,
    calmness: stallion.temperament === 'calm' ? 1.2 : mare.temperament === 'calm' ? 1.1 : 1.0,
    energy: stallion.temperament === 'spirited' ? 1.3 : mare.temperament === 'spirited' ? 1.2 : 1.0,
  };

  const result = {
    stallionId,
    mareId,
    stallionTemperament: stallion.temperament,
    mareTemperament: mare.temperament,
    compatibilityScore,
    predictedOffspringTemperament,
    traitInfluenceModifiers,
    calculatedAt: new Date(),
  };

  logger.info(
    `[breedingPredictionService.calculateTemperamentInfluence] Calculated temperament compatibility: ${compatibilityScore}`,
  );

  return result;
}

/**
 * Generate comprehensive breeding data for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Complete breeding data summary
 */
export async function generateBreedingData(horseId) {
  logger.info(
    `[breedingPredictionService.generateBreedingData] Generating breeding data for horse ${horseId}`,
  );

  // Get horse basic info
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: {
      id: true,
      name: true,
      sex: true,
      temperament: true,
      epigeneticModifiers: true,
    },
  });

  if (!horse) {
    // Equoria-4xwyi: throw a TYPED NotFoundError (AppError subclass, statusCode
    // 404) instead of a plain Error so the horseBreedingRoutes /:id/breeding-data
    // handler can detect not-found by type (AppError.isAppError +
    // statusCode===404) rather than the fragile error.message.includes('not
    // found') string-sniff (the Equoria-93lhj antipattern). NotFoundError('Horse',
    // horseId) yields the identical message 'Horse with ID <id> not found', so the
    // existing 404 response body is preserved verbatim.
    throw new NotFoundError('Horse', horseId);
  }

  // Get trait history for summary. Rows naming a trait still hidden on the
  // horse are not counted: per-category counts would hint at it (owner ruling
  // 2026-10-19, Equoria-6dace).
  const hiddenTraits = [...hiddenTraitSet(horse.epigeneticModifiers)];
  const traitHistory = await prisma.traitHistoryLog.findMany({
    where: {
      horseId,
      ageInDays: { lt: AGE_CUTOFF_DAYS },
      traitName: { notIn: hiddenTraits },
    },
    orderBy: { ageInDays: 'asc' },
  });

  // Calculate trait summary
  const traitSummary = {
    totalTraits: traitHistory.length,
    epigeneticTraits: traitHistory.filter(t => t.isEpigenetic).length,
    negativeTraits: traitHistory.filter(t => NEGATIVE_TRAITS.includes(t.traitName)).length,
    traitsBySource: {
      milestone: traitHistory.filter(t => t.sourceType === 'milestone').length,
      groom: traitHistory.filter(t => t.sourceType === 'groom').length,
      breeding: traitHistory.filter(t => t.sourceType === 'breeding').length,
      environmental: traitHistory.filter(t => t.sourceType === 'environmental').length,
    },
    averageBondScore:
      traitHistory.length > 0
        ? traitHistory.reduce((sum, t) => sum + (t.bondScore || 50), 0) / traitHistory.length
        : 50,
    averageInfluenceScore:
      traitHistory.length > 0
        ? traitHistory.reduce((sum, t) => sum + (t.influenceScore || 0), 0) / traitHistory.length
        : 0,
  };

  // Unrevealed hidden traits: a count only, never named (Equoria-6dace).
  const { positive, negative, hiddenCount } = publicTraitModifiers(horse.epigeneticModifiers);
  const epigeneticFlags = {
    positive,
    negative,
    hiddenCount,
    totalFlags: positive.length + negative.length + hiddenCount,
  };

  // Calculate temperament influence data
  const temperamentInfluence = {
    temperament: horse.temperament,
    traitAffinities: {
      boldness:
        horse.temperament === 'spirited' ? 'high' : horse.temperament === 'calm' ? 'low' : 'medium',
      empathy:
        horse.temperament === 'gentle'
          ? 'high'
          : horse.temperament === 'spirited'
            ? 'low'
            : 'medium',
      calmness:
        horse.temperament === 'calm' ? 'high' : horse.temperament === 'spirited' ? 'low' : 'medium',
      energy:
        horse.temperament === 'spirited' ? 'high' : horse.temperament === 'calm' ? 'low' : 'medium',
    },
  };

  const result = {
    horseId,
    horseName: horse.name,
    sex: horse.sex,
    traitSummary,
    epigeneticFlags,
    temperamentInfluence,
    hasInsufficientData: traitHistory.length === 0,
    breedingQuality: calculateBreedingQuality(traitSummary, epigeneticFlags),
    generatedAt: new Date(),
  };

  logger.info(
    `[breedingPredictionService.generateBreedingData] Generated breeding data for horse ${horseId} with ${traitSummary.totalTraits} traits`,
  );

  return result;
}

/**
 * Calculate overall breeding quality score
 * @param {Object} traitSummary - Trait summary data
 * @param {Object} epigeneticFlags - Epigenetic flags data
 * @returns {string} Breeding quality assessment
 */
function calculateBreedingQuality(traitSummary, epigeneticFlags) {
  let score = 0;

  // Trait quantity (max 3 points)
  if (traitSummary.totalTraits >= 6) {
    score += 3;
  } else if (traitSummary.totalTraits >= 4) {
    score += 2;
  } else if (traitSummary.totalTraits >= 2) {
    score += 1;
  }

  // No rare-trait points (owner ruling 2026-10-28, q170).

  // Epigenetic flags (max 2 points)
  if (epigeneticFlags.totalFlags >= 3) {
    score += 2;
  } else if (epigeneticFlags.totalFlags >= 1) {
    score += 1;
  }

  // Negative trait penalty
  score -= traitSummary.negativeTraits;

  // Bond score bonus (max 1 point)
  if (traitSummary.averageBondScore >= 80) {
    score += 1;
  }

  // Determine quality level
  if (score >= 7) {
    return 'exceptional';
  }
  if (score >= 5) {
    return 'excellent';
  }
  if (score >= 3) {
    return 'good';
  }
  if (score >= 1) {
    return 'fair';
  }
  return 'poor';
}
