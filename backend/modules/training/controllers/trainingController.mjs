import {
  getLastTrainingDate,
  getHorseAge,
  logTrainingSession,
  getAnyRecentTraining,
} from '../../../models/trainingModel.mjs';
import {
  incrementDisciplineScore,
  getHorseById,
  updateHorseStat,
} from '../../../models/horseModel.mjs';
import { getUserWithHorses, addXpToUser } from '../../../models/userModel.mjs';
import { logXpEvent } from '../../../models/xpLogModel.mjs';
import { getCombinedTraitEffects } from '../../../utils/traitEffects.mjs';
import { checkTraitRequirements } from '../../../utils/competitionLogic.mjs';
import { getAllDisciplines } from '../../../utils/statMap.mjs';
import { getTemperamentTrainingModifiers } from '../../horses/services/temperamentService.mjs';
import logger from '../../../utils/logger.mjs';
import prisma from '../../../db/index.mjs';

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

    if (effectiveAge < 3) {
      logger.info(
        `[trainingController.canTrain] Horse ${parsedHorseId} is too young (effectiveAge=${effectiveAge})`,
      );
      return {
        eligible: false,
        reason: 'Horse is under age',
      };
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
  } catch (error) {
    logger.error(
      `[trainingController.canTrain] Error checking training eligibility: ${error.message}`,
    );
    throw new Error(`Training eligibility check failed: ${error.message}`);
  }
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
    const traits = horse.epigenetic_modifiers || { positive: [], negative: [], hidden: [] };
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

    // Log the training session
    const trainingLog = await logTrainingSession({ horseId, discipline });

    // Calculate base discipline score increase (default +5)
    let disciplineScoreIncrease = 5;

    // Apply trait effects to discipline score.
    // trainingXpModifier is the single trait training modifier (applies to both score and XP).
    if (traitEffects.trainingXpModifier !== null && traitEffects.trainingXpModifier !== undefined) {
      disciplineScoreIncrease = Math.round(
        disciplineScoreIncrease * (1 + traitEffects.trainingXpModifier),
      );
      logger.info(
        `[trainingController.trainHorse] Trait training modifier applied to discipline score: ${(traitEffects.trainingXpModifier * 100).toFixed(1)}%`,
      );
    }

    // Capture post-trait, pre-temperament score for accurate traitEffects reporting
    const traitAdjustedScore = disciplineScoreIncrease;

    // Apply temperament modifier to discipline score
    const temperamentMods = getTemperamentTrainingModifiers(horse.temperament);
    if (temperamentMods.scoreModifier !== 0) {
      disciplineScoreIncrease = Math.round(
        disciplineScoreIncrease * (1 + temperamentMods.scoreModifier),
      );
      logger.info(
        `[trainingController.trainHorse] Temperament "${horse.temperament}" score modifier: ${(temperamentMods.scoreModifier * 100).toFixed(0)}%`,
      );
    }

    // Ensure minimum gain of 1 point
    disciplineScoreIncrease = Math.max(1, disciplineScoreIncrease);

    // Update the horse's discipline score with trait-modified amount (primary write — must succeed)
    const updatedHorse = await incrementDisciplineScore(
      horseId,
      discipline,
      disciplineScoreIncrease,
    );

    // Check for stat gain chance with trait effects (secondary/bonus write — after primary)
    let statGainOccurred = false;
    let statGainDetails = null;

    // Base stat gain chance is 15% for training
    let statGainChance = 0.15;

    // Apply trait effects to stat gain chance
    if (traitEffects.statGainChanceModifier) {
      statGainChance = Math.max(
        0,
        Math.min(1, statGainChance + traitEffects.statGainChanceModifier),
      );
      logger.info(
        `[trainingController.trainHorse] Stat gain chance modified by traits: ${(statGainChance * 100).toFixed(1)}%`,
      );
    }

    // Roll for stat gain
    if (Math.random() < statGainChance) {
      statGainOccurred = true;

      // Determine which stat to improve based on discipline
      const disciplineStatMap = {
        'Western Pleasure': ['obedience', 'focus', 'precision'],
        Reining: ['precision', 'agility', 'focus'],
        Cutting: ['agility', 'strength', 'intelligence'],
        'Barrel Racing': ['speed', 'agility', 'stamina'],
        Roping: ['strength', 'precision', 'focus'],
        'Team Penning': ['intelligence', 'agility', 'obedience'],
        Rodeo: ['strength', 'agility', 'endurance'],
        Hunter: ['precision', 'endurance', 'agility'],
        Saddleseat: ['flexibility', 'obedience', 'precision'],
        Endurance: ['endurance', 'stamina', 'speed'],
        Eventing: ['endurance', 'precision', 'agility'],
        Dressage: ['precision', 'obedience', 'focus'],
        'Show Jumping': ['agility', 'precision', 'intelligence'],
        Vaulting: ['strength', 'flexibility', 'endurance'],
        Polo: ['speed', 'agility', 'intelligence'],
        'Cross Country': ['endurance', 'intelligence', 'agility'],
        'Combined Driving': ['obedience', 'strength', 'focus'],
        'Fine Harness': ['precision', 'flexibility', 'obedience'],
        Gaited: ['flexibility', 'obedience', 'focus'],
        Gymkhana: ['speed', 'flexibility', 'stamina'],
        Steeplechase: ['speed', 'endurance', 'stamina'],
        Racing: ['speed', 'stamina', 'intelligence'],
        'Harness Racing': ['speed', 'precision', 'stamina'],
      };

      const relevantStats = disciplineStatMap[discipline] || ['speed', 'stamina', 'focus'];
      const statToImprove = relevantStats[Math.floor(Math.random() * relevantStats.length)];

      // Calculate stat gain amount (base 1-3 points, capped at 10 to prevent extreme trait values)
      let statGainAmount = Math.floor(Math.random() * 3) + 1;

      // Apply trait effects to stat gain amount
      if (traitEffects.baseStatBoost) {
        statGainAmount += traitEffects.baseStatBoost;
        logger.info(
          `[trainingController.trainHorse] Stat gain boosted by traits: +${traitEffects.baseStatBoost}`,
        );
      }
      statGainAmount = Math.min(10, statGainAmount);

      statGainDetails = {
        stat: statToImprove,
        amount: statGainAmount,
        traitModified: !!(traitEffects.statGainChanceModifier || traitEffects.baseStatBoost),
      };

      // Apply stat gain after discipline score is already committed
      try {
        await updateHorseStat(horseId, statToImprove, statGainAmount);
        logger.info(
          `[trainingController.trainHorse] Stat gain: ${statToImprove} +${statGainAmount}`,
        );
      } catch (error) {
        logger.error(`[trainingController.trainHorse] Failed to update stat: ${error.message}`);
        statGainOccurred = false;
        statGainDetails = null;
      }
    }

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

    // Award XP to horse owner for training
    if (updatedHorse && updatedHorse.userId) {
      // Award XP — separate try-catch so audit log failure doesn't suppress XP errors
      let xpResult = null;
      try {
        xpResult = await addXpToUser(updatedHorse.userId, baseXp);
        logger.info(
          `[trainingController.trainHorse] Awarded ${baseXp} XP to user ${updatedHorse.userId} for training${xpResult.leveledUp ? ` - LEVEL UP to ${xpResult.newLevel}!` : ''}`,
        );
      } catch (error) {
        logger.error(
          `[trainingController.trainHorse] Failed to award training XP: ${error.message}`,
        );
        // Continue with training completion even if XP award fails
      }

      // Audit log — separate try-catch so a log failure never suppresses XP award
      try {
        await logXpEvent({
          userId: updatedHorse.userId,
          amount: baseXp,
          reason: `Trained horse ${updatedHorse.name} in ${discipline}`,
        });
      } catch (error) {
        logger.error(
          `[trainingController.trainHorse] Failed to log XP audit event: ${error.message}`,
        );
        // Non-fatal — XP was already awarded above
      }
    } else if (updatedHorse && !updatedHorse.userId) {
      logger.warn(
        `[trainingController.trainHorse] Horse ${updatedHorse.id} (${updatedHorse.name}) has no userId - XP cannot be awarded`,
      );
    }

    // Calculate next eligible training date (7 days from now, potentially modified by traits)
    const nextEligible = new Date();
    let cooldownDays = 7;

    // Some traits might affect training frequency in the future
    if (traitEffects.trainingTimeReduction) {
      cooldownDays = Math.max(
        5,
        Math.round(cooldownDays * (1 - traitEffects.trainingTimeReduction)),
      );
      logger.info(
        `[trainingController.trainHorse] Training cooldown reduced by trait effects to ${cooldownDays} days`,
      );
    }

    nextEligible.setDate(nextEligible.getDate() + cooldownDays);

    // Persist the cooldown on the Horse record so the frontend can display it
    try {
      await prisma.horse.update({
        where: { id: parseInt(horseId, 10) },
        data: { trainingCooldown: nextEligible },
      });
    } catch (cooldownErr) {
      logger.error(
        `[trainingController.trainHorse] Failed to persist trainingCooldown: ${cooldownErr.message}`,
      );
    }

    logger.info(
      `[trainingController.trainHorse] Successfully trained horse ${horseId} in ${discipline} (Log ID: ${trainingLog.id}, Score +${disciplineScoreIncrease})`,
    );

    return {
      success: true,
      updatedHorse,
      disciplineScoreIncrease,
      message: `Horse trained successfully in ${discipline}. +${disciplineScoreIncrease} added.${statGainOccurred ? ` Stat gain: ${statGainDetails.stat} +${statGainDetails.amount}` : ''}`,
      nextEligible: nextEligible.toISOString(),
      statGain: statGainOccurred ? statGainDetails : null,
      traitEffects: {
        appliedTraits: allTraits,
        scoreModifier: traitAdjustedScore - 5, // trait-only delta (pre-temperament)
        xpModifier: traitAdjustedXp - 5, // trait-only delta (pre-temperament)
        statGainChanceModifier: traitEffects.statGainChanceModifier || 0,
        baseStatBoost: traitEffects.baseStatBoost || 0,
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
    throw new Error(`Training failed: ${error.message}`);
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

    const status = {
      eligible: eligibilityCheck.eligible,
      reason: eligibilityCheck.reason,
      horseAge: age,
      lastTrainingDate: lastTrainingDateInDiscipline, // Still show discipline-specific for UI
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
    throw new Error(`Training status check failed: ${error.message}`);
  }
}

/**
 * Get all horses owned by a user that are eligible for training in at least one discipline
 * @param {string} userId - UUID of the user
 * @returns {Array} - Array of horses with their trainable disciplines
 * @throws {Error} - If validation fails or database error occurs
 */
async function getTrainableHorses(userId) {
  try {
    // Validate input parameters
    if (!userId) {
      throw new Error('User ID is required');
    }

    logger.info(
      `[trainingController.getTrainableHorses] Getting trainable horses for user ${userId}`,
    );

    // Get user with their horses
    const player = await getUserWithHorses(userId);

    if (!player) {
      logger.warn(`[trainingController.getTrainableHorses] User ${userId} not found`);
      return [];
    }

    if (!player.horses || player.horses.length === 0) {
      logger.info(`[trainingController.getTrainableHorses] User ${userId} has no horses`);
      return [];
    }

    // All 23 disciplines — Gaited filtered per horse trait
    const allDisciplines = getAllDisciplines();

    const allHorses = [];

    for (const horse of player.horses) {
      try {
        // Compute age from dateOfBirth — used as primary age signal when dateOfBirth is set
        const computedAge = await getHorseAge(horse.id);

        // Effective age: prefer the stored integer `age` field (the "game age") when
        // computedAge would incorrectly under-count due to a wrong dateOfBirth (e.g.
        // horses created before the dateOfBirth-from-age fix).  Fall back to computedAge
        // if horse.age is absent, then default to 0.
        const effectiveAge =
          horse.age !== null && horse.age !== undefined ? horse.age : (computedAge ?? 0);

        // Gaited is only available if horse has the required trait
        const availableDisciplines = allDisciplines.filter(
          d => d !== 'Gaited' || checkTraitRequirements(horse, 'Gaited'),
        );

        const horseData = {
          id: horse.id,
          horseId: horse.id,
          name: horse.name,
          age: effectiveAge,
          ageYears: effectiveAge,
          level: horse.horseXp?.level ?? 1,
          breed: horse.breed?.name ?? null,
          sex: horse.sex ?? null,
          trainableDisciplines: availableDisciplines,
          bestDisciplines: horse.disciplineScores
            ? Object.entries(horse.disciplineScores)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([name]) => name)
            : [],
          nextEligibleAt: null,
        };

        // Under-age check: use effectiveAge so horses with a stale dateOfBirth
        // but a correct stored age field are not incorrectly blocked
        if (effectiveAge < 3) {
          horseData.trainableDisciplines = [];
          allHorses.push(horseData);
          continue;
        }

        // Cooldown check: TrainingLog is the single source of truth
        const lastTrainingDate = await getAnyRecentTraining(horse.id);
        const now = new Date();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        if (lastTrainingDate) {
          const diff = now - new Date(lastTrainingDate);
          if (diff < sevenDays) {
            const nextEligible = new Date(new Date(lastTrainingDate).getTime() + sevenDays);
            horseData.nextEligibleAt = nextEligible.toISOString();
          }
        }

        allHorses.push(horseData);
      } catch (error) {
        logger.warn(
          `[trainingController.getTrainableHorses] Error checking training eligibility for horse ${horse.id}: ${error.message}`,
        );
      }
    }

    logger.info(
      `[trainingController.getTrainableHorses] Returning ${allHorses.length} horses for user ${userId}`,
    );
    return allHorses;
  } catch (error) {
    logger.error(
      `[trainingController.getTrainableHorses] Error getting trainable horses: ${error.message}`,
    );
    throw new Error(`Failed to get trainable horses: ${error.message}`);
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
      const disciplineScores = result.updatedHorse?.disciplineScores || {};
      const updatedScore = disciplineScores[discipline] || 0;

      // Use actual discipline score increase computed by trainHorse
      const actualIncrease = result.disciplineScoreIncrease ?? 5;

      // Format response with trait and temperament effects information
      res.json({
        success: true,
        message: `${result.updatedHorse.name} trained in ${discipline}. +${actualIncrease} added.`,
        updatedScore,
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
    res.status(500).json({
      success: false,
      message: 'Failed to train horse',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

export { canTrain, trainHorse, getTrainingStatus, getTrainableHorses, trainRouteHandler };
