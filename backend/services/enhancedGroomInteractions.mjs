/**
 * Enhanced Groom Interaction System
 * Provides rich, dynamic interactions between grooms and horses
 *
 * Features:
 * - Relationship progression system
 * - Special interaction events
 * - Groom preferences and specializations
 * - Dynamic interaction quality
 * - Memorable moments and breakthroughs
 * - Seasonal and contextual interactions
 */

import logger from '../utils/logger.mjs';
import { recordGroomPerformance } from './groomPerformanceService.mjs';

// Enhanced interaction types with contextual variations
export const ENHANCED_INTERACTIONS = {
  // Basic care interactions
  DAILY_CARE: {
    id: 'daily_care',
    name: 'Daily Care',
    category: 'care',
    baseTime: 30,
    variations: [
      { name: 'Morning Routine', context: 'morning', bonusMultiplier: 1.1 },
      { name: 'Evening Care', context: 'evening', bonusMultiplier: 1.0 },
      { name: 'Thorough Inspection', context: 'detailed', bonusMultiplier: 1.2 },
    ],
  },

  // Enrichment interactions
  ENRICHMENT: {
    id: 'enrichment',
    name: 'Enrichment Activity',
    category: 'enrichment',
    baseTime: 45,
    variations: [
      { name: 'Puzzle Feeding', context: 'mental', bonusMultiplier: 1.3 },
      { name: 'Sensory Exploration', context: 'sensory', bonusMultiplier: 1.2 },
      { name: 'Social Play', context: 'social', bonusMultiplier: 1.4 },
    ],
  },

  // Training support interactions
  TRAINING_SUPPORT: {
    id: 'training_support',
    name: 'Training Support',
    category: 'training',
    baseTime: 60,
    variations: [
      { name: 'Pre-Training Prep', context: 'preparation', bonusMultiplier: 1.2 },
      { name: 'Post-Training Care', context: 'recovery', bonusMultiplier: 1.3 },
      { name: 'Skill Reinforcement', context: 'practice', bonusMultiplier: 1.4 },
    ],
  },

  // Medical and health interactions
  HEALTH_CHECK: {
    id: 'health_check',
    name: 'Health Assessment',
    category: 'medical',
    baseTime: 20,
    variations: [
      { name: 'Routine Check', context: 'routine', bonusMultiplier: 1.0 },
      { name: 'Detailed Examination', context: 'thorough', bonusMultiplier: 1.3 },
      { name: 'Preventive Care', context: 'preventive', bonusMultiplier: 1.2 },
    ],
  },

  // Special bonding interactions
  BONDING_TIME: {
    id: 'bonding_time',
    name: 'Quality Time',
    category: 'bonding',
    baseTime: 40,
    variations: [
      { name: 'Quiet Companionship', context: 'peaceful', bonusMultiplier: 1.3 },
      { name: 'Trust Building', context: 'trust', bonusMultiplier: 1.4 },
      { name: 'Confidence Building', context: 'confidence', bonusMultiplier: 1.2 },
    ],
  },
};

// Relationship progression levels
export const RELATIONSHIP_LEVELS = {
  STRANGER: { level: 0, name: 'Stranger', threshold: 0, multiplier: 0.8 },
  ACQUAINTANCE: { level: 1, name: 'Acquaintance', threshold: 20, multiplier: 1.0 },
  FAMILIAR: { level: 2, name: 'Familiar', threshold: 50, multiplier: 1.1 },
  TRUSTED: { level: 3, name: 'Trusted', threshold: 100, multiplier: 1.2 },
  BONDED: { level: 4, name: 'Bonded', threshold: 200, multiplier: 1.3 },
  DEVOTED: { level: 5, name: 'Devoted', threshold: 350, multiplier: 1.4 },
  SOULMATE: { level: 6, name: 'Soulmate', threshold: 500, multiplier: 1.5 },
};

