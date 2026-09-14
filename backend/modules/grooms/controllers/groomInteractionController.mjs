/**
 * Groom Interaction Handlers
 *
 * Equoria-8kuhf: extracted from groomController.mjs (god-file split to satisfy
 * the 800-line max-lines cap). Behavior, signatures, response shapes, and
 * route wiring are unchanged — groomController.mjs re-exports these so the
 * public import surface is identical.
 *
 * Handlers: recordInteraction, getGroomHorseSynergyPreview.
 */

import {
  calculateGroomInteractionEffects,
  validateFoalInteractionLimits,
} from '../../../utils/groomSystem.mjs';
import {
  validateGroomingEligibility,
  updateTaskLog,
  updateStreakTracking,
  checkTaskMutualExclusivity as _checkTaskMutualExclusivity,
  checkBurnoutImmunity,
} from '../../../utils/groomBondingSystem.mjs';
import { DEVELOPMENTAL_WINDOWS } from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { FOAL_ACTIVITY_SOURCE } from '../../../utils/foalActivityStore.mjs';
import { awardGroomXP, updateGroomSynergy } from '../services/groomProgressionService.mjs';
// Equoria-ypb7d.3: a groom inside the one-week fee grace period stays on staff but
// cannot groom. Pure check over the groom row this handler already fetches.
import { checkGroomMayWork } from '../services/groomEngagementService.mjs';
import { getTemperamentGroomSynergy } from '../../horses/index.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';
import { applyFlagInfluencesToBonding } from '../../../utils/epigeneticFlagInfluence.mjs';
// Equoria-po1fl: the five player-state writes below commit as ONE transaction,
// so a pool-acquire / interactive-timeout P2028 must surface as a retryable 503
// rather than a permanent 500.
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';

/**
 * Determine the current milestone window for a horse based on age
 * @param {Date} dateOfBirth - Horse's date of birth
 * @returns {string|null} Current milestone window ID or null if not in any window
 */
function getCurrentMilestoneWindow(dateOfBirth) {
  const ageInDays = getHorseAgeDays(dateOfBirth);

  // Only track milestone windows for horses under 3 years (1095 days)
  if (ageInDays >= 1095) {
    return null;
  }

  for (const [milestoneType, window] of Object.entries(DEVELOPMENTAL_WINDOWS)) {
    if (ageInDays >= window.start && ageInDays <= window.end) {
      return `${milestoneType}_${Math.floor(ageInDays / 7)}`; // Include week for uniqueness
    }
  }

  return null;
}

/**
 * Determine task type based on interaction type and horse age
 * @param {string} interactionType - Type of groom interaction
 * @param {number} ageInDays - Horse age in days
 * @returns {string} Task type for milestone evaluation
 */
function determineTaskType(interactionType, ageInDays) {
  // Map interaction types to milestone-relevant task types
  const taskTypeMapping = {
    daily_care: ageInDays < 7 ? 'imprinting_care' : 'routine_care',
    feeding: 'feeding',
    grooming: ageInDays < 14 ? 'early_handling' : 'grooming',
    exercise: ageInDays < 21 ? 'play_interaction' : 'exercise',
    medical_check: 'health_monitoring',
  };

  return taskTypeMapping[interactionType] || interactionType;
}

/**
 * POST /api/grooms/interact
 * Record a groom interaction with a foal
 */
