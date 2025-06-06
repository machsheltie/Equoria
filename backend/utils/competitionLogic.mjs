/**
 * Competition Logic Module
 *
 * Handles competition scoring and calculations for horse competitions.
 * Uses minimal mocking approach - real business logic with deterministic results.
 */

import logger from './logger.mjs';

/**
 * Calculate competition score based on horse attributes and discipline
 * @param {number} disciplineScore - Horse's score in the specific discipline
 * @param {Object} traits - Horse's traits (epigenetic modifiers)
 * @param {number} age - Horse's age
 * @param {string} discipline - Competition discipline
 * @returns {number} Competition score (0-100)
 */
export function calculateCompetitionScore(disciplineScore, traits, age, discipline) {
  try {
    // Base score from discipline training
    let score = disciplineScore || 0;

    // Age factor (peak performance around 5-8 years)
    let ageFactor = 1.0;
    if (age < 3) {
      ageFactor = 0.5; // Too young
    } else if (age >= 3 && age <= 5) {
      ageFactor = 0.8 + (age - 3) * 0.1; // Improving
    } else if (age >= 6 && age <= 8) {
      ageFactor = 1.0; // Peak performance
    } else if (age >= 9 && age <= 12) {
      ageFactor = 1.0 - (age - 8) * 0.05; // Gradual decline
    } else {
      ageFactor = 0.7; // Senior horse
    }

    // Apply age factor
    score *= ageFactor;

    // Trait bonuses (from epigenetic modifiers)
    let traitBonus = 0;
    const positiveTraits = traits?.positive || [];
    const negativeTraits = traits?.negative || [];

    // Discipline-specific trait bonuses and stat mappings
    const disciplineConfig = {
      'Western Pleasure': {
        stats: ['focus', 'obedience', 'intelligence'],
        beneficial: ['calm', 'people_trusting', 'focused', 'intelligent'],
        detrimental: ['nervous', 'aggressive', 'stubborn'],
      },
      Reining: {
        stats: ['agility', 'precision', 'focus'],
        beneficial: ['athletic', 'focused', 'intelligent', 'agile'],
        detrimental: ['clumsy', 'nervous', 'stubborn'],
      },
      Cutting: {
        stats: ['intelligence', 'agility', 'boldness'],
        beneficial: ['intelligent', 'athletic', 'brave', 'focused'],
        detrimental: ['slow', 'nervous', 'fearful'],
      },
      'Barrel Racing': {
        stats: ['speed', 'agility', 'obedience'],
        beneficial: ['fast', 'athletic', 'focused', 'brave'],
        detrimental: ['slow', 'clumsy', 'nervous'],
      },
      Roping: {
        stats: ['precision', 'focus', 'speed'],
        beneficial: ['focused', 'precise', 'fast', 'intelligent'],
        detrimental: ['clumsy', 'nervous', 'slow'],
      },
      'Team Penning': {
        stats: ['intelligence', 'agility', 'stamina'],
        beneficial: ['intelligent', 'athletic', 'resilient', 'focused'],
        detrimental: ['slow', 'weak', 'nervous'],
      },
      Rodeo: {
        stats: ['boldness', 'agility', 'stamina'],
        beneficial: ['brave', 'athletic', 'resilient', 'powerful'],
        detrimental: ['fearful', 'weak', 'nervous'],
      },
      Hunter: {
        stats: ['balance', 'precision', 'intelligence'],
        beneficial: ['balanced', 'precise', 'intelligent', 'calm'],
        detrimental: ['clumsy', 'nervous', 'aggressive'],
      },
      Saddleseat: {
        stats: ['flexibility', 'balance', 'obedience'],
        beneficial: ['flexible', 'balanced', 'people_trusting', 'focused'],
        detrimental: ['stiff', 'clumsy', 'stubborn'],
      },
      Endurance: {
        stats: ['stamina', 'intelligence', 'speed'],
        beneficial: ['resilient', 'intelligent', 'fast', 'focused'],
        detrimental: ['weak', 'slow', 'lazy'],
      },
      Eventing: {
        stats: ['stamina', 'boldness', 'agility'],
        beneficial: ['brave', 'athletic', 'resilient', 'focused'],
        detrimental: ['fearful', 'weak', 'nervous'],
      },
      Dressage: {
        stats: ['precision', 'focus', 'obedience'],
        beneficial: ['focused', 'intelligent', 'calm', 'people_trusting'],
        detrimental: ['nervous', 'aggressive', 'stubborn'],
      },
      'Show Jumping': {
        stats: ['balance', 'agility', 'boldness'],
        beneficial: ['brave', 'athletic', 'focused', 'powerful'],
        detrimental: ['nervous', 'clumsy', 'fearful'],
      },
      Vaulting: {
        stats: ['flexibility', 'balance', 'obedience'],
        beneficial: ['flexible', 'balanced', 'calm', 'people_trusting'],
        detrimental: ['stiff', 'nervous', 'aggressive'],
      },
      Polo: {
        stats: ['speed', 'boldness', 'agility'],
        beneficial: ['fast', 'brave', 'athletic', 'focused'],
        detrimental: ['slow', 'fearful', 'clumsy'],
      },
      'Cross Country': {
        stats: ['stamina', 'boldness', 'intelligence'],
        beneficial: ['brave', 'athletic', 'resilient', 'intelligent'],
        detrimental: ['nervous', 'weak', 'fearful'],
      },
      'Combined Driving': {
        stats: ['obedience', 'stamina', 'focus'],
        beneficial: ['people_trusting', 'resilient', 'focused', 'intelligent'],
        detrimental: ['stubborn', 'nervous', 'weak'],
      },
      'Fine Harness': {
        stats: ['flexibility', 'precision', 'balance'],
        beneficial: ['flexible', 'precise', 'balanced', 'focused'],
        detrimental: ['stiff', 'clumsy', 'nervous'],
      },
      Gaited: {
        stats: ['flexibility', 'balance', 'obedience'],
        beneficial: ['flexible', 'balanced', 'gaited', 'calm'],
        detrimental: ['stiff', 'clumsy', 'nervous'],
        requiresTrait: 'gaited',
      },
      Gymkhana: {
        stats: ['speed', 'flexibility', 'focus'],
        beneficial: ['fast', 'flexible', 'focused', 'athletic'],
        detrimental: ['slow', 'stiff', 'nervous'],
      },
      Steeplechase: {
        stats: ['stamina', 'boldness', 'balance'],
        beneficial: ['resilient', 'brave', 'balanced', 'athletic'],
        detrimental: ['weak', 'fearful', 'clumsy'],
      },
      Racing: {
        stats: ['speed', 'stamina', 'focus'],
        beneficial: ['fast', 'athletic', 'focused', 'brave', 'resilient'],
        detrimental: ['slow', 'lazy', 'nervous'],
      },
      'Harness Racing': {
        stats: ['speed', 'precision', 'stamina'],
        beneficial: ['fast', 'precise', 'resilient', 'focused'],
        detrimental: ['slow', 'clumsy', 'weak'],
      },
      'Obedience Training': {
        stats: ['obedience', 'precision', 'intelligence'],
        beneficial: ['people_trusting', 'intelligent', 'focused', 'calm'],
        detrimental: ['stubborn', 'aggressive', 'nervous'],
      },
    };

    const disciplineMap = disciplineConfig[discipline] || disciplineConfig['Racing'];

    // Calculate trait bonuses
    positiveTraits.forEach(trait => {
      if (disciplineMap.beneficial.includes(trait)) {
        traitBonus += 3; // +3 points per beneficial trait
      } else {
        traitBonus += 1; // +1 point for other positive traits
      }
    });

    negativeTraits.forEach(trait => {
      if (disciplineMap.detrimental.includes(trait)) {
        traitBonus -= 5; // -5 points per detrimental trait
      } else {
        traitBonus -= 2; // -2 points for other negative traits
      }
    });

    // Apply trait bonus
    score += traitBonus;

    // Random performance factor (using Math.random for some variability)
    // In tests, this will be mocked for deterministic results
    const performanceFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
    score *= performanceFactor;

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, Math.round(score)));

    return score;
  } catch (error) {
    logger.error('[competitionLogic.calculateCompetitionScore] Error:', error.message);
    return 0;
  }
}

