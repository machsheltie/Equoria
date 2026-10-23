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

import logger from '../../../utils/logger.mjs';

// Enhanced interaction types with contextual variations
export const ENHANCED_INTERACTIONS = {
  // Basic care interactions
  DAILY_CARE: {
    id: 'dailyCare',
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
    id: 'trainingSupport',
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
    id: 'healthCheck',
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
    id: 'bondingTime',
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
    conditions: ['relationship_level >= 2'],
    effects: { bonding: 15, memory: true },
  },

  PERFECT_HARMONY: {
    id: 'perfectHarmony',
    name: 'Perfect Harmony',
    probability: 0.03, // 3% chance
    conditions: ['relationship_level >= 4', 'groom_specialty_match'],
    effects: { bonding: 20, memory: true },
  },

  LEARNING_MOMENT: {
    id: 'learningMoment',
    name: 'Learning Moment',
    probability: 0.08, // 8% chance
    // Equoria-yny4: horse.age is game-years (post Equoria-son6). 3 game-years
    // is the foal-care upper bound (was 1095 days pre-migration).
    conditions: ['horse_age < 3'], // Under 3 game-years
    effects: { bonding: 8, development: 5 },
  },

  PLAYFUL_INTERACTION: {
    id: 'playfulInteraction',
    name: 'Playful Moment',
    probability: 0.1, // 10% chance
    // Equoria-yny4: horse.age is game-years (post Equoria-son6). 2 game-years
    // is the playful-foal upper bound (was 730 days pre-migration).
    conditions: ['horse_age < 2'], // Under 2 game-years
    effects: { bonding: 10, joy: 5 },
  },
};

/**
 * The interaction whose id is `interactionType` (e.g. `dailyCare`), or undefined.
 * Matched on `id`, not by upper-casing into the DAILY_CARE key, because the ids
 * are camelCase.
 */
export function findEnhancedInteraction(interactionType) {
  return Object.values(ENHANCED_INTERACTIONS).find(
    interaction => interaction.id === interactionType,
  );
}

/**
 * The stored interaction type for one variation: `dailyCare` + "Morning Routine"
 * -> `dailyCareMorningRoutine`. Every run of non-alphanumerics is a word break,
 * so "Pre-Training Prep" -> `PreTrainingPrep`.
 */
export function interactionWithVariationKey(interactionType, variation) {
  const words = variation.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return (
    interactionType +
    words.map(word => word[0].toUpperCase() + word.slice(1).toLowerCase()).join('')
  );
}

// Groom preferences based on personality and specialty
export const GROOM_PREFERENCES = {
  gentle: {
    preferredInteractions: ['bondingTime', 'dailyCare'],
    preferredContexts: ['peaceful', 'trust', 'routine'],
    bonusMultiplier: 1.2,
  },

  energetic: {
    preferredInteractions: ['enrichment', 'trainingSupport'],
    preferredContexts: ['social', 'practice', 'mental'],
    bonusMultiplier: 1.3,
  },

  patient: {
    preferredInteractions: ['bondingTime', 'trainingSupport'],
    preferredContexts: ['trust', 'confidence', 'preparation'],
    bonusMultiplier: 1.2,
  },

  strict: {
    preferredInteractions: ['trainingSupport', 'healthCheck'],
    preferredContexts: ['practice', 'thorough', 'preventive'],
    bonusMultiplier: 1.1,
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
  const {
    groom: _groom,
    horse: _horse,
    relationshipLevel: _relationshipLevel,
    interactionType: _interactionType,
  } = context;

  for (const [eventId, event] of Object.entries(SPECIAL_EVENTS)) {
    // Check probability
    if (Math.random() > event.probability) {
      continue;
    }

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

  if (condition.includes('horse_age <')) {
    const threshold = parseInt(condition.split('<')[1].trim());
    return (horse.age || 0) < threshold;
  }

  if (condition === 'groom_specialty_match') {
    // Equoria-yny4: horse.age is game-years (post Equoria-son6). Foal-care
    // window = 0-3 game-years (was 1095 days pre-migration).
    return groom.speciality === 'foalCare' && horse.age < 3;
  }

  return false;
}

/**
 * Get available interaction variations for a groom and horse
 * @param {Object} groom - Groom object
 * @param {Object} horse - Horse object
 * @returns {Array} Available interactions with variations
 */
export function getAvailableInteractions(groom, horse) {
  const available = [];

  for (const [_key, interaction] of Object.entries(ENHANCED_INTERACTIONS)) {
    // Check if groom can perform this interaction type
    if (canPerformInteraction(groom, horse, interaction)) {
      const interactionData = {
        id: interaction.id,
        name: interaction.name,
        category: interaction.category,
        baseTime: interaction.baseTime,
        // Equoria-tfo3c (owner ruling, 2026-09-14): care costs nothing, so the menu
        // quotes no price. `estimatedCost` was computed from the groom's session
        // rate and never charged to anyone.
        variations: interaction.variations.map(variation => ({ ...variation })),
      };

      available.push(interactionData);
    }
  }

  return available;
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
  if (interaction.category === 'care') {
    return true;
  }

  // Specialty-based restrictions
  if (interaction.category === 'medical' && groom.speciality !== 'medical') {
    return groom.skillLevel === 'expert' || groom.skillLevel === 'master';
  }

  if (interaction.category === 'training' && groom.speciality !== 'training') {
    return (
      groom.skillLevel === 'intermediate' ||
      groom.skillLevel === 'expert' ||
      groom.skillLevel === 'master'
    );
  }

  // Age-based restrictions
  // Equoria-yny4: horse.age is game-years (post Equoria-son6). Enrichment
  // is for horses UNDER 3 game-years (owner ruling 2026-10-14; Equoria-fjgzp:
  // age 3 itself is excluded).
  if (interaction.category === 'enrichment' && horse.age >= 3) {
    return false;
  }

  return true;
}
