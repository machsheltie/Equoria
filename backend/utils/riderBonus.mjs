/**
 * Apply rider modifiers (bonus and penalty) to a competition score
 * @param {number} score - The base score before rider modifiers
 * @param {number} bonusPercent - Rider bonus as decimal (0-0.10 for 0-10%)
 * @param {number} penaltyPercent - Rider penalty as decimal (0-0.08 for 0-8%)
 * @returns {number} - Modified score with rider effects applied
 */
function applyRiderModifiers(score, bonusPercent = 0, penaltyPercent = 0) {
  // Validate inputs
  if (typeof score !== 'number' || score < 0) {
    throw new Error('Score must be a non-negative number');
  }

  if (typeof bonusPercent !== 'number' || bonusPercent < 0 || bonusPercent > 0.1) {
    throw new Error('Bonus percent must be between 0 and 0.10 (10%)');
  }

  if (typeof penaltyPercent !== 'number' || penaltyPercent < 0 || penaltyPercent > 0.08) {
    throw new Error('Penalty percent must be between 0 and 0.08 (8%)');
  }

  // Apply modifiers: score * (1 + bonus - penalty)
  return score * (1 + bonusPercent - penaltyPercent);
}

export { applyRiderModifiers };
