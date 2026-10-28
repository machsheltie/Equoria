/**
 * Legacy Score Trait Calculator Service
 *
 * Service for calculating trait-based scoring components of a horse's legacy score.
 * This service analyzes trait development history to determine the depth and quality
 * of a horse's trait development, influencing its value as a breeder and prestige record.
 *
 * Features:
 * - Trait count scoring (max 10 points)
 * - Trait diversity scoring (max 5 points)
 * - Rare trait bonus scoring (max 10 points)
 * - Groom care consistency scoring (max 5 points)
 * - Negative trait penalties
 * - Age-based trait filtering (only traits before age 4)
 *
 * Business Rules:
 * - Only traits gained before age 4 (1460 days) count toward legacy score
 * - Negative traits reduce score (-1 to -3 each)
 * - Rare trait cap bonus: max 10 points from rare category
 * - Groom care consistency based on milestone evaluation data
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { hiddenTraitSet } from '../../../utils/publicTraitView.mjs';
import { getTraitsAtOrAboveRarity, getTraitsByType } from '../../../utils/epigeneticTraits.mjs';
// Equoria-fe9k: canonical days→game-years conversion. The introspection
// response previously divided AGE_CUTOFF_DAYS by 365 (calendar-years),
// drifting from the game-year cadence used everywhere else.
import { gameYearsFromDays } from '../../../utils/horseAge.mjs';

// Constants for trait scoring
const MAX_TRAIT_COUNT_SCORE = 10;
const MAX_DIVERSITY_SCORE = 5;
const MAX_RARE_TRAIT_SCORE = 10;
const MAX_GROOM_CARE_SCORE = 5;
const AGE_CUTOFF_DAYS = 1460; // 4 years in days

// Trait categorization, keyed on the twenty-trait roster (owner rulings
// 2026-10-27, q117 roster, q134 rarity, q135 polarity; Equoria-qw4kp). The
// roster table in utils/epigeneticTraits.mjs is the one source. "Rare" is a
// Rare, Ultra Rare or Legendary trait (resilient, focused, competitive, heart);
// the negative traits are fearful, insecure, aloof, fragile, skittish and
// excitable. The lists used to name traits that are no longer on the roster.
const RARE_TRAITS = Object.freeze(getTraitsAtOrAboveRarity('rare'));

const NEGATIVE_TRAITS = Object.freeze(getTraitsByType('negative'));

// fearful keeps the -2 it had before the roster change (q137: carried-over
// traits keep their old values); every other negative trait takes the -1
// default applied below.
const NEGATIVE_TRAIT_PENALTIES = Object.freeze({
  fearful: -2,
});

/**
 * Calculate trait score for a horse's legacy score
 * @param {number} horseId - ID of the horse
 * @returns {Object} Trait score breakdown and total
 */