/**
 * Calculate prize distribution based on placement
 * @param {number} totalPrizePool - Total prize money available
 * @param {number} placement - Horse's placement (1st, 2nd, 3rd, etc.)
 * @param {number} totalEntries - Total number of entries
 * @returns {number} Prize amount
 */
export function calculatePrizeAmount(totalPrizePool, placement, totalEntries) {
  try {
    if (placement <= 0 || placement > totalEntries) {
      return 0;
    }

    // Prize distribution percentages (4th place gets no earnings)
    const prizeDistribution = {
      1: 0.5, // 50% for 1st place
      2: 0.3, // 30% for 2nd place
      3: 0.2, // 20% for 3rd place (increased from 15% since 4th gets nothing)
    };

    const percentage = prizeDistribution[placement] || 0;
    return Math.round(totalPrizePool * percentage);
  } catch (error) {
    logger.error('[competitionLogic.calculatePrizeAmount] Error:', error.message);
    return 0;
  }
}

/**
 * Calculate XP award based on competition performance
 * @param {number} score - Competition score (0-100)
 * @param {number} placement - Final placement
 * @param {number} totalEntries - Total number of entries
 * @returns {number} XP amount
 */
export function calculateCompetitionXP(score, placement, totalEntries) {
  try {
    let xp = 0;

    // Base XP from score
    xp += Math.floor(score / 10); // 1 XP per 10 score points

    // Placement bonus
    if (placement === 1) {
      xp += 20; // 1st place bonus
    } else if (placement === 2) {
      xp += 15; // 2nd place bonus
    } else if (placement === 3) {
      xp += 10; // 3rd place bonus
    } else if (placement <= Math.ceil(totalEntries / 2)) {
      xp += 5; // Top half bonus
    }

    // Participation XP (minimum)
    xp = Math.max(xp, 3);

    return xp;
  } catch (error) {
    logger.error('[competitionLogic.calculateCompetitionXP] Error:', error.message);
    return 3; // Minimum participation XP
  }
}

