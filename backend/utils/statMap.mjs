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
  'Western Pleasure': ['obedience', 'focus', 'precision'],
  Reining: ['precision', 'agility', 'focus'],
  Cutting: ['agility', 'strength', 'intelligence'],
  'Barrel Racing': ['speed', 'agility', 'stamina'],
  Roping: ['strength', 'precision', 'focus'],
  'Team Penning': ['intelligence', 'agility', 'obedience'],
  Rodeo: ['strength', 'agility', 'boldness'],
  Hunter: ['precision', 'endurance', 'agility'],
  Saddleseat: ['flexibility', 'obedience', 'precision'],
  Endurance: ['endurance', 'speed', 'focus'],
  Eventing: ['endurance', 'precision', 'agility'],
  Dressage: ['precision', 'obedience', 'focus'],
  'Show Jumping': ['agility', 'precision', 'intelligence'],
  Vaulting: ['flexibility', 'strength', 'balance'],
  Polo: ['speed', 'agility', 'intelligence'],
  'Cross Country': ['endurance', 'intelligence', 'agility'],
  'Combined Driving': ['obedience', 'endurance', 'focus'],
  'Fine Harness': ['precision', 'flexibility', 'obedience'],
  Gaited: ['flexibility', 'obedience', 'focus'],
  Gymkhana: ['speed', 'flexibility', 'stamina'],
  Steeplechase: ['speed', 'endurance', 'agility'],
  Racing: ['speed', 'stamina', 'intelligence'],
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