export async function calculateTraitScore(horseId) {
  logger.info(
    `[legacyScoreTraitCalculator.calculateTraitScore] Calculating trait score for horse ${horseId}`,
  );

  // Get trait history for traits gained before age 4
  const traitHistory = await prisma.traitHistoryLog.findMany({
    where: {
      horseId,
      ageInDays: {
        lt: AGE_CUTOFF_DAYS, // Only traits before age 4
      },
    },
    orderBy: { timestamp: 'asc' },
  });

  // Get milestone evaluation data for groom care consistency
  const milestoneData = await prisma.milestoneTraitLog.findMany({
    where: { horseId },
    orderBy: { timestamp: 'asc' },
  });

  // Separate traits by type
  const traitsConsidered = traitHistory.filter(t => t.ageInDays < AGE_CUTOFF_DAYS);
  const traitsExcluded = await prisma.traitHistoryLog.findMany({
    where: {
      horseId,
      ageInDays: {
        gte: AGE_CUTOFF_DAYS, // Traits after age 4
      },
    },
  });

  // Calculate trait count score (max 10 points)
  const traitCount = traitsConsidered.length;
  const traitCountScore = Math.min(traitCount, MAX_TRAIT_COUNT_SCORE);

  // Calculate diversity score (max 5 points)
  const sourceTypes = new Set(traitsConsidered.map(t => t.sourceType));
  const diversityScore = Math.min(sourceTypes.size, MAX_DIVERSITY_SCORE);

  // Calculate rare trait score (max 10 points)
  const rareTraits = traitsConsidered.filter(t => RARE_TRAITS.includes(t.traitName));
  const rareTraitScore = Math.min(rareTraits.length * 3, MAX_RARE_TRAIT_SCORE); // 3 points per rare trait

  // Calculate negative trait penalties
  const negativeTraits = traitsConsidered.filter(t => NEGATIVE_TRAITS.includes(t.traitName));
  const negativeTraitPenalty = negativeTraits.reduce((penalty, trait) => {
    return penalty + (NEGATIVE_TRAIT_PENALTIES[trait.traitName] || -1);
  }, 0);

  // Calculate groom care consistency score (max 5 points)
  const groomCareScore = calculateGroomCareConsistency(milestoneData);

  // The score below counts every logged trait, as before (an owner question,
  // see Equoria-6dace report). The name lists sent back leave out traits still
  // hidden on the horse: those are never named, to anyone (Equoria-6dace).
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: { epigeneticModifiers: true },
  });
  const hidden = hiddenTraitSet(horse?.epigeneticModifiers);
  const shown = rows => rows.filter(t => !hidden.has(t.traitName));

  // The breakdown reaches the horse's owner (GET /horses/:id/legacy-score), so
  // it never names which traits are rare and never shows the rare-trait points:
  // players never see a trait's rarity (owner rulings 2026-10-27, q112;
  // 2026-10-28, q150). The rare points still count in the total. Polarity is
  // player-visible (q135).
  // Calculate total trait score
  const totalScore = Math.max(
    0,
    traitCountScore + diversityScore + rareTraitScore + groomCareScore + negativeTraitPenalty,
  );

  const result = {
    totalScore,
    maxScore:
      MAX_TRAIT_COUNT_SCORE + MAX_DIVERSITY_SCORE + MAX_RARE_TRAIT_SCORE + MAX_GROOM_CARE_SCORE,
    breakdown: {
      traitCount: traitCountScore,
      diversity: diversityScore,
      groomCareConsistency: groomCareScore,
      negativeTraitPenalty,
      traitsConsidered: shown(traitsConsidered).map(t => ({
        name: t.traitName,
        sourceType: t.sourceType,
        ageInDays: t.ageInDays,
        isNegative: NEGATIVE_TRAITS.includes(t.traitName),
      })),
      traitsExcluded: shown(traitsExcluded).map(t => ({
        name: t.traitName,
        ageInDays: t.ageInDays,
        reason: 'Too old (after age 4)',
      })),
      milestoneData: milestoneData.map(m => ({
        milestoneType: m.milestoneType,
        taskConsistency: m.taskConsistency,
        taskDiversity: m.taskDiversity,
        bondScore: m.bondScore,
      })),
      sourceTypes: Array.from(sourceTypes),
      negativeTraitNames: shown(negativeTraits).map(t => t.traitName),
    },
  };

  logger.info(
    `[legacyScoreTraitCalculator.calculateTraitScore] Calculated trait score ${totalScore}/${result.maxScore} for horse ${horseId}`,
  );

  return result;
}

/**
 * Calculate groom care consistency score from milestone data
 * @param {Array} milestoneData - Array of milestone trait logs
 * @returns {number} Groom care consistency score (0-5)
 */
