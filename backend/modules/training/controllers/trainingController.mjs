import {
  getLastTrainingDate,
  getHorseAge,
  getAnyRecentTraining,
  getTrainableHorses,
} from '../services/trainingModelService.mjs';
import { getHorseById } from '../../horses/index.mjs';
import { commitTrainingSession, trainingFeeFor } from '../services/trainingSessionTx.mjs';
import { MS_PER_WEEK } from '../../../constants/time.mjs';
import { getCombinedTraitEffects } from '../../../utils/traitEffects.mjs';
import { checkTraitRequirements } from '../../../utils/competitionLogic.mjs';
import { asFlagObject } from '../../../utils/jsonbArrayGuard.mjs';
import logger from '../../../utils/logger.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { invalidateCache, invalidateCachePattern } from '../../../utils/cacheHelper.mjs';
import { trainingRefusalReason } from '../services/trainingEligibility.mjs';

/**
 * Check if a horse is eligible to train in a specific discipline
 * @param {number} horseId - ID of the horse to check
 * @param {string} discipline - Discipline to train in
 * @returns {Object} - Eligibility result with eligible boolean and reason string
 * @throws {Error} - If validation fails or database error occurs
 */
async function canTrain(horseId, discipline) {
  try {
    // Validate input parameters
    if (horseId === undefined || horseId === null) {
      throw new Error('Horse ID is required');
    }

    if (!discipline) {
      throw new Error('Discipline is required');
    }

    // Validate horseId is a positive integer
    const parsedHorseId = parseInt(horseId, 10);
    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      throw new Error('Horse ID must be a positive integer');
    }

    logger.info(
      `[trainingController.canTrain] Checking training eligibility for horse ${parsedHorseId} in ${discipline}`,
    );

    // Compute eligibility fresh from DB on every call. The underlying query
    // (get horse + get most recent training log) is a fast indexed lookup.
    // Caching eligibility results is unsafe: negative results ("cooldown active")
    // become stale as the cooldown expires, and the test infrastructure
    // manipulates trainingLog timestamps directly, bypassing cache invalidation.
    return computeCanTrain(parsedHorseId, discipline);
  } catch (error) {
    logger.error(
      `[trainingController.canTrain] Error checking training eligibility: ${error.message}`,
    );
    throw new Error(`Training eligibility check failed: ${error.message}`, { cause: error });
  }
}

/**
 * Compute training eligibility from the DB.
 * Always called fresh — eligibility results are not cached.
 */
async function computeCanTrain(parsedHorseId, discipline) {
  // Fetch horse upfront — needed for age check and trait requirements
  const horse = await getHorseById(parsedHorseId);
  if (!horse) {
    logger.warn(`[trainingController.canTrain] Horse ${parsedHorseId} not found`);
    return {
      eligible: false,
      reason: 'Horse not found',
    };
  }

  // Compute effective age: prefer stored game-year field over calendar-based fallback.
  // Consistent with getTrainableHorses() — handles the case where dateOfBirth is set
  // to the creation date while horse.age holds the correct game age (e.g. adult horses
  // whose dateOfBirth was not back-dated, or horses aged via the horseAgingSystem cron).
  const computedAge = await getHorseAge(parsedHorseId);
  const effectiveAge =
    horse.age !== null && horse.age !== undefined ? horse.age : (computedAge ?? 0);

  // Age window 3..20 (retires at 21), injury and Fair-or-better health: one shared
  // rule set with the trainable-horses list (services/trainingEligibility.mjs,
  // Equoria-2nacc, Equoria-oey96.15, Equoria-u0jop, Equoria-du9bn). effectiveAge is
  // helper-derived (getHorseAge -> getHorseAgeYears, Equoria-vdw5), never inline ms-math.
  // Reasons are distinct per state so the eligibility surface can label them separately.
  const refusal = trainingRefusalReason(horse, effectiveAge);
  if (refusal) {
    logger.info(
      `[trainingController.canTrain] Horse ${parsedHorseId} cannot train (age=${effectiveAge}): ${refusal}`,
    );
    return { eligible: false, reason: refusal };
  }

  // Check trait requirements for specific disciplines (e.g., Gaited)
  if (discipline === 'Gaited') {
    if (!checkTraitRequirements(horse, discipline)) {
      logger.info(
        `[trainingController.canTrain] Horse ${parsedHorseId} lacks required trait for ${discipline} training`,
      );
      return {
        eligible: false,
        reason: 'Horse must have the Gaited trait to train in Gaited discipline',
      };
    }
  }

  // Check cooldown period (7 days since last training in ANY discipline)
  const lastTrainingDate = await getAnyRecentTraining(parsedHorseId);

  if (lastTrainingDate) {
    const now = new Date();
    const diff = now - new Date(lastTrainingDate);
    const sevenDays = 1000 * 60 * 60 * 24 * 7; // 7 days in milliseconds

    if (diff < sevenDays) {
      const remainingTime = sevenDays - diff;
      const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));

      logger.info(
        `[trainingController.canTrain] Horse ${parsedHorseId} still in cooldown for any training (${remainingDays} days remaining)`,
      );
      return {
        eligible: false,
        reason: 'Training cooldown active for this horse',
      };
    }
  }

  // Horse is eligible to train
  logger.info(
    `[trainingController.canTrain] Horse ${parsedHorseId} is eligible to train in ${discipline}`,
  );
  return {
    eligible: true,
    reason: null,
  };
}

