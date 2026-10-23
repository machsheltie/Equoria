/**
 * Enhanced Competition Simulation — live helpers only (Equoria-toqet, 2026-05-29).
 *
 * History: this file used to host `executeEnhancedCompetition`, the on-demand
 * competition executor called by POST /api/competition/execute and
 * POST /api/competition/enter-show. Equoria-kacla removed both routes (410 Gone)
 * and made the nightly cron's `showExecutionService.executeClosedShows` the sole
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
 * What remains in this file:
 *   - getCompetitionEligibilitySummary — imported by competitionRoutes.mjs
 *     (GET /api/competition/eligibility/:horseId/:discipline).
 *
 * validateCompetitionEntry was deleted (owner ruling 2026-10-23, Equoria-0d4wa):
 * nothing called it, and its Good/Excellent health requirement contradicted
 * the one health bar (critical displayed health; utils/competitionEntryRules).
 */

import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { getHorseAgeYears } from '../utils/horseAge.mjs';
import {
  ageRefusal,
  entryRefusalMessage,
  evaluateEntryRules,
  gaitingRefusal,
  loadActiveAssignments,
  loadActiveDisciplineTypes,
  riderRefusal,
} from '../utils/competitionEntryRules.mjs';
import { calculateHorseLevel, getDisciplineConfig } from '../utils/competitionLogic.mjs';

/**
 * Get competition eligibility summary for a horse (GET /competition/eligibility).
 *
 * Equoria-576c0 B9: the verdict comes from the entry transaction's own rules
 * (utils/competitionEntryRules), so this never calls a horse eligible for an
 * entry the server refuses. Old contract: ageEligible was 3-21 from the age
 * column, traitEligible an epigenetic 'gaited' trait, no rider check and no
 * overall verdict. There is no show here, so "already entered" is not judged.
 *
 * @param {Object} horse - Horse row (dateOfBirth, healthStatus, gaitScores, ...)
 * @param {string} discipline - Competition discipline
 * @param {{ userId: string, db?: object, now?: Date }} options - the owner, for C10
 * @returns {Promise<Object>} Eligibility summary
 */
export async function getCompetitionEligibilitySummary(
  horse,
  discipline,
  { userId, db = prisma, now = new Date() } = {},
) {
  try {
    const assignment = (await loadActiveAssignments(db, [horse.id])).get(horse.id);
    const activeTypes = (await loadActiveDisciplineTypes(db, [horse.id])).get(horse.id);
    const code = evaluateEntryRules({
      show: { discipline },
      horse,
      assignment,
      activeTypes,
      userId,
      now,
    });
    const disciplineConfig = getDisciplineConfig(discipline);

    return {
      eligible: code === null,
      refusal: code ? { code, message: entryRefusalMessage(code, { activeTypes }) } : null,
      activeDisciplineTypes: activeTypes,
      horseLevel: calculateHorseLevel(horse, discipline),
      ageEligible: ageRefusal(horse.dateOfBirth, now) === null,
      riderEligible: riderRefusal(assignment, userId) === null,
      traitEligible: gaitingRefusal(discipline, horse.gaitScores) === null,
      requiredTrait: disciplineConfig.requiresTrait || null,
      disciplineStats: disciplineConfig.stats,
      currentAge: getHorseAgeYears(horse.dateOfBirth, now),
      healthStatus: horse.healthStatus,
      disciplineScore: horse.disciplineScores?.[discipline] || 0,
    };
  } catch (error) {
    logger.error(
      '[enhancedCompetitionSimulation.getCompetitionEligibilitySummary] Error:',
      error.message,
    );
    return {
      eligible: false,
      refusal: null,
      activeDisciplineTypes: [],
      horseLevel: 1,
      ageEligible: false,
      riderEligible: false,
      traitEligible: false,
      requiredTrait: null,
      disciplineStats: [],
      currentAge: 0,
      healthStatus: 'Unknown',
      disciplineScore: 0,
    };
  }
}
