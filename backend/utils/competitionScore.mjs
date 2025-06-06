import logger from './logger.mjs';

/**
 * Calculate competition score for a horse in a specific event type
 * @param {Object} horse - Horse object with stats and traits
 * @param {string} eventType - Competition discipline (e.g., 'Racing', 'Show Jumping', 'Dressage')
 * @returns {number} Final rounded competition score
 */
export function calculateCompetitionScore(horse, eventType) {
  try {
    // Input validation
    if (!horse || typeof horse !== 'object') {
      throw new Error('Horse object is required');
    }

    if (!eventType || typeof eventType !== 'string') {
      throw new Error('Event type is required and must be a string');
    }

    // Normalize event type for consistency
    const normalizedEventType = eventType.trim();

    // Calculate base score based on discipline-specific stat contributions
    let baseScore = 0;

    switch (normalizedEventType) {
      case 'Racing':
        baseScore = (horse.speed || 0) + (horse.stamina || 0) + (horse.focus || 0);
        break;

      case 'Show Jumping':
      case 'Jumping':
        baseScore =
          (horse.precision || horse.agility || 0) + (horse.focus || 0) + (horse.stamina || 0);
        break;

      case 'Dressage':
        baseScore =
          (horse.precision || horse.agility || 0) +
          (horse.focus || 0) +
          (horse.coordination || horse.balance || 0);
        break;

      case 'Cross Country':
        baseScore = (horse.stamina || 0) + (horse.agility || 0) + (horse.boldness || 0);
        break;

      default:
        logger.warn(
          `[calculateCompetitionScore] Unknown event type: ${normalizedEventType}, using default calculation`,
        );
        baseScore = (horse.speed || 0) + (horse.stamina || 0) + (horse.focus || 0);
    }

    logger.info(
      `[calculateCompetitionScore] Horse ${horse.name || horse.id}: Base score for ${normalizedEventType}: ${baseScore}`,
      `[calculateCompetitionScore] Horse ${horse.name || horse.id}: Base score for ${normalizedEventType}: ${baseScore}`,
    );

    // Check for matching discipline affinity trait
    let traitBonus = 0;
    const epigeneticModifiers = horse.epigenetic_modifiers;

    if (epigeneticModifiers?.positive && Array.isArray(epigeneticModifiers.positive)) {
      // Convert event type to trait name format
      const traitName = convertEventTypeToTraitName(normalizedEventType);

      if (epigeneticModifiers.positive.includes(traitName)) {
        traitBonus = 5;
        logger.info(
          `[calculateCompetitionScore] Horse ${horse.name || horse.id}: Discipline affinity bonus applied for ${traitName} (+${traitBonus} points)`,
          `[calculateCompetitionScore] Horse ${horse.name || horse.id}: Discipline affinity bonus applied for ${traitName} (+${traitBonus} points)`,
        );
      }
    }

    // Apply trait bonus
    const scoreWithTraitBonus = baseScore + traitBonus;

    // Apply ±9% random luck modifier
    // Ensure the range is exactly -0.09 to +0.09 (±9%)
    const randomValue = Math.random(); // 0 to 1
    const luckModifier = randomValue * 0.18 - 0.09; // Range: -0.09 to +0.09 (±9%)

    // Clamp to ensure we never exceed ±9% due to floating point precision
    const clampedLuckModifier = Math.max(-0.09, Math.min(0.09, luckModifier));
    const luckAdjustment = scoreWithTraitBonus * clampedLuckModifier;

    logger.info(
      `[calculateCompetitionScore] Horse ${horse.name || horse.id}: Luck modifier: ${(clampedLuckModifier * 100).toFixed(1)}%, adjustment: ${luckAdjustment.toFixed(1)}`,
      `[calculateCompetitionScore] Horse ${horse.name || horse.id}: Luck modifier: ${(clampedLuckModifier * 100).toFixed(1)}%, adjustment: ${luckAdjustment.toFixed(1)}`,
    );

    // Calculate final score
    const finalScore = scoreWithTraitBonus + luckAdjustment;
    const roundedScore = Math.round(finalScore);

    logger.info(
      `[calculateCompetitionScore] Horse ${horse.name || horse.id}: Final score: ${roundedScore} (base: ${baseScore}, trait: +${traitBonus}, luck: ${luckAdjustment.toFixed(1)})`,
      `[calculateCompetitionScore] Horse ${horse.name || horse.id}: Final score: ${roundedScore} (base: ${baseScore}, trait: +${traitBonus}, luck: ${luckAdjustment.toFixed(1)})`,
    );

    return roundedScore;
  } catch (error) {
    logger.error(
      `[calculateCompetitionScore] Error calculating score for horse ${horse?.name || horse?.id}: ${error.message}`,
      `[calculateCompetitionScore] Error calculating score for horse ${horse?.name || horse?.id}: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Convert event type to discipline affinity trait name
 * @param {string} eventType - Competition discipline
 * @returns {string} Trait name in format discipline_affinity_<type>
 */
function convertEventTypeToTraitName(eventType) {
  const eventTypeMap = {
    Racing: 'discipline_affinity_racing',
    'Show Jumping': 'discipline_affinity_show_jumping',
    Jumping: 'discipline_affinity_show_jumping',
    Dressage: 'discipline_affinity_dressage',
    'Cross Country': 'discipline_affinity_cross_country',
  };

  return (
    eventTypeMap[eventType] || `discipline_affinity_${eventType.toLowerCase().replace(/\s+/g, '_')}`
  );
}

/**
 * Get discipline-specific stat weights for scoring
 * @param {string} eventType - Competition discipline
 * @returns {Object} Object with stat names and their weights
 */
export function getDisciplineStatWeights(eventType) {
  const weights = {
    Racing: {
      speed: 1.0,
      stamina: 1.0,
      focus: 1.0,
    },
    'Show Jumping': {
      precision: 1.0,
      focus: 1.0,
      stamina: 1.0,
    },
    Jumping: {
      precision: 1.0,
      focus: 1.0,
      stamina: 1.0,
    },
    Dressage: {
      precision: 1.0,
      focus: 1.0,
      coordination: 1.0,
    },
    'Cross Country': {
      stamina: 1.0,
      agility: 1.0,
      boldness: 1.0,
    },
  };

  return weights[eventType] || weights['Racing']; // Default to Racing weights
}

/**
 * Validate horse object has required stats for competition
 * @param {Object} horse - Horse object to validate
 * @param {string} eventType - Competition discipline
 * @returns {boolean} True if horse has required stats
 */
export function validateHorseForCompetition(horse, eventType) {
  if (!horse || typeof horse !== 'object') {
    return false;
  }

  const requiredStats = getDisciplineStatWeights(eventType);

  // Check if horse has at least one of the required stats
  return Object.keys(requiredStats).some(stat => {
    const value = horse[stat];
    return typeof value === 'number' && value >= 0;
  });
}

export default calculateCompetitionScore;
