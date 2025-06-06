/**
 * Get health modifier percentage as decimal for competition scoring
 * @param {string} healthRating - The horse's health rating
 * @returns {number} - Modifier as decimal (e.g., 0.05 for +5%, -0.03 for -3%)
 */
function getHealthModifier(healthRating) {
  const healthModifiers = {
    Excellent: 0.05, // +5%
    'Very Good': 0.03, // +3%
    Good: 0.0, // 0% (baseline)
    Fair: -0.03, // -3%
    Bad: -0.05, // -5%
  };

  // Return the modifier or 0 if health rating is not recognized
  return healthModifiers[healthRating] || 0;
}

export { getHealthModifier };
