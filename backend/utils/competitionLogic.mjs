/**
 * Competition Logic Module
 *
 * Handles competition scoring and calculations for horse competitions.
 * Uses minimal mocking approach - real business logic with deterministic results.
 */

import logger from './logger.mjs';
import { isRosterTrait } from './epigeneticTraits.mjs';
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
      beneficial: ['peopleTrusting', 'focused'],
      detrimental: [],
    },
    Reining: {
      beneficial: ['focused'],
      detrimental: [],
    },
    Cutting: {
      beneficial: ['brave', 'focused'],
      detrimental: ['fearful'],
    },
    'Barrel Racing': {
      beneficial: ['focused', 'brave'],
      detrimental: [],
    },
    Roping: {
      beneficial: ['focused'],
      detrimental: [],
    },
    'Team Penning': {
      beneficial: ['resilient', 'focused'],
      detrimental: [],
    },
    Rodeo: {
      beneficial: ['brave', 'resilient'],
      detrimental: ['fearful'],
    },
    Hunter: {
      beneficial: [],
      detrimental: [],
    },
    Saddleseat: {
      beneficial: ['peopleTrusting', 'focused'],
      detrimental: [],
    },
    Endurance: {
      beneficial: ['resilient', 'focused'],
      detrimental: [],
    },
    Eventing: {
      beneficial: ['brave', 'resilient', 'focused'],
      detrimental: ['fearful'],
    },
    Dressage: {
      beneficial: ['focused', 'peopleTrusting'],
      detrimental: [],
    },
    'Show Jumping': {
      beneficial: ['brave', 'focused'],
      detrimental: ['fearful'],
    },
    Vaulting: {
      beneficial: ['peopleTrusting'],
      detrimental: [],
    },
    Polo: {
      beneficial: ['brave', 'focused'],
      detrimental: ['fearful'],
    },
    'Cross Country': {
      beneficial: ['brave', 'resilient'],
      detrimental: ['fearful'],
    },
    'Combined Driving': {
      beneficial: ['peopleTrusting', 'resilient', 'focused'],
      detrimental: [],
    },
    'Fine Harness': {
      beneficial: ['focused'],
      detrimental: [],
    },
    Gaited: {
      beneficial: [],
      detrimental: [],
      requiresTrait: 'gaited',
    },
    Gymkhana: {
      beneficial: ['focused'],
      detrimental: [],
    },
    Steeplechase: {
      beneficial: ['resilient', 'brave'],
      detrimental: ['fearful'],
    },
    Racing: {
      beneficial: ['focused', 'brave', 'resilient'],
      detrimental: [],
    },
    'Harness Racing': {
      beneficial: ['resilient', 'focused'],
      detrimental: [],
    },
    'Pleasure Driving': {
      beneficial: ['peopleTrusting', 'focused'],
      detrimental: [],
    },
    'Obedience Training': {
      stats: ['obedience', 'precision', 'intelligence'],
      beneficial: ['peopleTrusting', 'focused'],
      detrimental: [],
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

/** The top horse level (owner ruling 2026-10-23, Equoria-v89t8). */
export const maxHorseLevel = 20;

/**
 * The one level table. Up to a weighted stat score of 500 each level spans 50
 * points (level 1 = 0-49 ... level 10 = 450-499); from 500 each level spans
 * 100 points (level 11 = 500-599 ... level 20 = 1400 and up).
 * @param {number} totalScore
 * @returns {number} Level 1-20
 */
export function levelForScore(totalScore) {
  const score = Number.isFinite(totalScore) && totalScore > 0 ? totalScore : 0;
  const level = score < 500 ? Math.floor(score / 50) + 1 : 11 + Math.floor((score - 500) / 100);
  return Math.min(maxHorseLevel, Math.max(1, level));
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

    // Legacy trait bonus (from epigenetic modifiers). Only roster traits and the
    // discipline trait count: a stored name off the roster has no effect (owner
    // ruling 2026-10-27, q117; Equoria-2d55z).
    let legacyTraitBonus = 0;
    const traits = horse.epigeneticModifiers || horse.traits || {};
    const counts = trait => isRosterTrait(trait) || String(trait).startsWith('disciplineAffinity');
    const positiveTraits = (traits.positive || []).filter(counts);
    const negativeTraits = (traits.negative || []).filter(counts);

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

    return levelForScore(totalScore);
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
