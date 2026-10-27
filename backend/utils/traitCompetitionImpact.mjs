/**
 * Trait Competition Impact System
 * Calculates trait-based bonuses and penalties for competition scoring
 */

import logger from './logger.mjs';
import { normalizeTraitKey } from './epigeneticTraitKeyMap.mjs';

/**
 * Trait impact definitions for different competition disciplines
 * Each trait has discipline-specific modifiers and general effects
 */
const TRAIT_COMPETITION_EFFECTS = {
  // Positive traits
  resilient: {
    name: 'Resilient',
    type: 'positive',
    general: {
      scoreModifier: 0.03, // +3% to final score
      description: 'Maintains performance under pressure',
    },
    disciplines: {
      'Cross Country': { scoreModifier: 0.05, description: 'Excellent endurance for long courses' },
      Endurance: { scoreModifier: 0.06, description: 'Superior stamina for distance events' },
      Racing: { scoreModifier: 0.04, description: 'Consistent performance in competitive racing' },
    },
  },

  // Equoria-9o3n7.5 §E / Equoria-3hl8c: weatherImmunity + nightVision DO NOT
  // exist in the game (user decision 2026-05-26). Their definitions were
  // removed here, in epigeneticTraits.mjs TRAIT_DEFINITIONS, and in
  // traitEvaluation.mjs RARE trait reveals. No new fantasy/environmental
  // traits are invented in their place. fireResistance/waterPhobia never had
  // entries.
  //
  // Owner ruling 2026-10-27 (q117; Equoria-2d55z): only roster traits keep an
  // entry. Entries for traits no longer on the roster (legendaryBloodline, bold,
  // calm, nervous and the rest) were removed; new roster traits carry no effects.

  eagerLearner: {
    name: 'Eager Learner',
    type: 'positive',
    general: {
      scoreModifier: 0.035, // +3.5% to final score
      adaptabilityBonus: 0.2, // 20% better adaptation to new challenges
      description: 'Shows enthusiasm and quick learning in competitive environments',
    },
    disciplines: {
      Dressage: { scoreModifier: 0.05, description: 'Quickly masters complex movements' },
      Reining: { scoreModifier: 0.045, description: 'Learns intricate patterns rapidly' },
      Eventing: { scoreModifier: 0.04, description: 'Adapts well to varied challenges' },
    },
  },

  // Negative traits
  fragile: {
    name: 'Fragile',
    type: 'negative',
    general: {
      scoreModifier: -0.035, // -3.5% to final score
      injuryRisk: 0.3, // 30% higher injury risk
      description: 'Higher risk of injury and performance inconsistency',
    },
    disciplines: {
      'Cross Country': { scoreModifier: -0.08, description: 'High risk on demanding terrain' },
      'Show Jumping': { scoreModifier: -0.06, description: 'Vulnerable to jumping strain' },
      Racing: { scoreModifier: -0.05, description: 'May not handle racing intensity' },
    },
  },
};

/**
 * Calculate trait-based competition impact for a horse using the new trait effects system
 * @param {Object} horse - Horse object with epigeneticModifiers
 * @param {string} discipline - Competition discipline
 * @param {number} baseScore - Base competition score before trait modifiers
 * @returns {Object} Trait impact results
 */