// Owner ruling 2026-10-23 (Equoria-576c0.1): a weekly session adds exactly +5 to the
// trained discipline, whatever the horse's traits, temperament or trainer.
const TRAINING_DISCIPLINE_GAIN = 5;
/** Player XP per weekly session (the long-standing base amount, now never scaled). */
const TRAINING_PLAYER_XP = 5;

/** The result trainHorse returns when it refuses a session (nothing was written). */
const refusal = reason => ({
  success: false,
  reason,
  updatedHorse: null,
  message: `Training not allowed: ${reason}`,
  nextEligible: null,
});

/**
 * Train a horse in a specific discipline (with eligibility validation and trait effects)
 * @param {number} horseId - ID of the horse to train
 * @param {string} discipline - Discipline to train in
 * @returns {Object} - Training result with success status, updated horse, and next eligible date
 * @throws {Error} - If validation fails or training is not allowed
 */
async function trainHorse(horseId, discipline) {
  try {
    logger.info(
      `[trainingController.trainHorse] Attempting to train horse ${horseId} in ${discipline}`,
    );

    // Check if horse is eligible to train
    const eligibilityCheck = await canTrain(horseId, discipline);

    if (!eligibilityCheck.eligible) {
      logger.warn(`[trainingController.trainHorse] Training rejected: ${eligibilityCheck.reason}`);
      return refusal(eligibilityCheck.reason);
    }

    // Get horse data with traits for effect calculations
    const horse = await getHorseById(horseId);
    if (!horse) {
      throw new Error('Horse not found');
    }

    // Get horse traits and calculate combined effects
    const traits = horse.epigeneticModifiers || { positive: [], negative: [], hidden: [] };
    const allTraits = [...(traits.positive || []), ...(traits.negative || [])];
    const traitEffects = getCombinedTraitEffects(allTraits);

    logger.info(
      `[trainingController.trainHorse] Horse ${horseId} has traits: ${allTraits.length > 0 ? allTraits.join(', ') : 'none'}`,
    );

    // Owner ruling 2026-10-22 (Equoria-0d4wa): no trait blocks training — there
    // is no burnout. Bad health (canTrain above) is the only consequence gate.

    // Equoria-bvddn.17: a training session is ONE unit of work. Everything the
    // session writes — owner XP, the cooldown claim, the TrainingLog row and
    // the discipline-score gain — commits in a single transaction, so a
    // failure at any step leaves the cooldown unclaimed and nothing
    // half-applied. All inputs (modifiers, XP amount) are computed BEFORE the
    // transaction; the transaction only writes. The score gain is an
    // in-database increment on the committed row value, never a JS
    // read-then-write, so a concurrent writer is never overwritten.
    const parsedHorseId = parseInt(horseId, 10);

    // Equoria-0ihyi: the cooldown claim inside the transaction below is the
    // AUTHORITATIVE gate — canTrain() above is only a fast-path pre-check.
    const cooldownNow = new Date();
    let cooldownDaysForGate = 7;
    if (traitEffects.trainingTimeReduction) {
      cooldownDaysForGate = Math.max(
        5,
        Math.round(cooldownDaysForGate * (1 - traitEffects.trainingTimeReduction)),
      );
    }
    const nextEligibleClaim = new Date(cooldownNow);
    nextEligibleClaim.setDate(nextEligibleClaim.getDate() + cooldownDaysForGate);

    // Equoria-3kegj: the assigned trainer (if any) is paid a fee per session.
    // Fail-soft — a trainer load / DB error degrades to the no-trainer path
    // (no fee) and must NEVER block the primary discipline-score write.
    let activeTrainer = null;
    try {
      const activeTrainerAssignment = await prisma.trainerAssignment.findFirst({
        where: { horseId: parsedHorseId, isActive: true },
        select: { trainerId: true, trainer: true },
      });
      if (activeTrainerAssignment?.trainerId) {
        activeTrainer = activeTrainerAssignment.trainer ?? null;
      }
    } catch (trainerLoadErr) {
      logger.error(
        `[trainingController.trainHorse] Failed to load active trainer for horse ${horseId} (degrading to no-trainer): ${trainerLoadErr.message}`,
      );
    }

    // OWNER RULING 2026-10-23 (Equoria-576c0.1): a weekly session adds a FLAT +5
    // to the trained discipline. No trainer bonus, no trait scaling, no
    // temperament scaling. (Old contract, Equoria-oey96.7: the gain was
    // max(1, round(5 * (1 + trait trainingXpModifier) * (1 + trainer net))).)
    const disciplineScoreIncrease = TRAINING_DISCIPLINE_GAIN;

    // Owner rulings 2026-10-19 and 2026-10-21: training adds to the trained
    // discipline's score and never raises a horse stat, in every discipline.

    // OWNER RULING q31 (2026-10-23, Equoria-576c0.1): the PLAYER XP a session
    // awards is flat too, the same amount every session, with no trait or
    // score scaling. (Old contract: round(5 * (1 + trait trainingXpModifier)),
    // floor 1.) Horses never earn XP from training.
    const baseXp = TRAINING_PLAYER_XP;

    const ownerId = horse.userId ?? null;
    if (!ownerId) {
      logger.warn(
        `[trainingController.trainHorse] Horse ${horse.id} (${horse.name}) has no userId - XP cannot be awarded`,
      );
    }

    const txResult = await commitTrainingSession({
      horseId: parsedHorseId,
      ownerId,
      horseName: horse.name,
      discipline,
      xpAmount: baseXp,
      cooldownNow,
      nextEligible: nextEligibleClaim,
      disciplineScoreIncrease,
      trainerFee: trainingFeeFor(activeTrainer), // Equoria-3kegj: the trainer applied is paid
    });
    if (txResult?.refused) {
      return refusal(txResult.refused);
    }
    if (!txResult) {
      logger.info(
        `[trainingController.trainHorse] Atomic cooldown claim lost the race for horse ${horseId}`,
      );
      return refusal('Training cooldown active for this horse');
    }

    const { trainingLog, updatedHorse, xpCore, trainingFee } = txResult;

    if (xpCore) {
      logger.info(
        `[trainingController.trainHorse] Awarded ${baseXp} XP to user ${ownerId} for training${xpCore.leveledUp ? ` - LEVEL UP to ${xpCore.currentLevel}!` : ''}`,
      );
      // Post-commit, so a reader can never cache a value from a rolled-back tx.
      try {
        await invalidateCache(`user:progress:${ownerId}`);
      } catch (cacheErr) {
        logger.warn(
          `[trainingController.trainHorse] Failed to invalidate user progress cache: ${cacheErr.message}`,
        );
      }
    }

    const nextEligible = nextEligibleClaim;

    logger.info(
      `[trainingController.trainHorse] Successfully trained horse ${horseId} in ${discipline} (Log ID: ${trainingLog.id}, Score +${disciplineScoreIncrease})`,
    );

    // Owner ruling 2026-10-21 (Equoria-dea06): trainers are fixed NPCs. A
    // session awards the trainer no XP and never changes its generated level.

    // Bust ALL eligibility cache entries for this horse so the next check
    // for any discipline sees the new cooldown state immediately.
    // Invalidating by prefix covers the trained discipline AND all others
    // (which are now blocked by the global cooldown).
    invalidateCachePattern(`training:eligibility:${parseInt(horseId, 10)}:*`).catch(err => {
      logger.warn(
        `[trainingController.trainHorse] Failed to invalidate eligibility cache: ${err.message}`,
      );
    });

    return {
      success: true,
      updatedHorse,
      disciplineScoreIncrease,
      // Equoria-o1x6g: surface the REAL awarded XP (a flat 5, q31) so the
      // route + frontend result modal can show the actual XP row instead of
      // inferring it from traitEffects.xpModifier (a trait-only delta, not the
      // awarded amount).
      xpAwarded: baseXp,
      // Equoria-3kegj: the trainer fee this session charged (0 with no trainer).
      trainingFee,
      message: `Horse trained successfully in ${discipline}. +${disciplineScoreIncrease} added.`,
      nextEligible: nextEligible.toISOString(),
      traitEffects: {
        appliedTraits: allTraits,
        xpModifier: 0, // player XP is flat (q31); kept so the response shape is stable
      },
    };
  } catch (error) {
    logger.error(`[trainingController.trainHorse] Training failed: ${error.message}`);
    // Equoria-7x9po idiom: a transient transaction timeout keeps its 503 so the
    // route can tell the player to retry, instead of being re-wrapped as a 500.
    if (error?.status === 503) {
      throw error;
    }
    throw new Error(`Training failed: ${error.message}`, { cause: error });
  }
}