// Special events that can occur during interactions
export const SPECIAL_EVENTS = {
  BREAKTHROUGH: {
    id: 'breakthrough',
    name: 'Breakthrough Moment',
    probability: 0.05, // 5% chance
    conditions: ['relationship_level >= 2', 'stress_level < 30'],
    effects: { bonding: 15, stress: -10, memory: true },
  },

  PERFECT_HARMONY: {
    id: 'perfect_harmony',
    name: 'Perfect Harmony',
    probability: 0.03, // 3% chance
    conditions: ['relationship_level >= 4', 'groom_specialty_match'],
    effects: { bonding: 20, stress: -15, memory: true },
  },

  LEARNING_MOMENT: {
    id: 'learning_moment',
    name: 'Learning Moment',
    probability: 0.08, // 8% chance
    conditions: ['horse_age < 1095'], // Under 3 years
    effects: { bonding: 8, stress: -5, development: 5 },
  },

  COMFORT_PROVIDED: {
    id: 'comfort_provided',
    name: 'Comfort in Distress',
    probability: 0.12, // 12% chance when stressed
    conditions: ['stress_level > 60'],
    effects: { bonding: 12, stress: -20, memory: true },
  },

  PLAYFUL_INTERACTION: {
    id: 'playful_interaction',
    name: 'Playful Moment',
    probability: 0.10, // 10% chance
    conditions: ['horse_age < 730', 'stress_level < 40'], // Under 2 years, low stress
    effects: { bonding: 10, stress: -8, joy: 5 },
  },
};

// Groom preferences based on personality and specialty
export const GROOM_PREFERENCES = {
  gentle: {
    preferred_interactions: ['bonding_time', 'daily_care'],
    preferred_contexts: ['peaceful', 'trust', 'routine'],
    bonus_multiplier: 1.2,
  },

  energetic: {
    preferred_interactions: ['enrichment', 'training_support'],
    preferred_contexts: ['social', 'practice', 'mental'],
    bonus_multiplier: 1.3,
  },

  patient: {
    preferred_interactions: ['bonding_time', 'training_support'],
    preferred_contexts: ['trust', 'confidence', 'preparation'],
    bonus_multiplier: 1.2,
  },

  strict: {
    preferred_interactions: ['training_support', 'health_check'],
    preferred_contexts: ['practice', 'thorough', 'preventive'],
    bonus_multiplier: 1.1,
  },
};

/**
 * Calculate relationship level between groom and horse
 * @param {number} totalBondingPoints - Total bonding points accumulated
 * @returns {Object} Relationship level information
 */
export function calculateRelationshipLevel(totalBondingPoints) {
  const levels = Object.values(RELATIONSHIP_LEVELS).sort((a, b) => b.threshold - a.threshold);

  for (const level of levels) {
    if (totalBondingPoints >= level.threshold) {
      return level;
    }
  }

  return RELATIONSHIP_LEVELS.STRANGER;
}

/**
 * Check if special event should occur during interaction
 * @param {Object} context - Interaction context
 * @returns {Object|null} Special event or null
 */
export function checkForSpecialEvent(context) {
  const { groom, horse, relationshipLevel, interactionType } = context;

  for (const [eventId, event] of Object.entries(SPECIAL_EVENTS)) {
    // Check probability
    if (Math.random() > event.probability) { continue; }

    // Check conditions
    let conditionsMet = true;
    for (const condition of event.conditions) {
      if (!evaluateCondition(condition, context)) {
        conditionsMet = false;
        break;
      }
    }

    if (conditionsMet) {
      logger.info(`[enhancedGroomInteractions] Special event triggered: ${event.name}`);
      return { ...event, id: eventId };
    }
  }

  return null;
}

/**
 * Evaluate a condition string
 * @param {string} condition - Condition to evaluate
 * @param {Object} context - Context for evaluation
 * @returns {boolean} Whether condition is met
 */
