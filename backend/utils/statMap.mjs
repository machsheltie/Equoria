/**
 * Stat mapping for all competition disciplines
 * Each discipline has three stats in order of importance:
 * - Primary stat (50% weight)
 * - Secondary stat (30% weight)
 * - Tertiary stat (20% weight)
 *
 * Available stat categories:
 * speed, stamina, agility, balance, precision, intelligence,
 * boldness, flexibility, obedience, focus
 */
const statMap = {
  'Western Pleasure': ['focus', 'obedience', 'intelligence'],
  Reining: ['agility', 'precision', 'focus'],
  Cutting: ['intelligence', 'agility', 'boldness'],
  'Barrel Racing': ['speed', 'agility', 'obedience'],
  Roping: ['precision', 'focus', 'speed'],
  'Team Penning': ['intelligence', 'agility', 'stamina'],
  Rodeo: ['boldness', 'agility', 'stamina'],
  Hunter: ['balance', 'precision', 'intelligence'],
  Saddleseat: ['flexibility', 'balance', 'obedience'],
  Endurance: ['stamina', 'intelligence', 'speed'],
  Eventing: ['stamina', 'boldness', 'agility'],
  Dressage: ['precision', 'focus', 'obedience'],
  'Show Jumping': ['balance', 'agility', 'boldness'],
  Vaulting: ['flexibility', 'balance', 'obedience'],
  Polo: ['speed', 'boldness', 'agility'],
  'Cross Country': ['stamina', 'boldness', 'intelligence'],
  'Combined Driving': ['obedience', 'stamina', 'focus'],
  'Fine Harness': ['flexibility', 'precision', 'balance'],
  Gaited: ['flexibility', 'balance', 'obedience'],
  Gymkhana: ['speed', 'flexibility', 'focus'],
  Steeplechase: ['stamina', 'boldness', 'balance'],
  Racing: ['speed', 'stamina', 'focus'],
  'Harness Racing': ['speed', 'precision', 'stamina'],
};

/**
 * Get the stat configuration for a specific discipline
 * @param {string} discipline - The discipline name
 * @returns {Array|null} - Array of [primary, secondary, tertiary] stats or null if discipline not found
 */
function getStatsForDiscipline(discipline) {
  return statMap[discipline] || null;
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
  return discipline in statMap;
}

export {
  statMap,
  getStatsForDiscipline,
  getAllDisciplines,
  getAllStatCategories,
  isDisciplineValid,
};