export async function recordInteraction(req, res) {
  try {
    const { foalId, groomId, interactionType, duration, notes, assignmentId } = req.body;

    logger.info(
      `[groomController.recordInteraction] Recording ${interactionType} interaction for foal ${foalId}`,
    );

    // Validate required fields
    if (!foalId || !groomId || !interactionType || !duration) {
      return res.status(400).json({
        success: false,
        message: 'foalId, groomId, interactionType, and duration are required',
        data: null,
      });
    }

    // Validate daily interaction limits for all horses
    const validationResult = await validateFoalInteractionLimits(foalId);
    if (!validationResult.canInteract) {
      return res.status(400).json({
        success: false,
        message: validationResult.message,
        data: {
          dailyLimitReached: true,
          lastInteraction: validationResult.lastInteraction,
          interactionsToday: validationResult.interactionsToday,
        },
      });
    }

    // Get groom and foal data
    const [groom, foal] = await Promise.all([
      prisma.groom.findUnique({ where: { id: groomId } }),
      prisma.horse.findUnique({
        where: { id: foalId },
        select: {
          id: true,
          name: true,
          age: true,
          bondScore: true,
          stressLevel: true,
          taskLog: true,
          lastGroomed: true,
          daysGroomedInARow: true,
          // 31D-4 (Equoria-ng1i): temperament drives groom synergy in calculateGroomInteractionEffects
          temperament: true,
          dateOfBirth: true,
          // Equoria-yzqhj.1: behavioral flags bias bonding gain/resistance.
          epigeneticFlags: true,
        },
      }),
    ]);
    if (!groom) {
      return res.status(404).json({
        success: false,
        message: 'Groom not found',
        data: null,
      });
    }
    if (!foal) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    // Equoria-ypb7d.3: "The groom can't groom horse until paid for that week"
    // (owner, 2026-09-09). A groom whose weekly fee went unpaid is still on the
    // player's staff — they keep the assignment, the bond, the history — but they
    // do not work. The check is PURE and reads the groom row already fetched above,
    // so it costs no extra query. It also covers a retired or deactivated groom,
    // which this endpoint previously did not check at all.
    const workCheck = checkGroomMayWork(groom);
    if (!workCheck.allowed) {
      return res.status(400).json({
        success: false,
        message: workCheck.reason,
        data: { groomId: groom.id, groomUnavailable: workCheck.code },
      });
    }

    // Validate task eligibility based on age and task type
    const eligibilityResult = await validateGroomingEligibility(foal, interactionType);
    if (!eligibilityResult.eligible) {
      return res.status(400).json({
        success: false,
        message: eligibilityResult.reason,
        data: {
          eligibleTasks: eligibilityResult.eligibleTasks,
          ageGroup: eligibilityResult.ageGroup,
          horseAge: foal.age,
        },
      });
    }

    // Check for task mutual exclusivity (enrichment vs grooming same day)
    // Get today's date in YYYY-MM-DD format for task log checking
    const [today] = new Date().toISOString().split('T');

    // Check if foal has already completed a task today
    let existingTaskToday = null;
    if (foal.taskLog?.[today]?.length > 0) {
      existingTaskToday = foal.taskLog?.[today]?.[0]; // Get the first task completed today
    }

    // Check for task mutual exclusivity
    const checkTaskMutualExclusivity = _checkTaskMutualExclusivity; // Rename imported function
    const mutualExclusivityResult = checkTaskMutualExclusivity(existingTaskToday, interactionType);
    if (!mutualExclusivityResult.allowed) {
      return res.status(400).json({
        success: false,
        message: mutualExclusivityResult.reason,
        data: {
          conflict: true,
          existingTask: existingTaskToday,
          existingCategory: mutualExclusivityResult.existingCategory,
          newCategory: mutualExclusivityResult.newCategory,
        },
      });
    }

    // Calculate interaction effects
    const effects = calculateGroomInteractionEffects(groom, foal, interactionType, duration);

    // Update task log
    const taskLogUpdate = updateTaskLog(foal.taskLog, interactionType);

    // Update streak tracking
    const currentDate = new Date();
    const streakUpdate = updateStreakTracking(
      foal.lastGroomed ? new Date(foal.lastGroomed) : null,
      currentDate,
      foal.daysGroomedInARow || 0, // Use actual consecutive days from database
    );

    // Determine milestone window and task type for enhanced evaluation
    const milestoneWindowId = getCurrentMilestoneWindow(foal.dateOfBirth);
    const ageInDays = getHorseAgeDays(foal.dateOfBirth);
    const taskType = determineTaskType(interactionType, ageInDays);
    const qualityScore =
      effects.quality === 'excellent'
        ? 1.0
        : effects.quality === 'good'
          ? 0.75
          : effects.quality === 'fair'
            ? 0.5
            : 0.25;

    // Apply epigenetic FLAG influence to the bonding change (Equoria-yzqhj.1).
    // Flags like affectionate (bondingRate+) / aloof (bondingResistance+)
    // earned from 0-3yr foal care now bias how much bond a grooming session
    // produces. This is the single live groom-bonding consumer of the
    // flag-influence module. Pure - computed before the transaction opens.
    const flagBonding = applyFlagInfluencesToBonding(
      effects.bondingChange,
      Array.isArray(foal.epigeneticFlags) ? foal.epigeneticFlags : [],
    );
    const effectiveBondingChange = flagBonding.modifiedBondingChange;
    if (flagBonding.totalModifier !== 0) {
      logger.info(
        `[groomController.recordInteraction] Epigenetic flag bonding influence ${flagBonding.totalModifier > 0 ? '+' : ''}${flagBonding.totalModifier.toFixed(1)} (base ${effects.bondingChange} -> ${effectiveBondingChange.toFixed(1)})`,
      );
    }

    // New foal bond score / stress level (pure, from the values read above).
    const newBondScore = Math.max(
      0,
      Math.min(100, (foal.bondScore || 50) + effectiveBondingChange),
    );
    const newStressLevel = Math.max(
      0,
      Math.min(100, (foal.stressLevel || 0) + effects.stressChange),
    );

    // Calculate burnout immunity status based on consecutive days
    const immunityCheck = checkBurnoutImmunity(streakUpdate.consecutiveDays);

    // -------------------------------------------------------------------------
    // Equoria-po1fl: ONE grooming session is ONE player-state change.
    //
    // Before this fix the handler issued five independent writes with no
    // transaction: GroomInteraction.create, Horse.update (bond, stress,
    // taskLog, lastGroomed, streak, burnout), FoalActivity.create, the groom's
    // +2 XP, and the GroomHorseSynergy row - the last three wrapped in
    // fail-soft try/catch arms that logged and continued. Any failure partway
    // through left state that never legally existed: an interaction row with no
    // bond change, or a bonded horse with no interaction row. The daily-limit
    // check (validateFoalInteractionLimits) keys off the interaction row, so a
    // partial failure could spend the player's one interaction for that horse
    // that day and give them nothing back for it.
    //
    // The fail-soft arms could not survive the fix and are deliberately gone:
    // inside a Postgres transaction a failed statement aborts the whole
    // transaction, so "log it and keep going" is not an option that produces a
    // committable result - it only produces a caller that thinks it succeeded.
    // Rolling the session back is also the outcome the fail-soft comments
    // actually wanted: a dropped FoalActivity row breaks the Equoria-2emg
    // invariant count(FoalActivity) == taskLog[task], and the player keeps
    // their interaction instead of paying for a broken one.
    //
    // WRITE ORDER - Horse row first, staff rows (Groom, GroomHorseSynergy)
    // second, matching the repository lock-ordering ruling recorded in
    // Equoria-6p398.9 (User -> Horse -> staff, ascending ids) and the same order
    // riderController uses. There is no User row on this path (grooming costs
    // no money here; the fee/salary path is a separate service). The two child
    // inserts take only FK FOR KEY SHARE locks on their parents, which do not
    // conflict with another transaction's plain row UPDATE, so they are safe
    // between the Horse write and the staff writes.
    // -------------------------------------------------------------------------
    const interaction = await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        // 1. Horse row - bond, stress, task log, streak, burnout.
        await tx.horse.update({
          where: { id: foalId },
          data: {
            bondScore: newBondScore,
            stressLevel: newStressLevel,
            taskLog: taskLogUpdate.taskLog,
            lastGroomed: streakUpdate.lastGroomed,
            daysGroomedInARow: streakUpdate.consecutiveDays,
            burnoutStatus: immunityCheck.status,
          },
        });

        // 2. The interaction row. This is the row the daily-limit check reads,
        // so it must not exist unless the bond change above also committed.
        const created = await tx.groomInteraction.create({
          data: {
            foalId,
            groomId,
            assignmentId,
            interactionType,
            duration,
            bondingChange: effects.bondingChange,
            stressChange: effects.stressChange,
            quality: effects.quality,
            cost: effects.cost,
            notes,
            taskType,
            qualityScore,
            milestoneWindowId,
            // 31D-4 (Equoria-gi9o): persist temperament-groom synergy modifier for analytics
            synergyModifier: effects.synergyModifier ?? 0,
          },
        });

        // 3. Equoria-2emg: FoalActivity is the canonical foal-activity event
        // log. The Horse.taskLog JSONB written above is an O(1) derived cache of
        // it, so count(FoalActivity where activityType = task) must equal
        // taskLog[task] - which is only true if the two commit together.
        await tx.foalActivity.create({
          data: {
            foalId,
            day: ageInDays,
            activityType: interactionType,
            outcome: effects.quality || 'good',
            bondingChange: effects.bondingChange,
            stressChange: effects.stressChange,
            description: `Groom interaction (${interactionType}) recorded via groom system`,
            // Equoria-8yhe3: tag this as the taskLog-driving groom stream so the
            // count derivation only ever aggregates these rows (enrichment rows
            // carry a different source and are excluded by construction).
            source: FOAL_ACTIVITY_SOURCE.GROOM_INTERACTION,
          },
        });

        // 4. Staff row: the groom's 2 XP for the session (consistent with
        // groomPersonalityTraits.mjs). Enlisted on `tx`, so it rethrows.
        await awardGroomXP(groomId, 'interaction_completed', 2, tx);

        // 5. Staff row: Equoria-5v6g - GroomHorseSynergy tracks sessionsTogether
        // on every interaction and grows synergyScore every 4th session.
        await updateGroomSynergy(groomId, foalId, 'interaction_completed', 1, tx);

        return created;
      }),
    );

    logger.info(
      `[groomController.recordInteraction] Interaction recorded: ${effects.bondingChange} bonding, ${effects.stressChange} stress, task: ${interactionType} (count: ${taskLogUpdate.taskCount})`,
    );

    // Log personality effects if applied
    if (effects.personalityEffects && effects.personalityEffects.bonusesApplied.length > 0) {
      logger.info(
        `[groomController.recordInteraction] Personality effects applied (${groom.personality}): ${effects.personalityEffects.bonusesApplied.join(', ')} - ${effects.personalityEffects.description}`,
      );
    }

    res.status(200).json({
      success: true,
      message: `${interactionType} interaction completed successfully`,
      data: {
        interaction,
        effects,
        foalUpdates: {
          previousBondScore: foal.bondScore,
          newBondScore,
          previousStressLevel: foal.stressLevel,
          newStressLevel,
          bondingChange: effects.bondingChange,
          stressChange: effects.stressChange,
        },
        taskLogging: {
          taskType: eligibilityResult.taskType,
          taskCount: taskLogUpdate.taskCount,
          totalTasks: taskLogUpdate.totalTasks,
          updatedTaskLog: taskLogUpdate.taskLog,
        },
        streakTracking: {
          consecutiveDays: streakUpdate.consecutiveDays,
          bonusEligible: streakUpdate.bonusEligible,
          streakBroken: streakUpdate.streakBroken,
          lastGroomed: streakUpdate.lastGroomed,
        },
        burnoutImmunity: {
          status: immunityCheck.status,
          immunityGranted: immunityCheck.immunityGranted,
          daysToImmunity: immunityCheck.daysToImmunity,
        },
      },
    });
    return null;
  } catch (error) {
    logger.error(`[groomController.recordInteraction] Error: ${error.message}`);
    // Equoria-po1fl: this catch hardcodes 500, so the retryable-transaction
    // mapping above would be swallowed without this guard (see
    // utils/retryableTransaction.mjs). A P2028 pool-acquire / interactive
    // timeout is "busy, retry shortly", not a permanent fault.
    if (error?.statusCode === 503 || error?.status === 503) {
      res.status(503).json({
        success: false,
        message: 'Service busy, please retry',
        error: error.message,
      });
      return null;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to record interaction',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
    return null;
  }
}

