/**
 * Check if a horse is eligible for a specific show
 * @param {Object} horse - Horse object with age and level properties
 * @param {Object} show - Show object with id, levelMin, and levelMax properties
 * @param {Array} previousEntries - Array of show IDs the horse has previously entered (default: [])
 * @returns {boolean} - True if horse is eligible, false otherwise
 */
export function isHorseEligibleForShow(horse, show, previousEntries = []) {
  // Validate input parameters
  if (!horse) {
    throw new Error('Horse object is required');
  }

  if (!show) {
    throw new Error('Show object is required');
  }

  if (!Array.isArray(previousEntries)) {
    throw new Error('previousEntries must be an array');
  }

  // Check age requirements (3-20 inclusive)
  if (typeof horse.age !== 'number' || horse.age < 3 || horse.age > 20) {
    return false;
  }

  // Check level requirements
  if (typeof horse.level !== 'number') {
    return false;
  }

  if (typeof show.levelMin === 'number' && horse.level < show.levelMin) {
    return false;
  }

  if (typeof show.levelMax === 'number' && horse.level > show.levelMax) {
    return false;
  }

  // Check if horse has already entered this show
  if (previousEntries.includes(show.id)) {
    return false;
  }

  // All checks passed - horse is eligible
  return true;
}