/**
 * Get training status for a horse in a specific discipline
 * @param {number} horseId - ID of the horse to check
 * @param {string} discipline - Discipline to check
 * @returns {Object} - Training status with eligibility, last training date, and cooldown info
 * @throws {Error} - If validation fails or database error occurs
 */
async function getTrainingStatus(horseId, discipline) {
  try {
    logger.info(
      `[trainingController.getTrainingStatus] Getting training status for horse ${horseId} in ${discipline}`,
    );

    // Get eligibility check (now uses global cooldown)
    const eligibilityCheck = await canTrain(horseId, discipline);

    // Get additional status information with error handling
    let age = null;
    let lastTrainingDateInDiscipline = null;
    let lastTrainingDateAny = null;

    try {
      age = await getHorseAge(horseId);
    } catch (error) {
      logger.warn(
        `[trainingController.getTrainingStatus] Error getting horse age: ${error.message}`,
      );
    }

    try {
      lastTrainingDateInDiscipline = await getLastTrainingDate(horseId, discipline);
    } catch (error) {
      logger.warn(
        `[trainingController.getTrainingStatus] Error getting last training date: ${error.message}`,
      );
    }

    try {
      lastTrainingDateAny = await getAnyRecentTraining(horseId);
    } catch (error) {
      logger.warn(
        `[trainingController.getTrainingStatus] Error getting recent training: ${error.message}`,
      );
    }

    let cooldownInfo = null;
    if (lastTrainingDateAny) {
      const now = new Date();
      const diff = now - new Date(lastTrainingDateAny);
      const sevenDays = 1000 * 60 * 60 * 24 * 7;

      if (diff < sevenDays) {
        const remainingTime = sevenDays - diff;
        const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
        const remainingHours = Math.ceil(remainingTime / (1000 * 60 * 60));

        cooldownInfo = {
          active: true,
          remainingDays,
          remainingHours,
          lastTrainingDate: lastTrainingDateAny,
        };
      } else {
        cooldownInfo = {
          active: false,
          remainingDays: 0,
          remainingHours: 0,
          lastTrainingDate: lastTrainingDateAny,
        };
      }
    }

    // Frontend reads `nextEligibleDate` per-discipline to compute the
    // global cooldown banner (components/horse/TrainingTab.tsx →
    // getGlobalCooldown). Derive it from the global 7-day cooldown so
    // the field is always present when the horse is still on cooldown.
    let nextEligibleDate = null;
    if (cooldownInfo?.active && cooldownInfo.lastTrainingDate) {
      const lastTrainMs = new Date(cooldownInfo.lastTrainingDate).getTime();
      nextEligibleDate = new Date(lastTrainMs + MS_PER_WEEK).toISOString();
    }

    const status = {
      eligible: eligibilityCheck.eligible,
      reason: eligibilityCheck.reason,
      horseAge: age,
      lastTrainingDate: lastTrainingDateInDiscipline, // Still show discipline-specific for UI
      nextEligibleDate, // ISO string when cooldown is active, null otherwise
      cooldown: cooldownInfo,
    };

    logger.info(
      `[trainingController.getTrainingStatus] Training status retrieved for horse ${horseId}: eligible=${status.eligible}`,
    );

    return status;
  } catch (error) {
    logger.error(
      `[trainingController.getTrainingStatus] Error getting training status: ${error.message}`,
    );
    throw new Error(`Training status check failed: ${error.message}`, { cause: error });
  }
}

