/**
 * Enhanced Competition Simulation — live helpers only (Equoria-toqet, 2026-05-29).
 *
 * History: this file used to host `executeEnhancedCompetition`, the on-demand
 * competition executor called by POST /api/competition/execute and
 * POST /api/competition/enter-show. Equoria-kacla removed both routes (410 Gone)
 * and made the nightly cron's `showController.executeClosedShows` the sole
 * canonical executor. `executeEnhancedCompetition` survived only as a test
 * target and embedded an implicit-mint money-credit pattern (creator wallet
 * incremented with no SystemAccount debit) that violated the si69u escrow
 * invariant — a latent foot-gun if anyone resurrected its call path.
 *
 * Equoria-toqet deleted the dead function + its dedicated test files
 * (enhancedCompetitionSimulation.test.mjs, enhancedCompetitionPlacementNotification.sentinel.test.mjs).
 * Re-anchoring the deleted placement-notification sentinel onto the live
 * executeClosedShows path is tracked separately as Equoria-dfet1.
 *
 * What remains in this file (both still actively imported):
 *   - validateCompetitionEntry — pure eligibility validator, used by tests +
 *     potential future call sites.
 *   - getCompetitionEligibilitySummary — imported by competitionRoutes.mjs
 *     (GET /api/competition/eligibility/:horseId/:discipline).
 */

import logger from '../utils/logger.mjs';
import {
  calculateHorseLevel,
  checkAgeRequirements,
  checkTraitRequirements,
  getAllDisciplines,
  getDisciplineConfig,
} from '../utils/competitionLogic.mjs';

/**
 * Validate horse eligibility for competition entry
 * @param {Object} horse - Horse object
 * @param {Object} show - Show object
 * @param {Object} user - User object
 * @returns {Object} Validation result
 */
export async function validateCompetitionEntry(horse, show, user) {
  try {
    const errors = [];

    // Age requirements (3-21 years old)
    if (!checkAgeRequirements(horse)) {
      if (horse.age < 3) {
        errors.push(`Horse is too young (${horse.age} years old). Minimum age is 3 years.`);
      } else if (horse.age > 21) {
        errors.push(`Horse has retired (${horse.age} years old). Maximum age is 21 years.`);
      }
    }

    // Trait requirements (e.g., Gaited)
    if (!checkTraitRequirements(horse, show.discipline)) {
      const disciplineConfig = getDisciplineConfig(show.discipline);
      if (disciplineConfig.requiresTrait) {
        errors.push(
          `Horse must have the '${disciplineConfig.requiresTrait}' trait to compete in ${show.discipline}.`,
        );
      }
    }

    // Horse level requirements
    const horseLevel = calculateHorseLevel(horse, show.discipline);
    if (horseLevel < show.levelMin || horseLevel > show.levelMax) {
      errors.push(
        `Horse level ${horseLevel} is outside the required range (${show.levelMin}-${show.levelMax}) for this competition.`,
      );
    }

    // Health requirements
    if (horse.healthStatus !== 'Good' && horse.healthStatus !== 'Excellent') {
      errors.push(
        `Horse health status must be Good or Excellent. Current status: ${horse.healthStatus}`,
      );
    }

    // Financial requirements
    if (user.money < show.entryFee) {
      errors.push(`Insufficient funds. Entry fee: $${show.entryFee}, Available: $${user.money}`);
    }

    // Discipline score requirements (if any)
    const disciplineScore = horse.disciplineScores?.[show.discipline] || 0;
    const minDisciplineScore = 0; // Could be configurable per show
    if (disciplineScore < minDisciplineScore) {
      errors.push(
        `Horse discipline score too low. Required: ${minDisciplineScore}, Current: ${disciplineScore}`,
      );
    }

    return {
      eligible: errors.length === 0,
      errors,
      horseLevel,
      disciplineScore,
    };
  } catch (error) {
    logger.error('[enhancedCompetitionSimulation.validateCompetitionEntry] Error:', error.message);
    return {
      eligible: false,
      errors: ['Validation error occurred'],
      horseLevel: 1,
      disciplineScore: 0,
    };
  }
}

/**
 * Get competition eligibility summary for a horse
 * @param {Object} horse - Horse object
 * @param {string} discipline - Competition discipline
 * @returns {Object} Eligibility summary
 */
export function getCompetitionEligibilitySummary(horse, discipline) {
  try {
    const horseLevel = calculateHorseLevel(horse, discipline);
    const ageEligible = checkAgeRequirements(horse);
    const traitEligible = checkTraitRequirements(horse, discipline);
    const disciplineConfig = getDisciplineConfig(discipline);

    return {
      horseLevel,
      ageEligible,
      traitEligible,
      requiredTrait: disciplineConfig.requiresTrait || null,
      disciplineStats: disciplineConfig.stats,
      currentAge: horse.age,
      healthStatus: horse.healthStatus,
      disciplineScore: horse.disciplineScores?.[discipline] || 0,
    };
  } catch (error) {
    logger.error(
      '[enhancedCompetitionSimulation.getCompetitionEligibilitySummary] Error:',
      error.message,
    );
    return {
      horseLevel: 1,
      ageEligible: false,
      traitEligible: false,
      requiredTrait: null,
      disciplineStats: [],
      currentAge: 0,
      healthStatus: 'Unknown',
      disciplineScore: 0,
    };
  }
}

export default {
  validateCompetitionEntry,
  getCompetitionEligibilitySummary,
  getAllDisciplines,
  getDisciplineConfig,
};
