import {
  getLastTrainingDate,
  getHorseAge,
  getAnyRecentTraining,
  getTrainableHorses,
} from '../services/trainingModelService.mjs';
import { getHorseById, getTemperamentTrainingModifiers } from '../../horses/index.mjs';
import { commitTrainingSession } from '../services/trainingSessionTx.mjs';
import { MS_PER_WEEK } from '../../../constants/time.mjs';
import { getCombinedTraitEffects } from '../../../utils/traitEffects.mjs';
import { checkTraitRequirements } from '../../../utils/competitionLogic.mjs';
import { asFlagObject } from '../../../utils/jsonbArrayGuard.mjs';
import logger from '../../../utils/logger.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { invalidateCache, invalidateCachePattern } from '../../../utils/cacheHelper.mjs';
import { awardTrainerSessionXP, computeTrainerModifiers } from '../../trainers/index.mjs';
import { MIN_ACTIVE_AGE_YEARS, MAX_ACTIVE_AGE_YEARS } from '../../../constants/horseAgePolicy.mjs';

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

  // Active-age window 3..20 inclusive (retires at 21) — shared policy in
  // constants/horseAgePolicy.mjs (Equoria-2nacc; PRODUCT.md Core Simulation).
  // effectiveAge is helper-derived (getHorseAge → getHorseAgeYears, Equoria-vdw5),
  // never inline ms-math. Reasons are distinct per state so the eligibility
  // surface can label "too young" vs "too old" separately (Story 4.2, oey96.15).
  if (effectiveAge < MIN_ACTIVE_AGE_YEARS) {
    logger.info(
      `[trainingController.canTrain] Horse ${parsedHorseId} too young (age=${effectiveAge})`,
    );
    return { eligible: false, reason: 'Horse is under age' };
  }
  if (effectiveAge > MAX_ACTIVE_AGE_YEARS) {
    logger.info(
      `[trainingController.canTrain] Horse ${parsedHorseId} too old (age=${effectiveAge} > ${MAX_ACTIVE_AGE_YEARS})`,
    );
    return { eligible: false, reason: 'Horse is too old to train' };
  }

  // Injury/health gate (Equoria-oey96.15): makes SECURITY.md A04 "Injured horses
  // cannot train" a TRUE claim (was a false-green with no enforcement here).
  // Case-insensitive vs healthStatus casing drift (mirrors showController's
  // competition gate); null healthStatus (DB default 'Excellent') is not injured.
  const normalizedHealth = String(horse.healthStatus ?? '')
    .trim()
    .toLowerCase();
  if (normalizedHealth === 'injured') {
    logger.info(
      `[trainingController.canTrain] Horse ${parsedHorseId} is injured (${horse.healthStatus}) — cannot train`,
    );
    return { eligible: false, reason: 'Horse is injured and cannot train' };
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
      return {
        success: false,
        reason: eligibilityCheck.reason,
        updatedHorse: null,
        message: `Training not allowed: ${eligibilityCheck.reason}`,
        nextEligible: null,
      };
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

    // Check for training-blocking traits
    if (traitEffects.statGainBlocked) {
      logger.warn('[trainingController.trainHorse] Training blocked by trait effects (burnout)');
      return {
        success: false,
        reason: 'Horse is experiencing burnout and cannot gain from training',
        updatedHorse: null,
        message: 'Training not effective: Horse is experiencing burnout',
        nextEligible: null,
      };
    }

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

    // Equoria-oey96.7: load the active trainer (if any) for the training
    // modifier. Fail-soft — a trainer load / DB error degrades to the
    // no-trainer path (net modifier 0) and must NEVER block the primary
    // discipline-score write. Reused below for the trainer-session XP award, so
    // the "which trainer is active this session" lookup happens exactly once.
    let activeTrainerId = null;
    let activeTrainer = null;
    try {
      const activeTrainerAssignment = await prisma.trainerAssignment.findFirst({
        where: { horseId: parsedHorseId, isActive: true },
        select: { trainerId: true, trainer: true },
      });
      if (activeTrainerAssignment?.trainerId) {
        activeTrainerId = activeTrainerAssignment.trainerId;
        activeTrainer = activeTrainerAssignment.trainer ?? null;
      }
    } catch (trainerLoadErr) {
      logger.error(
        `[trainingController.trainHorse] Failed to load active trainer for horse ${horseId} (degrading to no-trainer): ${trainerLoadErr.message}`,
      );
    }

    // Equoria-oey96.7: trainer training modifier. Defensive — {0,0} for a
    // null/malformed trainer, so the no-trainer path is byte-identical to the
    // pre-feature behavior. Applies to the discipline-score GAIN only (NOT user
    // XP), per the live trainer-modifier contract.
    const trainerModifier = computeTrainerModifiers({
      trainer: activeTrainer,
      discipline,
      horseTemperament: horse.temperament,
    });
    const trainerNet = trainerModifier.bonusPercent - trainerModifier.penaltyPercent;

    // Discipline-score gain composed in a SINGLE terminal round
    // (Equoria-oey96.7): traits → temperament → trainer. The previous code
    // rounded after EACH stage, which lost sub-integer modifiers and made the
    // composition order observable; one terminal round fixes both. Focused
    // integration tests pin the composition. XP is unaffected (trainer never touches XP)
    // and keeps its own per-stage rounding further below.
    const BASE_DISCIPLINE_GAIN = 5;
    const traitScoreMod =
      traitEffects.trainingXpModifier !== null && traitEffects.trainingXpModifier !== undefined
        ? traitEffects.trainingXpModifier
        : 0;
    const temperamentMods = getTemperamentTrainingModifiers(horse.temperament);
    const temperamentScoreMod = temperamentMods.scoreModifier ?? 0;

    const disciplineScoreIncrease = Math.max(
      1,
      Math.round(
        BASE_DISCIPLINE_GAIN * (1 + traitScoreMod) * (1 + temperamentScoreMod) * (1 + trainerNet),
      ),
    );

    // Trait-only delta (pre-temperament, pre-trainer) preserved for the
    // response contract's traitEffects.scoreModifier reporting field.
    const traitAdjustedScore = Math.round(BASE_DISCIPLINE_GAIN * (1 + traitScoreMod));

    if (traitScoreMod !== 0) {
      logger.info(
        `[trainingController.trainHorse] Trait training modifier applied to discipline score: ${(traitScoreMod * 100).toFixed(1)}%`,
      );
    }
    if (temperamentScoreMod !== 0) {
      logger.info(
        `[trainingController.trainHorse] Temperament "${horse.temperament}" score modifier: ${(temperamentScoreMod * 100).toFixed(0)}%`,
      );
    }
    if (trainerNet !== 0) {
      logger.info(
        `[trainingController.trainHorse] Trainer modifier applied to discipline score: +${(trainerModifier.bonusPercent * 100).toFixed(1)}% / -${(trainerModifier.penaltyPercent * 100).toFixed(1)}% (net ${(trainerNet * 100).toFixed(1)}%)`,
      );
    }

    // Owner rulings 2026-10-19 and 2026-10-21: training adds to the trained
    // discipline's score and never raises a horse stat, in every discipline.

    // Calculate XP award with trait effects
    let baseXp = 5;
    if (traitEffects.trainingXpModifier !== null && traitEffects.trainingXpModifier !== undefined) {
      baseXp = Math.round(baseXp * (1 + traitEffects.trainingXpModifier));
    }

    // Capture post-trait, pre-temperament XP for accurate traitEffects reporting
    const traitAdjustedXp = baseXp;

    // Apply temperament modifier to XP
    if (temperamentMods.xpModifier !== 0) {
      baseXp = Math.round(baseXp * (1 + temperamentMods.xpModifier));
      logger.info(
        `[trainingController.trainHorse] Temperament "${horse.temperament}" XP modifier: ${(temperamentMods.xpModifier * 100).toFixed(0)}%`,
      );
    }
    baseXp = Math.max(1, baseXp);

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
    });
    if (!txResult) {
      logger.info(
        `[trainingController.trainHorse] Atomic cooldown claim lost the race for horse ${horseId}`,
      );
      return {
        success: false,
        reason: 'Training cooldown active for this horse',
        updatedHorse: null,
        message: 'Training not allowed: Training cooldown active for this horse',
        nextEligible: null,
      };
    }

    const { trainingLog, updatedHorse, xpCore } = txResult;

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

    // Equoria-r1nr: award trainer XP for the session, using the active
    // assignment already loaded above for the training modifier (Equoria-oey96.7
    // consolidated the two identical TrainerAssignment lookups into one).
    // Fail-soft — trainer XP failure must not block the training result.
    if (activeTrainerId) {
      try {
        await awardTrainerSessionXP(activeTrainerId);
      } catch (trainerXpErr) {
        logger.error(
          `[trainingController.trainHorse] Failed to award trainer XP for horse ${horseId}: ${trainerXpErr.message}`,
        );
      }
    }

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
      // Equoria-o1x6g: surface the REAL awarded XP (post-trait, post-temperament,
      // floor-1) so the route + frontend result modal can show the actual XP
      // row instead of inferring it from traitEffects.xpModifier (a trait-only
      // delta, not the awarded amount).
      xpAwarded: baseXp,
      message: `Horse trained successfully in ${discipline}. +${disciplineScoreIncrease} added.`,
      nextEligible: nextEligible.toISOString(),
      // Equoria-oey96.7: surface the trainer contribution honestly so the UI
      // can show the effect even in sessions where the single terminal round
      // absorbs the integer point delta. net can be negative (an incompatible
      // or retired trainer). {0,0,0} when no trainer is assigned.
      trainerModifier: {
        bonusPercent: trainerModifier.bonusPercent,
        penaltyPercent: trainerModifier.penaltyPercent,
        net: trainerNet,
      },
      traitEffects: {
        appliedTraits: allTraits,
        scoreModifier: traitAdjustedScore - 5, // trait-only delta (pre-temperament)
        xpModifier: traitAdjustedXp - 5, // trait-only delta (pre-temperament)
      },
      temperamentEffects: horse.temperament
        ? {
            temperament: horse.temperament,
            xpModifier: temperamentMods.xpModifier,
            scoreModifier: temperamentMods.scoreModifier,
          }
        : null,
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

      // Format response with trait and temperament effects information.
      // Equoria-o1x6g: the route previously DROPPED the real awarded XP and the
      // authoritative disciplineScoreIncrease that trainHorse() already
      // computed, leaving the XP row wired to traitEffects.xpModifier (a
      // trait-only delta, not the award) and scoreGain recomputed client-side
      // (drifting from the real value). Surface both. Existing fields
      // (updatedScore, nextEligibleDate, traitEffects, temperamentEffects) are
      // preserved verbatim — the frontend already relies on them.
      res.json({
        success: true,
        message: `${result.updatedHorse.name} trained in ${discipline}. +${actualIncrease} added.`,
        updatedScore,
        // Authoritative score delta computed by trainHorse (base +5, trait- and
        // temperament-modified, floor-1). null-coalesced to 5 above for the
        // message; surface the same value as a first-class field.
        disciplineScoreIncrease: actualIncrease,
        // Real awarded XP (post-trait, post-temperament, floor-1). null only if
        // trainHorse somehow omitted it (older return shape) — keep it explicit.
        xpAwarded: result.xpAwarded ?? null,
        // Equoria-oey96.7: { bonusPercent, penaltyPercent, net } trainer
        // contribution to the discipline-score gain (net can be negative;
        // {0,0,0} when no trainer). null only for an older trainHorse shape.
        trainerModifier: result.trainerModifier ?? null,
        nextEligibleDate: result.nextEligible,
        traitEffects: result.traitEffects,
        temperamentEffects: result.temperamentEffects,
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