// Exported for unit-testing pure branch coverage (Equoria-jkht)
export function calculateGroomCareConsistency(milestoneData) {
  if (milestoneData.length === 0) {
    return 0;
  }

  // Calculate average task consistency and diversity
  const avgTaskConsistency =
    milestoneData.reduce((sum, m) => sum + (m.taskConsistency || 0), 0) / milestoneData.length;
  const avgTaskDiversity =
    milestoneData.reduce((sum, m) => sum + (m.taskDiversity || 0), 0) / milestoneData.length;
  const avgBondScore =
    milestoneData.reduce((sum, m) => sum + (m.bondScore || 50), 0) / milestoneData.length;

  // Score based on consistency and diversity (0-10 scale each)
  const consistencyScore = avgTaskConsistency / 10; // Convert to 0-1 scale
  const diversityScore = avgTaskDiversity / 10; // Convert to 0-1 scale
  const bondScore = (avgBondScore - 50) / 50; // Convert to 0-1 scale (50-100 -> 0-1)

  // Weighted average: 40% consistency, 30% diversity, 30% bond
  const combinedScore =
    consistencyScore * 0.4 + diversityScore * 0.3 + Math.max(0, bondScore) * 0.3;

  // Scale to 0-5 points
  return Math.round(combinedScore * MAX_GROOM_CARE_SCORE);
}

/**
 * Get trait score summary for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Summary of trait scoring potential
 */
export async function getTraitScoreSummary(horseId) {
  logger.info(
    `[legacyScoreTraitCalculator.getTraitScoreSummary] Getting trait score summary for horse ${horseId}`,
  );

  const traitScore = await calculateTraitScore(horseId);

  const summary = {
    horseId,
    currentScore: traitScore.totalScore,
    maxPossibleScore: traitScore.maxScore,
    percentage: (traitScore.totalScore / traitScore.maxScore) * 100,
    strengths: [],
    weaknesses: [],
  };

  // Identify strengths. No rare-trait strength: it would hint at which traits
  // are rare (owner ruling 2026-10-28, q150).
  if (traitScore.breakdown.diversity >= 4) {
    summary.strengths.push('Excellent trait source diversity');
  }
  if (traitScore.breakdown.groomCareConsistency >= 4) {
    summary.strengths.push('Outstanding groom care consistency');
  }

  // Identify weaknesses
  if (traitScore.breakdown.negativeTraitPenalty < -3) {
    summary.weaknesses.push('Significant negative trait burden');
  }
  if (traitScore.breakdown.traitCount < 3) {
    summary.weaknesses.push('Limited trait development');
  }
  if (traitScore.breakdown.groomCareConsistency < 2) {
    summary.weaknesses.push('Inconsistent early care');
  }

  logger.info(
    `[legacyScoreTraitCalculator.getTraitScoreSummary] Generated summary for horse ${horseId}: ${summary.currentScore}/${summary.maxPossibleScore} (${summary.percentage.toFixed(1)}%)`,
  );

  return summary;
}

/**
 * Get trait scoring definitions and constants
 * @returns {Object} Trait scoring system definitions
 */
export function getTraitScoringDefinitions() {
  return {
    maxScores: {
      traitCount: MAX_TRAIT_COUNT_SCORE,
      diversity: MAX_DIVERSITY_SCORE,
      rareTraits: MAX_RARE_TRAIT_SCORE,
      groomCare: MAX_GROOM_CARE_SCORE,
      total:
        MAX_TRAIT_COUNT_SCORE + MAX_DIVERSITY_SCORE + MAX_RARE_TRAIT_SCORE + MAX_GROOM_CARE_SCORE,
    },
    ageCutoff: {
      days: AGE_CUTOFF_DAYS,
      // Equoria-fe9k: game-years (floor(days / 7)), NOT calendar-years
      // (days / 365). Display/introspection field only — the DB filter
      // above uses the raw `days` value, so this change does not alter
      // which traits are scored, only the unit reported to clients.
      years: gameYearsFromDays(AGE_CUTOFF_DAYS),
    },
    rareTraits: [...RARE_TRAITS],
    negativeTraits: [...NEGATIVE_TRAITS],
    negativeTraitPenalties: { ...NEGATIVE_TRAIT_PENALTIES },
    scoringRules: {
      traitCount: 'Each trait before age 4 = 1 point (max 10)',
      diversity: 'Each unique source type = 1 point (max 5)',
      rareTraits: 'Each rare trait = 3 points (max 10)',
      groomCare: 'Based on milestone consistency and bond scores (max 5)',
      negativeTraits: 'Penalties range from -1 to -2 per negative trait',
    },
  };
}