export function calculateTraitCompetitionImpact(horse, discipline, baseScore) {
  try {
    logger.debug(
      `[traitCompetitionImpact] Calculating trait impact for horse ${horse.id} in ${discipline}`,
    );

    // Initialize results
    const result = {
      totalScoreModifier: 0,
      appliedTraits: [],
      traitBonuses: [],
      traitPenalties: [],
      finalScoreAdjustment: 0,
      details: {
        positiveTraits: 0,
        negativeTraits: 0,
        disciplineSpecific: 0,
        generalEffects: 0,
      },
    };

    // Get horse traits
    const traits = horse.epigeneticModifiers || { positive: [], negative: [], hidden: [] };
    // Normalize legacy snake-case keys so stored traits resolve in the
    // canonical-camelCase effects map until the DB backfill runs (§C).
    const allVisibleTraits = [...(traits.positive || []), ...(traits.negative || [])].map(
      normalizeTraitKey,
    );

    if (allVisibleTraits.length === 0) {
      logger.debug(`[traitCompetitionImpact] No visible traits found for horse ${horse.id}`);
      return result;
    }

    // Process each trait using the trait competition effects system
    allVisibleTraits.forEach(traitName => {
      const traitEffects = getTraitCompetitionEffect(traitName);
      if (!traitEffects) {
        logger.warn(`[traitCompetitionImpact] Unknown trait: ${traitName}`);
        return;
      }

      // Calculate trait impact
      let traitModifier = 0;
      let effectDescription = '';
      let isSpecialized = false;

      // Check for discipline-specific effects first
      if (traitEffects.disciplines && traitEffects.disciplines[discipline]) {
        traitModifier = traitEffects.disciplines[discipline].scoreModifier;
        effectDescription = traitEffects.disciplines[discipline].description;
        isSpecialized = true;
        result.details.disciplineSpecific += Math.abs(traitModifier);
      } else if (traitEffects.general && traitEffects.general.scoreModifier) {
        // Use general competition score modifier
        traitModifier = traitEffects.general.scoreModifier;
        effectDescription = traitEffects.general.description;
        result.details.generalEffects += Math.abs(traitModifier);
      }

      // Only process traits that have competition effects
      if (traitModifier !== 0) {
        // Determine trait type based on modifier
        const traitType = traitModifier > 0 ? 'positive' : 'negative';

        // Track trait application
        const traitApplication = {
          name: traitName,
          type: traitType,
          modifier: traitModifier,
          description: effectDescription,
          isSpecialized,
          discipline: isSpecialized ? discipline : 'general',
        };

        result.appliedTraits.push(traitApplication);

        // Categorize bonuses and penalties
        if (traitModifier > 0) {
          result.traitBonuses.push(traitApplication);
          result.details.positiveTraits++;
        } else if (traitModifier < 0) {
          result.traitPenalties.push(traitApplication);
          result.details.negativeTraits++;
        }

        // Add to total modifier
        result.totalScoreModifier += traitModifier;
      }
    });

    // Apply diminishing returns for multiple traits
    const diminishingFactor = calculateDiminishingReturns(result.appliedTraits.length);
    result.totalScoreModifier *= diminishingFactor;

    // Calculate final score adjustment
    result.finalScoreAdjustment = baseScore * result.totalScoreModifier;

    logger.info(
      `[traitCompetitionImpact] Horse ${horse.id}: ${result.appliedTraits.length} traits applied, ${(result.totalScoreModifier * 100).toFixed(1)}% modifier, ${result.finalScoreAdjustment.toFixed(1)} point adjustment`,
    );

    return result;
  } catch (error) {
    logger.error(`[traitCompetitionImpact] Error calculating trait impact: ${error.message}`);
    return {
      totalScoreModifier: 0,
      appliedTraits: [],
      traitBonuses: [],
      traitPenalties: [],
      finalScoreAdjustment: 0,
      details: { positiveTraits: 0, negativeTraits: 0, disciplineSpecific: 0, generalEffects: 0 },
    };
  }
}

/**
 * Calculate diminishing returns for multiple traits
 * Prevents trait stacking from becoming overpowered
 * @param {number} traitCount - Number of applied traits
 * @returns {number} Diminishing factor (0.5 to 1.0)
 */
function calculateDiminishingReturns(traitCount) {
  if (traitCount <= 1) {
    return 1.0;
  }
  if (traitCount === 2) {
    return 0.95;
  }
  if (traitCount === 3) {
    return 0.9;
  }
  if (traitCount === 4) {
    return 0.85;
  }
  if (traitCount >= 5) {
    return 0.8;
  }
  return 1.0;
}

/**
 * Get trait competition effects for a specific trait
 * @param {string} traitName - Name of the trait
 * @returns {Object|null} Trait effects or null if not found
 */
export function getTraitCompetitionEffect(traitName) {
  return TRAIT_COMPETITION_EFFECTS[traitName] || null;
}

/**
 * Get all available trait effects
 * @returns {Object} All trait competition effects
 */
export function getAllTraitCompetitionEffects() {
  return TRAIT_COMPETITION_EFFECTS;
}

/**
 * Check if a trait has discipline-specific effects
 * @param {string} traitName - Name of the trait
 * @param {string} discipline - Competition discipline
 * @returns {boolean} Whether trait has specific effects for this discipline
 */
export function hasSpecializedEffect(traitName, discipline) {
  const traitEffect = TRAIT_COMPETITION_EFFECTS[traitName];
  return !!(traitEffect && traitEffect.disciplines && traitEffect.disciplines[discipline]);
}
