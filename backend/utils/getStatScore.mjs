import { getStatsForDiscipline } from './statMap.mjs';

/**
 * Calculate weighted base stat score for a horse in a specific discipline
 * @param {Object} horse - Horse object with stat properties
 * @param {string} discipline - Competition discipline name
 * @returns {number} - Weighted base stat score (primary 50%, secondary 30%, tertiary 20%)
 */
function getStatScore(horse, discipline) {
  // Validate inputs
  if (!horse) {
    throw new Error('Horse object is required');
  }

  if (!discipline) {
    throw new Error('Discipline is required');
  }

  // Get the stat configuration for this discipline
  const stats = getStatsForDiscipline(discipline);
  if (!stats) {
    throw new Error(`Unknown discipline: ${discipline}`);
  }

  const [primaryStat, secondaryStat, tertiaryStat] = stats;

  // Get stat values from horse, defaulting to 0 if not present
  const primaryValue = horse[primaryStat] || 0;
  const secondaryValue = horse[secondaryStat] || 0;
  const tertiaryValue = horse[tertiaryStat] || 0;

  // Validate stat values are numbers
  if (
    typeof primaryValue !== 'number' ||
    typeof secondaryValue !== 'number' ||
    typeof tertiaryValue !== 'number'
  ) {
    throw new Error('Horse stat values must be numbers');
  }

  // Calculate weighted score: 50% + 30% + 20%
  const baseScore = primaryValue * 0.5 + secondaryValue * 0.3 + tertiaryValue * 0.2;

  return baseScore;
}

export { getStatScore };
