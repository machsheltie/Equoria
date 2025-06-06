// TODO: Re-enable when stat scoring is needed for reward calculations
// import { getStatScore } from './getStatScore.mjs';
import logger from './logger.mjs';

/**
 * Calculate prize distribution for competition winners
 * @param {number} totalPrize - Total prize pool from the show
 * @returns {Object} - Prize distribution for 1st, 2nd, 3rd place
 */
function calculatePrizeDistribution(totalPrize) {
  return {
    first: Math.round(totalPrize * 0.5), // 50%
    second: Math.round(totalPrize * 0.3), // 30%
    third: Math.round(totalPrize * 0.2), // 20%
  };
}

/**
 * Get the relevant stats for a discipline (used for stat gains)
 * @param {string} discipline - Competition discipline
 * @returns {Array} - Array of stat names relevant to the discipline
 */
function getRelevantStats(discipline) {
  const statMap = {
    Racing: ['speed', 'stamina', 'focus'],
    'Show Jumping': ['balance', 'agility', 'boldness'],
    Dressage: ['precision', 'intelligence', 'obedience'],
    'Cross Country': ['stamina', 'boldness', 'balance'],
    Hunter: ['balance', 'precision', 'obedience'],
    'Barrel Racing': ['speed', 'agility', 'focus'],
    Reining: ['agility', 'intelligence', 'obedience'],
    Cutting: ['agility', 'intelligence', 'focus'],
    Trail: ['intelligence', 'obedience', 'balance'],
    'Western Pleasure': ['obedience', 'precision', 'balance'],
    'English Pleasure': ['precision', 'obedience', 'balance'],
    Driving: ['obedience', 'intelligence', 'stamina'],
  };

  return statMap[discipline] || ['speed', 'stamina', 'focus']; // Default to Racing stats
}

/**
 * Calculate stat gains for competition winners
 * @param {string} placement - "1st", "2nd", or "3rd"
 * @param {string} discipline - Competition discipline
 * @returns {Object|null} - Stat gain object or null if no gain
 */
function calculateStatGains(placement, discipline) {
  const chances = {
    '1st': 0.1, // 10% chance
    '2nd': 0.05, // 5% chance
    '3rd': 0.03, // 3% chance
  };

  const chance = chances[placement];
  if (!chance || Math.random() > chance) {
    return null; // No stat gain
  }

  // Select random stat from relevant discipline stats
  const relevantStats = getRelevantStats(discipline);
  const randomStat = relevantStats[Math.floor(Math.random() * relevantStats.length)];

  logger.info(
    `[competitionRewards.calculateStatGains] ${placement} place winner gained +1 ${randomStat} (${Math.round(chance * 100)}% chance)`,
  );

  return {
    stat: randomStat,
    gain: 1,
  };
}

/**
 * Calculate total entry fees collected from participants
 * @param {number} entryFee - Entry fee per horse
 * @param {number} numEntries - Number of horses entered
 * @returns {number} - Total entry fees collected
 */
function calculateEntryFees(entryFee, numEntries) {
  return entryFee * numEntries;
}

/**
 * Validate that a horse has a rider (required for competition entry)
 * @param {Object} horse - Horse object
 * @returns {boolean} - True if horse has a valid rider
 */
function hasValidRider(horse) {
  return horse.rider !== null && horse.rider !== undefined && typeof horse.rider === 'object';
}

export {
  calculatePrizeDistribution,
  getRelevantStats,
  calculateStatGains,
  calculateEntryFees,
  hasValidRider,
};
