/**
 * Competition Logic Module
 *
 * Handles competition scoring and calculations for horse competitions.
 * Uses minimal mocking approach - real business logic with deterministic results.
 */

import logger from './logger.mjs';
import { maxActiveAgeYears, minActiveAgeYears } from '../constants/horseAgePolicy.mjs';
import { DISCIPLINE_STATS } from '../modules/competition/index.mjs';

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
  const configs = {
    'Western Pleasure': {
      beneficial: ['calm', 'peopleTrusting', 'focused', 'intelligent'],
      detrimental: ['nervous', 'aggressive', 'stubborn'],
    },
    Reining: {
      beneficial: ['athletic', 'focused', 'intelligent', 'agile'],
      detrimental: ['clumsy', 'nervous', 'stubborn'],
    },
    Cutting: {
      beneficial: ['intelligent', 'athletic', 'brave', 'focused'],
      detrimental: ['slow', 'nervous', 'fearful'],
    },
    'Barrel Racing': {
      beneficial: ['fast', 'athletic', 'focused', 'brave'],
      detrimental: ['slow', 'clumsy', 'nervous'],
    },
    Roping: {
      beneficial: ['focused', 'precise', 'fast', 'intelligent'],
      detrimental: ['clumsy', 'nervous', 'slow'],
    },
    'Team Penning': {
      beneficial: ['intelligent', 'athletic', 'resilient', 'focused'],
      detrimental: ['slow', 'weak', 'nervous'],
    },
    Rodeo: {
      beneficial: ['brave', 'athletic', 'resilient', 'powerful'],
      detrimental: ['fearful', 'weak', 'nervous'],
    },
    Hunter: {
      beneficial: ['balanced', 'precise', 'intelligent', 'calm'],
      detrimental: ['clumsy', 'nervous', 'aggressive'],
    },
    Saddleseat: {
      beneficial: ['flexible', 'balanced', 'peopleTrusting', 'focused'],
      detrimental: ['stiff', 'clumsy', 'stubborn'],
    },
    Endurance: {
      beneficial: ['resilient', 'intelligent', 'fast', 'focused'],
      detrimental: ['weak', 'slow', 'lazy'],
    },
    Eventing: {
      beneficial: ['brave', 'athletic', 'resilient', 'focused'],
      detrimental: ['fearful', 'weak', 'nervous'],
    },
    Dressage: {
      beneficial: ['focused', 'intelligent', 'calm', 'peopleTrusting'],
      detrimental: ['nervous', 'aggressive', 'stubborn'],
    },
    'Show Jumping': {
      beneficial: ['brave', 'athletic', 'focused', 'powerful'],
      detrimental: ['nervous', 'clumsy', 'fearful'],
    },
    Vaulting: {
      beneficial: ['flexible', 'balanced', 'calm', 'peopleTrusting'],
      detrimental: ['stiff', 'nervous', 'aggressive'],
    },
    Polo: {
      beneficial: ['fast', 'brave', 'athletic', 'focused'],
      detrimental: ['slow', 'fearful', 'clumsy'],
    },
    'Cross Country': {
      beneficial: ['brave', 'athletic', 'resilient', 'intelligent'],
      detrimental: ['nervous', 'weak', 'fearful'],
    },
    'Combined Driving': {
      beneficial: ['peopleTrusting', 'resilient', 'focused', 'intelligent'],
      detrimental: ['stubborn', 'nervous', 'weak'],
    },
    'Fine Harness': {
      beneficial: ['flexible', 'precise', 'balanced', 'focused'],
      detrimental: ['stiff', 'clumsy', 'nervous'],
    },
    Gaited: {
      beneficial: ['flexible', 'balanced', 'gaited', 'calm'],
      detrimental: ['stiff', 'clumsy', 'nervous'],
      requiresTrait: 'gaited',
    },
    Gymkhana: {
      beneficial: ['fast', 'flexible', 'focused', 'athletic'],
      detrimental: ['slow', 'stiff', 'nervous'],
    },
    Steeplechase: {
      beneficial: ['resilient', 'brave', 'balanced', 'athletic'],
      detrimental: ['weak', 'fearful', 'clumsy'],
    },
    Racing: {
      beneficial: ['fast', 'athletic', 'focused', 'brave', 'resilient'],
      detrimental: ['slow', 'lazy', 'nervous'],
    },
    'Harness Racing': {
      beneficial: ['fast', 'precise', 'resilient', 'focused'],
      detrimental: ['slow', 'clumsy', 'weak'],
    },
    'Pleasure Driving': {
      beneficial: ['calm', 'peopleTrusting', 'balanced', 'focused'],
      detrimental: ['nervous', 'stubborn', 'aggressive'],
    },
    'Obedience Training': {
      stats: ['obedience', 'precision', 'intelligence'],
      beneficial: ['peopleTrusting', 'intelligent', 'focused', 'calm'],
      detrimental: ['stubborn', 'aggressive', 'nervous'],
    },
  };
  // Competition stats come from the one bible table (owner ruling R8; Racing's
  // tertiary is Focus per ruling C6). 'Obedience Training' is a training
  // discipline: it keeps its own stats and is not a competition discipline.
  for (const [discipline, stats] of Object.entries(DISCIPLINE_STATS)) {
    configs[discipline].stats = [...stats];
  }
  return configs;
}

/**
 * The configuration of a known discipline. A name outside the table is an
 * error, never the Racing configuration (Equoria-576c0 B3).
 * @param {string} discipline
 * @returns {Object}
 */
function configFor(discipline) {
  const config = getDisciplineConfigurations()[discipline];
  if (!config) {
    throw new Error(`Unknown discipline: ${discipline}`);
  }
  return config;
}

/**
 * Calculate horse level based on stats, traits, and training
 * @param {Object} horse - Horse object with stats and traits
 * @param {string} discipline - Competition discipline
 * @returns {number} Horse level for the discipline
 */
export function calculateHorseLevel(horse, discipline) {
  try {
    const disciplineMap = configFor(discipline);
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
 * Check if horse meets age requirements: the active window in
 * constants/horseAgePolicy.mjs (3-20 inclusive; 21 is retirement, Equoria-2nacc)
 *
 * Equoria-8y0v: Horse.age stores GAME-YEARS (per Equoria-son6). Compare directly;
 * do NOT divide by 7 — that produced a double-divide because the cron already
 * converts days→years before persisting.
 *
 * @param {Object} horse - Horse object (horse.age is in game-years)
 * @returns {boolean} Whether horse meets age requirements
 */
export function checkAgeRequirements(horse) {
  try {
    const ageInYears = horse.age || 0;
    return ageInYears >= minActiveAgeYears && ageInYears <= maxActiveAgeYears;
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
    const disciplineMap = configFor(discipline);

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
    const disciplineMap = configFor(discipline);
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
  return configFor(discipline);
}

export default {
  calculatePrizeAmount,
  calculatePlacements,
  calculateHorseLevel,
  checkAgeRequirements,
  checkTraitRequirements,
  calculateStatGain,
  getAllDisciplines,
  getDisciplineConfig,
};