/**
 * Determine competition placement based on scores
 * @param {Array} competitionEntries - Array of {horseId, score} objects
 * @returns {Array} Sorted entries with placement
 */
export function calculatePlacements(competitionEntries) {
  try {
    // Sort by score (highest first)
    const sortedEntries = [...competitionEntries].sort((a, b) => b.score - a.score);

    // Assign placements
    return sortedEntries.map((entry, index) => ({
      ...entry,
      placement: index + 1,
    }));
  } catch (error) {
    logger.error('[competitionLogic.calculatePlacements] Error:', error.message);
    return competitionEntries.map((entry, index) => ({
      ...entry,
      placement: index + 1,
    }));
  }
}

/**
 * Get discipline configurations (helper function)
 * @returns {Object} Discipline configuration object
 */
function getDisciplineConfigurations() {
  return {
    'Western Pleasure': {
      stats: ['focus', 'obedience', 'intelligence'],
      beneficial: ['calm', 'people_trusting', 'focused', 'intelligent'],
      detrimental: ['nervous', 'aggressive', 'stubborn'],
    },
    Reining: {
      stats: ['agility', 'precision', 'focus'],
      beneficial: ['athletic', 'focused', 'intelligent', 'agile'],
      detrimental: ['clumsy', 'nervous', 'stubborn'],
    },
    Cutting: {
      stats: ['intelligence', 'agility', 'boldness'],
      beneficial: ['intelligent', 'athletic', 'brave', 'focused'],
      detrimental: ['slow', 'nervous', 'fearful'],
    },
    'Barrel Racing': {
      stats: ['speed', 'agility', 'obedience'],
      beneficial: ['fast', 'athletic', 'focused', 'brave'],
      detrimental: ['slow', 'clumsy', 'nervous'],
    },
    Roping: {
      stats: ['precision', 'focus', 'speed'],
      beneficial: ['focused', 'precise', 'fast', 'intelligent'],
      detrimental: ['clumsy', 'nervous', 'slow'],
    },
    'Team Penning': {
      stats: ['intelligence', 'agility', 'stamina'],
      beneficial: ['intelligent', 'athletic', 'resilient', 'focused'],
      detrimental: ['slow', 'weak', 'nervous'],
    },
    Rodeo: {
      stats: ['boldness', 'agility', 'stamina'],
      beneficial: ['brave', 'athletic', 'resilient', 'powerful'],
      detrimental: ['fearful', 'weak', 'nervous'],
    },
    Hunter: {
      stats: ['balance', 'precision', 'intelligence'],
      beneficial: ['balanced', 'precise', 'intelligent', 'calm'],
      detrimental: ['clumsy', 'nervous', 'aggressive'],
    },
    Saddleseat: {
      stats: ['flexibility', 'balance', 'obedience'],
      beneficial: ['flexible', 'balanced', 'people_trusting', 'focused'],
      detrimental: ['stiff', 'clumsy', 'stubborn'],
    },
    Endurance: {
      stats: ['stamina', 'intelligence', 'speed'],
      beneficial: ['resilient', 'intelligent', 'fast', 'focused'],
      detrimental: ['weak', 'slow', 'lazy'],
    },
    Eventing: {
      stats: ['stamina', 'boldness', 'agility'],
      beneficial: ['brave', 'athletic', 'resilient', 'focused'],
      detrimental: ['fearful', 'weak', 'nervous'],
    },
    Dressage: {
      stats: ['precision', 'focus', 'obedience'],
      beneficial: ['focused', 'intelligent', 'calm', 'people_trusting'],
      detrimental: ['nervous', 'aggressive', 'stubborn'],
    },
    'Show Jumping': {
      stats: ['balance', 'agility', 'boldness'],
      beneficial: ['brave', 'athletic', 'focused', 'powerful'],
      detrimental: ['nervous', 'clumsy', 'fearful'],
    },
    Vaulting: {
      stats: ['flexibility', 'balance', 'obedience'],
      beneficial: ['flexible', 'balanced', 'calm', 'people_trusting'],
      detrimental: ['stiff', 'nervous', 'aggressive'],
    },
    Polo: {
      stats: ['speed', 'boldness', 'agility'],
      beneficial: ['fast', 'brave', 'athletic', 'focused'],
      detrimental: ['slow', 'fearful', 'clumsy'],
    },
    'Cross Country': {
      stats: ['stamina', 'boldness', 'intelligence'],
      beneficial: ['brave', 'athletic', 'resilient', 'intelligent'],
      detrimental: ['nervous', 'weak', 'fearful'],
    },
    'Combined Driving': {
      stats: ['obedience', 'stamina', 'focus'],
      beneficial: ['people_trusting', 'resilient', 'focused', 'intelligent'],
      detrimental: ['stubborn', 'nervous', 'weak'],
    },
    'Fine Harness': {
      stats: ['flexibility', 'precision', 'balance'],
      beneficial: ['flexible', 'precise', 'balanced', 'focused'],
      detrimental: ['stiff', 'clumsy', 'nervous'],
    },
    Gaited: {
      stats: ['flexibility', 'balance', 'obedience'],
      beneficial: ['flexible', 'balanced', 'gaited', 'calm'],
      detrimental: ['stiff', 'clumsy', 'nervous'],
      requiresTrait: 'gaited',
    },
    Gymkhana: {
      stats: ['speed', 'flexibility', 'focus'],
      beneficial: ['fast', 'flexible', 'focused', 'athletic'],
      detrimental: ['slow', 'stiff', 'nervous'],
    },
    Steeplechase: {
      stats: ['stamina', 'boldness', 'balance'],
      beneficial: ['resilient', 'brave', 'balanced', 'athletic'],
      detrimental: ['weak', 'fearful', 'clumsy'],
    },
    Racing: {
      stats: ['speed', 'stamina', 'focus'],
      beneficial: ['fast', 'athletic', 'focused', 'brave', 'resilient'],
      detrimental: ['slow', 'lazy', 'nervous'],
    },
    'Harness Racing': {
      stats: ['speed', 'precision', 'stamina'],
      beneficial: ['fast', 'precise', 'resilient', 'focused'],
      detrimental: ['slow', 'clumsy', 'weak'],
    },
    'Obedience Training': {
      stats: ['obedience', 'precision', 'intelligence'],
      beneficial: ['people_trusting', 'intelligent', 'focused', 'calm'],
      detrimental: ['stubborn', 'aggressive', 'nervous'],
    },
  };
}