function evaluateCondition(condition, context) {
  const { groom, horse, relationshipLevel } = context;

  // Simple condition evaluation (could be expanded)
  if (condition.includes('relationship_level >=')) {
    const threshold = parseInt(condition.split('>=')[1].trim());
    return relationshipLevel.level >= threshold;
  }

  if (condition.includes('stress_level <')) {
    const threshold = parseInt(condition.split('<')[1].trim());
    return (horse.stressLevel || 0) < threshold;
  }

  if (condition.includes('stress_level >')) {
    const threshold = parseInt(condition.split('>')[1].trim());
    return (horse.stressLevel || 0) > threshold;
  }

  if (condition.includes('horse_age <')) {
    const threshold = parseInt(condition.split('<')[1].trim());
    return (horse.age || 0) < threshold;
  }

  if (condition === 'groom_specialty_match') {
    // Check if groom's specialty matches the interaction type
    return groom.speciality === 'foalCare' && horse.age < 1095; // 3 years
  }

  return false;
}

/**
 * Calculate enhanced interaction effects
 * @param {Object} groom - Groom performing interaction
 * @param {Object} horse - Horse receiving interaction
 * @param {string} interactionType - Type of interaction
 * @param {string} variation - Specific variation of interaction
 * @param {number} duration - Duration in minutes
 * @returns {Object} Calculated effects
 */
