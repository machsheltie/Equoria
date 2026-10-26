import logger from './logger.mjs';
import { getDisciplineStats } from '../modules/competition/index.mjs';

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
 * The three stats a discipline's post-show gain may raise: the discipline's
 * bible stats (owner ruling R8; Equoria-576c0 B3), picked with equal odds.
 * @param {string} discipline - Competition discipline
 * @returns {readonly string[]}
 * @throws {Error} For an unknown discipline (no Racing fallback).
 */
function getRelevantStats(discipline) {
  return getDisciplineStats(discipline);
}

/**
 * Calculate stat gains for competition winners
 * @param {string} placement - "1st", "2nd", or "3rd"
 * @param {string} discipline - Competition discipline
 * @param {Function} _rngFn - RNG function (default Math.random); injectable for deterministic tests
 * @returns {Object|null} - Stat gain object or null if no gain
 */
function calculateStatGains(placement, discipline, _rngFn = Math.random) {
  const chances = {
    '1st': 0.1, // 10% chance
    '2nd': 0.05, // 5% chance
    '3rd': 0.03, // 3% chance
  };

  const chance = chances[placement];
  if (!chance || _rngFn() > chance) {
    return null; // No stat gain
  }

  // Select random stat from relevant discipline stats
  const relevantStats = getRelevantStats(discipline);
  const randomStat = relevantStats[Math.floor(_rngFn() * relevantStats.length)];

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

export { calculatePrizeDistribution, getRelevantStats, calculateStatGains, calculateEntryFees };