/**
 * Route handler for POST /train endpoint
 * @param {Object} req - Express request object with horseId and discipline in body
 * @param {Object} res - Express response object
 */
async function trainRouteHandler(req, res) {
  try {
    const { horseId, discipline } = req.body;

    logger.info(
      `[trainingController.trainRouteHandler] Training request for horse ${horseId} in ${discipline}`,
    );

    // Call the existing trainHorse function
    const result = await trainHorse(horseId, discipline);

    if (result.success) {
      // Extract the updated score for the specific discipline
      const disciplineScores = asFlagObject(result.updatedHorse?.disciplineScores);
      const updatedScore = disciplineScores[discipline] || 0;

      // Use actual discipline score increase computed by trainHorse
      const actualIncrease = result.disciplineScoreIncrease ?? 5;

      // Format response with trait effects information.
      // Equoria-o1x6g: the route previously DROPPED the real awarded XP and the
      // authoritative disciplineScoreIncrease that trainHorse() already
      // computed, leaving the XP row wired to traitEffects.xpModifier (a
      // trait-only delta, not the award) and scoreGain recomputed client-side
      // (drifting from the real value). Surface both. Existing fields
      // (updatedScore, nextEligibleDate, traitEffects) are preserved verbatim —
      // the frontend already relies on them. temperamentEffects was removed by
      // owner ruling 2026-10-21 (temperament has no training modifier).
      res.json({
        success: true,
        message: `${result.updatedHorse.name} trained in ${discipline}. +${actualIncrease} added.`,
        updatedScore,
        // Authoritative score delta computed by trainHorse (the flat +5).
        // null-coalesced to 5 above for the message; surface the same value as
        // a first-class field.
        disciplineScoreIncrease: actualIncrease,
        // Real awarded XP (post-trait, floor-1). null only if
        // trainHorse somehow omitted it (older return shape) — keep it explicit.
        xpAwarded: result.xpAwarded ?? null,
        trainingFee: result.trainingFee ?? 0, // Equoria-3kegj: the trainer fee charged
        nextEligibleDate: result.nextEligible,
        traitEffects: result.traitEffects,
      });
    } else {
      // Return failure response for ineligible training
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    logger.error(`[trainingController.trainRouteHandler] Error: ${error.message}`);
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to train horse',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

export { canTrain, trainHorse, getTrainingStatus, getTrainableHorses, trainRouteHandler };