/**
 * Calculate horse level based on stats, traits, and training
 * @param {Object} horse - Horse object with stats and traits
 * @param {string} discipline - Competition discipline
 * @returns {number} Horse level for the discipline
 */
export function calculateHorseLevel(horse, discipline) {
  try {
    // Get discipline configuration (need to redeclare since it's in function scope above)
    const disciplineConfig = getDisciplineConfigurations();
    const disciplineMap = disciplineConfig[discipline] || disciplineConfig['Racing'];
    const { stats } = disciplineMap;

    // Calculate base stat score (weighted average of 3 discipline stats)
    let baseStatScore = 0;
    stats.forEach(stat => {
      baseStatScore += horse[stat] || 0;
    });
    baseStatScore = baseStatScore / 3; // Average of the 3 stats

    // Legacy trait bonus (from epigenetic modifiers)
    let legacyTraitBonus = 0;
    const traits = horse.epigeneticModifiers || horse.traits || {};
    const positiveTraits = traits.positive || [];
    const negativeTraits = traits.negative || [];

    positiveTraits.forEach(trait => {
      if (disciplineMap.beneficial.includes(trait)) {
        legacyTraitBonus += 5; // +5 points per beneficial trait
      } else {
        legacyTraitBonus += 2; // +2 points for other positive traits
      }
    });

    negativeTraits.forEach(trait => {
      if (disciplineMap.detrimental.includes(trait)) {
        legacyTraitBonus -= 8; // -8 points per detrimental trait
      } else {
        legacyTraitBonus -= 3; // -3 points for other negative traits
      }
    });

    // Discipline affinity bonus (same as legacy trait bonus for now)
    const disciplineAffinityBonus = legacyTraitBonus;

    // Training score for this specific discipline
    const trainingScore = horse.disciplineScores?.[discipline] || 0;

    // Calculate total score
    const totalScore = baseStatScore + legacyTraitBonus + disciplineAffinityBonus + trainingScore;

    // Calculate level based on score
    // Every 50 points up to 500, then every 100 points through 1000
    let level = 1;
    if (totalScore <= 500) {
      level = Math.floor(totalScore / 50) + 1;
    } else if (totalScore <= 1000) {
      level = 11 + Math.floor((totalScore - 500) / 100); // Level 11+ for scores 501-1000
    } else {
      level = 16 + Math.floor((totalScore - 1000) / 100); // Continue pattern beyond 1000
    }

    return Math.max(1, level);
  } catch (error) {
    logger.error('[competitionLogic.calculateHorseLevel] Error:', error.message);
    return 1;
  }
}

