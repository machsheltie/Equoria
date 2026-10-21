/**
 * Stat mapping for all competition disciplines
 * Each discipline has three stats in order of importance:
 * - Primary stat (50% weight)
 * - Secondary stat (30% weight)
 * - Tertiary stat (20% weight)
 *
 * The table itself lives in one place, the competition module's
 * rules/disciplineRules.mjs (the bible's 24 disciplines, owner ruling R8; Racing
 * tertiary Focus, ruling C6). This file keeps its null-on-unknown helpers for
 * getStatScore, traitEffects and training (Equoria-576c0 B3 review).
 */
import { DISCIPLINE_STATS, isKnownDiscipline } from '../modules/competition/index.mjs';

const statMap = DISCIPLINE_STATS;

/**
 * Get the stat configuration for a specific discipline
 * @param {string} discipline - The discipline name
 * @returns {Array|null} - Array of [primary, secondary, tertiary] stats or null if discipline not found
 */
function getStatsForDiscipline(discipline) {
  return isKnownDiscipline(discipline) ? statMap[discipline] : null;
}

/**
 * Get all available disciplines
 * @returns {Array} - Array of all discipline names
 */
function getAllDisciplines() {
  return Object.keys(statMap);
}

/**
 * Get all unique stat categories used across all disciplines
 * @returns {Array} - Array of unique stat names
 */
function getAllStatCategories() {
  const allStats = Object.values(statMap).flat();
  return [...new Set(allStats)].sort();
}

/**
 * Check if a discipline exists in the stat map
 * @param {string} discipline - The discipline name to check
 * @returns {boolean} - True if discipline exists, false otherwise
 */
function isDisciplineValid(discipline) {
  return isKnownDiscipline(discipline);
}

export {
  statMap,
  getStatsForDiscipline,
  getAllDisciplines,
  getAllStatCategories,
  isDisciplineValid,
};
