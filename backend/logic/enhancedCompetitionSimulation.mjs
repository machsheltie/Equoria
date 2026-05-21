/**
 * Enhanced Competition Simulation with New Requirements
 * - 24 disciplines with 3 weighted stats each
 * - Horse-based level system (not user-based)
 * - Age restrictions (3-21 years old)
 * - Gaited trait requirement for Gaited competitions
 * - Stat gains for top 3 placements (10%/5%/3% chance)
 * - No earnings for 4th place
 * - Hidden scores from users
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import { createNotification } from '../utils/notificationService.mjs';
import { saveResult } from '../models/resultModel.mjs';
import { calculateCompetitionScore } from '../utils/competitionScore.mjs';
import { awardCompetitionXp } from '../models/horseXpModel.mjs';
import {
  calculatePrizeAmount,
  calculateCompetitionXP,
  calculatePlacements,
  calculateHorseLevel,
  checkAgeRequirements,
  checkTraitRequirements,
  calculateStatGain,
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
 * Execute enhanced competition with all new features
 * @param {Object} show - Show object
 * @param {Array} entries - Array of {horse, user} objects
 * @returns {Object} Competition results
 */
export async function executeEnhancedCompetition(show, entries) {
  try {
    logger.info(
      `[enhancedCompetitionSimulation] Executing competition: ${show.name} (${show.discipline})`,
    );

    // Idempotency guard (Equoria-mzy1, mirrors Equoria-08ln on conformation).
    // The caller filters entries by `placement: null` so a sequential second
    // /execute call finds zero entries and returns 400 — but two concurrent
    // calls can both pass that filter before either persists results, paying
    // prizes / awarding XP twice. Pre-transaction status read = fast-path
    // reject; atomic updateMany-with-predicate flip = race-condition guard.
    if (show.status === 'completed' || show.status === 'executing') {
      logger.warn(
        `[enhancedCompetitionSimulation] Refusing to execute show ${show.id} — already executed (status=${show.status})`,
      );
      return {
        success: false,
        showId: show.id,
        error: 'Show already executed',
      };
    }

    // Atomic claim: succeeds only when the row is still open. A concurrent
    // executor that already flipped status sees count=0 here and we abort
    // before scoring / persisting anything.
    const claim = await prisma.show.updateMany({
      where: { id: show.id, status: 'open' },
      data: { status: 'executing' },
    });
    if (claim.count === 0) {
      logger.warn(
        `[enhancedCompetitionSimulation] Atomic claim failed for show ${show.id} — concurrent executor won the race`,
      );
      return {
        success: false,
        showId: show.id,
        error: 'Show already executed',
      };
    }

    // Calculate scores for all entries
    const competitionEntries = entries.map(({ horse, user }) => {
      // Equoria-qszs: pass show.showType so conformation shows correctly use the
      // conformation temperament modifier instead of silently defaulting to ridden.
      const rawScore = calculateCompetitionScore(horse, show.discipline, show.showType);
      // Ensure score is a valid decimal value (Prisma requires Decimal type)
      const score = rawScore !== null && !isNaN(rawScore) ? Number(rawScore) : 0;

      logger.info(
        `[enhancedCompetitionSimulation] Horse ${horse.name} (ID: ${horse.id}) scored ${score} in ${show.discipline}`,
      );

      return {
        horse,
        user,
        score,
        horseId: horse.id,
        userId: user.id,
      };
    });

    // Calculate placements
    const placedEntries = calculatePlacements(competitionEntries);

    // Process results and rewards
    const results = [];
    const statGainResults = [];

    for (const entry of placedEntries) {
      const { horse, user, score, placement } = entry;

      // Calculate prize (4th place gets nothing)
      const prizeWon = calculatePrizeAmount(show.prize, placement, entries.length);

      // Calculate XP
      const xpGained = calculateCompetitionXP(score, placement, entries.length);

      // Calculate potential stat gain for top 3
      let statGain = null;
      if (placement <= 3) {
        statGain = calculateStatGain(placement, show.discipline);
      }

      // Convert placement number to ordinal string
      const placementString =
        placement === 1
          ? '1st'
          : placement === 2
            ? '2nd'
            : placement === 3
              ? '3rd'
              : `${placement}th`;

      // Save competition result (updates placeholder if exists, creates new if not)
      await saveResult({
        horseId: horse.id,
        showId: show.id,
        score,
        placement: placementString,
        discipline: show.discipline,
        runDate: show.runDate,
        showName: show.name,
        prizeWon,
        statGains: statGain
          ? {
              stat: statGain.stat,
              amount: statGain.amount,
              awarded: true,
            }
          : null,
      });

      // Update user money and XP
      await prisma.user.update({
        where: { id: user.id },
        data: {
          money: { increment: prizeWon },
          xp: { increment: xpGained },
        },
      });

      // Equoria-9o63c: fire a placement notification on ANY top-3 finish,
      // regardless of whether a stat was gained that run. This is the sibling
      // fix to Equoria-pi4nk in competitionController.mjs — that path fired
      // its only competition notification inside `if (statGains)`, so a
      // top-3 horse that gained no stat (the common case — stat gain is a
      // 3-10% RNG roll) received ZERO notifications. The same gap existed
      // here. competition_placement is a DISTINCT type from
      // competition_stat_gain: placement and stat-gain are different game
      // events. A horse that both places AND gains a stat receives two
      // notifications; a horse that places without a stat gain now receives
      // the placement notification it previously never got. Payload mirrors
      // pi4nk's shape ({ horseName, placement, discipline, showName,
      // prizeWon }). Only the top three valid scorers are assigned a
      // placement <= 3, so this guard is the top-3 condition.
      if (placement <= 3) {
        await createNotification(user.id, 'competition_placement', {
          horseName: horse.name,
          placement: placementString,
          discipline: show.discipline,
          showName: show.name,
          prizeWon,
        });
      }

      // Apply stat gain to horse if awarded
      if (statGain) {
        const updateData = {};
        updateData[statGain.stat] = { increment: statGain.amount };

        await prisma.horse.update({
          where: { id: horse.id },
          data: updateData,
        });

        statGainResults.push({
          horseId: horse.id,
          horseName: horse.name,
          stat: statGain.stat,
          amount: statGain.amount,
          placement,
        });

        await createNotification(user.id, 'competition_stat_gain', {
          horseName: horse.name,
          stat: statGain.stat,
          amount: statGain.amount,
          placement: placementString,
          discipline: show.discipline,
        });
      }

      // Create XP event
      await prisma.xpEvent.create({
        data: {
          userId: user.id,
          amount: xpGained,
          reason: `Competition: ${show.name} - Placement: ${placement}`,
          timestamp: new Date(),
        },
      });

      // Award Horse XP for competition participation
      try {
        const horseXpResult = await awardCompetitionXp(horse.id, placementString, show.discipline);

        if (horseXpResult.success) {
          logger.info(
            `[enhancedCompetitionSimulation] Awarded ${horseXpResult.xpAwarded} Horse XP to ${horse.name} for ${placementString} place${horseXpResult.statPointsGained > 0 ? ` - Gained ${horseXpResult.statPointsGained} stat points!` : ''}`,
          );
        } else {
          logger.warn(
            `[enhancedCompetitionSimulation] Failed to award Horse XP to ${horse.name}: ${horseXpResult.error}`,
          );
        }
      } catch (horseXpError) {
        logger.error(
          `[enhancedCompetitionSimulation] Error awarding Horse XP to ${horse.name}: ${horseXpError.message}`,
        );
      }

      results.push({
        horseId: horse.id,
        horseName: horse.name,
        userId: user.id,
        userName: user.username,
        placement,
        // Note: Score is hidden from users in actual API responses
        score, // Only for internal processing
        prizeWon,
        xpGained,
        statGain: statGain
          ? {
              stat: statGain.stat,
              amount: statGain.amount,
            }
          : null,
      });
    }

    // Idempotency final flip (Equoria-mzy1): mark the show as completed so
    // any future /execute calls reject immediately at the pre-transaction
    // status read. Done outside any transaction; the atomic 'open' → 'executing'
    // claim above already serialized us against concurrent runs.
    await prisma.show.update({
      where: { id: show.id },
      data: { status: 'completed', executedAt: new Date() },
    });

    logger.info(
      `[enhancedCompetitionSimulation] Competition completed. ${results.length} entries processed.`,
    );

    return {
      success: true,
      showId: show.id,
      showName: show.name,
      discipline: show.discipline,
      totalEntries: entries.length,
      results: results.map(result => ({
        // Return user-facing results (no scores)
        horseId: result.horseId,
        horseName: result.horseName,
        userId: result.userId,
        userName: result.userName,
        placement: result.placement,
        prizeWon: result.prizeWon,
        xpGained: result.xpGained,
        statGain: result.statGain,
      })),
      statGains: statGainResults,
      totalPrizeDistributed: results.reduce((sum, r) => sum + r.prizeWon, 0),
      totalXPAwarded: results.reduce((sum, r) => sum + r.xpGained, 0),
    };
  } catch (error) {
    logger.error('[enhancedCompetitionSimulation.executeEnhancedCompetition] Error:', error);
    // Reset status back to open if we claimed it but then failed — otherwise
    // the show is permanently locked at 'executing'. Use updateMany-with-predicate
    // so we only reset rows we ourselves claimed (status=executing).
    try {
      await prisma.show.updateMany({
        where: { id: show.id, status: 'executing' },
        data: { status: 'open' },
      });
    } catch (rollbackErr) {
      logger.error(
        `[enhancedCompetitionSimulation] Failed to roll back status for show ${show.id}: ${rollbackErr.message}`,
      );
    }
    return {
      success: false,
      error: error?.message || error?.toString() || 'Unknown error occurred',
      showId: show.id,
      results: [],
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
  executeEnhancedCompetition,
  getCompetitionEligibilitySummary,
  getAllDisciplines,
  getDisciplineConfig,
};