/**
 * Check if horse meets age requirements (3-21 years old)
 * @param {Object} horse - Horse object
 * @returns {boolean} Whether horse meets age requirements
 */
export function checkAgeRequirements(horse) {
  try {
    const age = horse.age || 0;
    return age >= 3 && age <= 21;
  } catch (error) {
    logger.error('[competitionLogic.checkAgeRequirements] Error:', error.message);
    return false;
  }
}

/**
 * Check if horse has required trait for discipline (e.g., Gaited)
 * @param {Object} horse - Horse object
 * @param {string} discipline - Competition discipline
 * @returns {boolean} Whether horse has required trait
 */
export function checkTraitRequirements(horse, discipline) {
  try {
    const disciplineConfig = getDisciplineConfigurations();
    const disciplineMap = disciplineConfig[discipline] || disciplineConfig['Racing'];

    if (!disciplineMap.requiresTrait) {
      return true; // No special trait required
    }

    const traits = horse.epigeneticModifiers || horse.traits || {};
    const positiveTraits = traits.positive || [];

    return positiveTraits.includes(disciplineMap.requiresTrait);
  } catch (error) {
    logger.error('[competitionLogic.checkTraitRequirements] Error:', error.message);
    return false;
  }
}

/**
 * Calculate random stat gain for competition winners
 * @param {number} placement - Competition placement (1st, 2nd, 3rd)
 * @param {string} discipline - Competition discipline
 * @returns {Object|null} Stat gain object or null if no gain
 */
export function calculateStatGain(placement, discipline) {
  try {
    // Stat gain chances
    const statGainChances = {
      1: 0.1, // 10% for 1st place
      2: 0.05, // 5% for 2nd place
      3: 0.03, // 3% for 3rd place
    };

    const chance = statGainChances[placement];
    if (!chance || Math.random() > chance) {
      return null; // No stat gain
    }

    // Get discipline stats
    const disciplineConfig = getDisciplineConfigurations();
    const disciplineMap = disciplineConfig[discipline] || disciplineConfig['Racing'];
    const availableStats = disciplineMap.stats;

    // Randomly select one of the 3 discipline stats
    const randomStat = availableStats[Math.floor(Math.random() * availableStats.length)];

    return {
      stat: randomStat,
      amount: 1, // +1 stat increase
    };
  } catch (error) {
    logger.error('[competitionLogic.calculateStatGain] Error:', error.message);
    return null;
  }
}

/**
 * Get all available disciplines
 * @returns {Array} Array of discipline names
 */
export function getAllDisciplines() {
  const disciplineConfig = getDisciplineConfigurations();
  return Object.keys(disciplineConfig);
}

/**
 * Get discipline configuration
 * @param {string} discipline - Discipline name
 * @returns {Object} Discipline configuration
 */
export function getDisciplineConfig(discipline) {
  const disciplineConfig = getDisciplineConfigurations();
  return disciplineConfig[discipline] || disciplineConfig['Racing'];
}

export default {
  calculateCompetitionScore,
  calculatePrizeAmount,
  calculateCompetitionXP,
  calculatePlacements,
  calculateHorseLevel,
  checkAgeRequirements,
  checkTraitRequirements,
  calculateStatGain,
  getAllDisciplines,
  getDisciplineConfig,
};