/**
 * GET /api/grooms/:groomId/horses/:horseId/synergy
 * 31D-4 (Equoria-ictn): preview temperament-groom synergy for a groom/horse pair.
 * Returns the synergyModifier (e.g. 0.25 = +25%) along with the underlying
 * temperament + personality so the UI can render a chip BEFORE assigning.
 */
export async function getGroomHorseSynergyPreview(req, res) {
  try {
    const groomId = parseInt(req.params.groomId, 10);
    const horseId = parseInt(req.params.horseId, 10);

    if (Number.isNaN(groomId) || groomId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'groomId must be a positive integer',
      });
    }
    if (Number.isNaN(horseId) || horseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'horseId must be a positive integer',
      });
    }

    const [groom, horse] = await Promise.all([
      prisma.groom.findUnique({
        where: { id: groomId },
        select: { id: true, name: true, personality: true },
      }),
      prisma.horse.findUnique({
        where: { id: horseId },
        select: { id: true, name: true, temperament: true },
      }),
    ]);

    if (!groom) {
      return res.status(404).json({ success: false, message: 'Groom not found' });
    }
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }

    const synergyModifier = getTemperamentGroomSynergy(horse.temperament, groom.personality);
    const percent = `${synergyModifier >= 0 ? '+' : ''}${Math.round(synergyModifier * 100)}%`;
    const message =
      synergyModifier === 0
        ? 'No synergy'
        : `${percent} bonding (${horse.temperament || 'Unknown'} x ${groom.personality || 'Unknown'})`;

    return res.status(200).json({
      success: true,
      data: {
        synergyModifier,
        temperament: horse.temperament || null,
        personality: groom.personality || null,
        message,
      },
    });
  } catch (error) {
    logger.error(`[groomController.getGroomHorseSynergyPreview] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to compute synergy preview',
    });
  }
}