export function calculateEnhancedEffects(groom, horse, interactionType, variation, duration) {
  try {
    // Get base interaction data
    const interaction = ENHANCED_INTERACTIONS[interactionType.toUpperCase()];
    if (!interaction) {
      throw new Error(`Unknown interaction type: ${interactionType}`);
    }

    // Find specific variation
    const variationData = interaction.variations.find(v => v.name === variation) || interaction.variations[0];

    // Calculate relationship level
    const totalBonding = horse.bondScore || 0;
    const relationshipLevel = calculateRelationshipLevel(totalBonding);

    // Base effects calculation
    const baseBonding = Math.floor((duration / 30) * (3 + Math.random() * 4)); // 3-7 per 30 min
    const baseStress = -Math.floor((duration / 30) * (2 + Math.random() * 3)); // -2 to -5 per 30 min

    // Apply variation multiplier
    let bonding = Math.round(baseBonding * variationData.bonusMultiplier);
    let stress = Math.round(baseStress * variationData.bonusMultiplier);

    // Apply relationship level multiplier
    bonding = Math.round(bonding * relationshipLevel.multiplier);
    stress = Math.round(stress * relationshipLevel.multiplier);

    // Apply groom preference bonus
    const preferences = GROOM_PREFERENCES[groom.personality];
    if (preferences) {
      if (preferences.preferred_interactions.includes(interaction.id)) {
        bonding = Math.round(bonding * preferences.bonus_multiplier);
      }

      if (preferences.preferred_contexts.includes(variationData.context)) {
        bonding = Math.round(bonding * 1.1);
        stress = Math.round(stress * 1.1);
      }
    }

    // Check for special events
    const context = { groom, horse, relationshipLevel, interactionType };
    const specialEvent = checkForSpecialEvent(context);

    if (specialEvent) {
      bonding += specialEvent.effects.bonding || 0;
      stress += specialEvent.effects.stress || 0;
    }

    // Ensure reasonable bounds
    bonding = Math.max(1, Math.min(25, bonding));
    stress = Math.max(-20, Math.min(5, stress));

    const result = {
      bondingChange: bonding,
      stressChange: stress,
      quality: calculateInteractionQuality(bonding, stress),
      relationshipLevel: relationshipLevel.name,
      variation: variationData.name,
      specialEvent: specialEvent || null,
      duration,
      cost: calculateInteractionCost(groom, duration),
    };

    logger.info(`[enhancedGroomInteractions] Calculated effects: +${bonding} bonding, ${stress} stress, quality: ${result.quality}`);

    return result;

  } catch (error) {
    logger.error(`[enhancedGroomInteractions] Error calculating effects: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate interaction quality based on effects
 * @param {number} bonding - Bonding change
 * @param {number} stress - Stress change
 * @returns {string} Quality rating
 */
function calculateInteractionQuality(bonding, stress) {
  const score = bonding + Math.abs(stress);

  if (score >= 20) { return 'exceptional'; }
  if (score >= 15) { return 'excellent'; }
  if (score >= 10) { return 'good'; }
  if (score >= 5) { return 'fair'; }
  return 'poor';
}

/**
 * Calculate cost of interaction based on groom and duration
 * @param {Object} groom - Groom performing interaction
 * @param {number} duration - Duration in minutes
 * @returns {number} Cost in currency
 */
function calculateInteractionCost(groom, duration) {
  const hourlyRate = groom.sessionRate || 20;
  return Math.round((duration / 60) * hourlyRate * 100) / 100; // Round to 2 decimal places
}

/**
 * Get available interaction variations for a groom and horse
 * @param {Object} groom - Groom object
 * @param {Object} horse - Horse object
 * @returns {Array} Available interactions with variations
 */
export function getAvailableInteractions(groom, horse) {
  const available = [];

  for (const [key, interaction] of Object.entries(ENHANCED_INTERACTIONS)) {
    // Check if groom can perform this interaction type
    if (canPerformInteraction(groom, horse, interaction)) {
      const interactionData = {
        id: interaction.id,
        name: interaction.name,
        category: interaction.category,
        baseTime: interaction.baseTime,
        variations: interaction.variations.map(variation => ({
          ...variation,
          estimatedCost: calculateInteractionCost(groom, interaction.baseTime),
        })),
      };

      available.push(interactionData);
    }
  }

  return available;
}

/**
 * Process a complete groom interaction with performance tracking
 * @param {Object} groom - Groom performing interaction
 * @param {Object} horse - Horse receiving interaction
 * @param {string} userId - User ID
 * @param {string} interactionType - Type of interaction
 * @param {string} variation - Specific variation
 * @param {number} duration - Duration in minutes
 * @returns {Object} Complete interaction result with performance tracking
 */
export async function processInteractionWithPerformance(groom, horse, userId, interactionType, variation, duration) {
  try {
    // Calculate interaction effects
    const effects = calculateEnhancedEffects(groom, horse, interactionType, variation, duration);

    // Determine task success based on interaction quality
    const taskSuccess = ['excellent', 'exceptional'].includes(effects.quality);

    // Calculate wellbeing impact (stress reduction is positive wellbeing)
    const wellbeingImpact = Math.abs(effects.stressChange) / 4; // Convert stress to wellbeing scale

    // Record performance asynchronously (don't block interaction)
    recordGroomPerformance(groom.id, userId, interactionType, {
      horseId: horse.id,
      bondGain: effects.bondingChange,
      taskSuccess,
      wellbeingImpact,
      duration,
      playerRating: null, // Could be added later via separate rating system
    }).catch(error => {
      logger.error(`[enhancedGroomInteractions] Failed to record performance: ${error.message}`);
    });

    logger.info(`[enhancedGroomInteractions] Processed interaction with performance tracking: ${interactionType} (${variation})`);

    return {
      ...effects,
      performanceTracked: true,
      taskSuccess,
      wellbeingImpact,
    };

  } catch (error) {
    logger.error(`[enhancedGroomInteractions] Error processing interaction with performance: ${error.message}`);
    throw error;
  }
}

/**
 * Check if groom can perform specific interaction
 * @param {Object} groom - Groom object
 * @param {Object} horse - Horse object
 * @param {Object} interaction - Interaction object
 * @returns {boolean} Whether interaction is available
 */
function canPerformInteraction(groom, horse, interaction) {
  // Basic availability - all grooms can do basic care
  if (interaction.category === 'care') { return true; }

  // Specialty-based restrictions
  if (interaction.category === 'medical' && groom.speciality !== 'medical') {
    return groom.skillLevel === 'expert' || groom.skillLevel === 'master';
  }

  if (interaction.category === 'training' && groom.speciality !== 'training') {
    return groom.skillLevel === 'intermediate' || groom.skillLevel === 'expert' || groom.skillLevel === 'master';
  }

  // Age-based restrictions
  if (interaction.category === 'enrichment' && horse.age > 1095) { // Over 3 years
    return false;
  }

  return true;
}
