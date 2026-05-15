/**
 * Groom Management Controller
 * Handles groom assignments, interactions, and management operations
 */

// Maximum number of grooms a user can hire
const MAX_GROOMS_PER_USER = 10;

// Base hiring cost for grooms (modified by skill level)
const BASE_HIRING_COST = 500;

import {
  assignGroomToFoal,
  calculateGroomInteractionEffects,
  validateFoalInteractionLimits,
  ensureDefaultGroomAssignment,
  GROOM_SPECIALTIES,
  SKILL_LEVELS,
  PERSONALITY_TRAITS,
  DEFAULT_GROOMS,
} from '../../../utils/groomSystem.mjs';
import {
  GROOM_SPECIALTY_VALUES,
  GROOM_SKILL_LEVEL_VALUES,
  GROOM_PERSONALITY_VALUES,
} from '../../../constants/schema.mjs';
import {
  validateGroomingEligibility,
  updateTaskLog,
  updateStreakTracking,
  checkTaskMutualExclusivity as _checkTaskMutualExclusivity,
  checkBurnoutImmunity,
} from '../../../utils/groomBondingSystem.mjs';
import { DEVELOPMENTAL_WINDOWS } from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';
import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';
import { awardGroomXP, updateGroomSynergy } from '../../../services/groomProgressionService.mjs';
import { invalidateCachePattern } from '../../../utils/cacheHelper.mjs';
import { parsePaginationParams } from '../../../utils/paginationHelper.mjs';
import { getTemperamentGroomSynergy } from '../../horses/services/temperamentService.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';

const GROOM_LIST_SELECT = {
  id: true,
  name: true,
  speciality: true,
  experience: true,
  level: true,
  skillLevel: true,
  personality: true,
  sessionRate: true,
  isActive: true,
  imageUrl: true,
  userId: true,
};

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
 * POST /api/grooms/assign
 * Assign a groom to a foal
 */
export async function assignGroom(req, res) {
  try {
    const { foalId, groomId, priority = 1, notes } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      logger.error('[groomController.assignGroom] No authenticated user ID found');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        data: null,
      });
    }

    logger.info(`[groomController.assignGroom] Assigning groom ${groomId} to foal ${foalId}`);

    // Validate required fields
    if (!foalId || !groomId) {
      return res.status(400).json({
        success: false,
        message: 'foalId and groomId are required',
        data: null,
      });
    }

    // Ownership validated by inline dual-ownership middleware on the route
    // (groomRoutes.mjs `POST /assign`), which uses findOwnedResource('foal',...)
    // and findOwnedResource('groom',...) and returns 404 for both not-found
    // and not-owned (CWE-639 disclosure resistance).

    const result = await assignGroomToFoal(foalId, groomId, userId, {
      priority,
      notes,
      isDefault: false,
    });

    res.status(201).json({
      success: true,
      message: result.message,
      data: result.assignment,
    });
    return null;
  } catch (error) {
    logger.error(`[groomController.assignGroom] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to assign groom',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
    return null;
  }
}

/**
 * POST /api/grooms/ensure-default/:foalId
 * Ensure a foal has a default groom assignment
 */
export async function ensureDefaultAssignment(req, res) {
  try {
    const { foalId } = req.params;
    const userId = req.user?.id;

    // Validate user authentication
    if (!userId) {
      logger.error('[groomController.ensureDefaultAssignment] No authenticated user ID found');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        data: null,
      });
    }

    // Validate foalId parameter
    const parsedFoalId = parseInt(foalId, 10);
    if (isNaN(parsedFoalId) || parsedFoalId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid foal ID. Must be a positive integer.',
        data: null,
      });
    }

    logger.info(
      `[groomController.ensureDefaultAssignment] Ensuring default assignment for foal ${parsedFoalId}`,
    );

    // Ownership validated by requireOwnership('foal') middleware on the route.
    // req.foal is the validated, owned record. The middleware returns 404 for
    // both not-found and not-owned (CWE-639 disclosure resistance).

    // Call the ensureDefaultGroomAssignment service
    const result = await ensureDefaultGroomAssignment(parsedFoalId, userId);

    // Handle the result based on success status
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        data: {
          requiresManualAssignment: result.requiresManualAssignment || false,
          foalId: parsedFoalId,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        assignment: result.assignment,
        isNew: result.isNew || false,
        isExisting: result.isExisting || false,
      },
    });
  } catch (error) {
    logger.error(`[groomController.ensureDefaultAssignment] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to ensure default assignment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * GET /api/grooms/assignments/:foalId
 * Get all assignments for a foal
 */
export async function getFoalAssignments(req, res) {
  try {
    const { foalId } = req.params;

    const parsedFoalId = parseInt(foalId, 10);
    if (isNaN(parsedFoalId) || parsedFoalId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid foal ID. Must be a positive integer.',
        data: null,
      });
    }

    logger.info(
      `[groomController.getFoalAssignments] Getting assignments for foal ${parsedFoalId}`,
    );

    const assignments = await prisma.groomAssignment.findMany({
      where: { foalId: parsedFoalId },
      include: {
        groom: true,
        foal: {
          select: { id: true, name: true, bondScore: true, stressLevel: true },
        },
      },
      orderBy: [{ isActive: 'desc' }, { priority: 'asc' }, { createdAt: 'desc' }],
    });

    res.status(200).json({
      success: true,
      message: `Retrieved ${assignments.length} assignments for foal`,
      data: {
        foalId: parsedFoalId,
        assignments,
        activeAssignments: assignments.filter(a => a.isActive),
        totalAssignments: assignments.length,
      },
    });
    return null;
  } catch (error) {
    logger.error(`[groomController.getFoalAssignments] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve foal assignments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
    return null;
  }
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

    // Record the interaction
    const interaction = await prisma.groomInteraction.create({
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

    // Update foal's bond score, stress level, task log, and streak tracking
    const newBondScore = Math.max(0, Math.min(100, (foal.bondScore || 50) + effects.bondingChange));
    const newStressLevel = Math.max(
      0,
      Math.min(100, (foal.stressLevel || 0) + effects.stressChange),
    );

    // Calculate burnout immunity status based on consecutive days
    const immunityCheck = checkBurnoutImmunity(streakUpdate.consecutiveDays);

    await prisma.horse.update({
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

    logger.info(
      `[groomController.recordInteraction] Interaction recorded: ${effects.bondingChange} bonding, ${effects.stressChange} stress`,
      `[groomController.recordInteraction] Interaction recorded: ${effects.bondingChange} bonding, ${effects.stressChange} stress, task: ${interactionType} (count: ${taskLogUpdate.taskCount})`,
    );

    // Log personality effects if applied
    if (effects.personalityEffects && effects.personalityEffects.bonusesApplied.length > 0) {
      logger.info(
        `[groomController.recordInteraction] Personality effects applied (${groom.personality}): ${effects.personalityEffects.bonusesApplied.join(', ')} - ${effects.personalityEffects.description}`,
      );
    }

    // Award experience to the groom for the interaction
    try {
      const experienceGain = 2; // 2 XP per interaction (consistent with groomPersonalityTraits.mjs)
      await awardGroomXP(groomId, 'interaction_completed', experienceGain);
      logger.info(
        `[groomController.recordInteraction] Awarded ${experienceGain} XP to groom ${groomId} for interaction`,
      );
    } catch (xpError) {
      logger.error(
        `[groomController.recordInteraction] Failed to award XP to groom ${groomId}: ${xpError.message}`,
      );
      // Don't fail the interaction if XP awarding fails
    }

    // Equoria-5v6g: update GroomHorseSynergy on every interaction so sessionsTogether
    // increments and synergyScore grows gradually (every 4th session). Without this,
    // synergy is only adjusted on milestone/trait-shaping events.
    try {
      await updateGroomSynergy(groomId, foalId, 'interaction_completed');
    } catch (synergyError) {
      logger.error(
        `[groomController.recordInteraction] Failed to update synergy for groom ${groomId} / horse ${foalId}: ${synergyError.message}`,
      );
      // Don't fail the interaction if synergy update fails
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

/**
 * GET /api/grooms/user/:userId
 * Get all grooms for a user
 */
export async function getUserGrooms(req, res) {
  try {
    const { userId } = req.params;
    const { limit, skip } = parsePaginationParams(req, { defaultLimit: 20, maxLimit: 100 });

    logger.info(`[groomController.getUserGrooms] Getting grooms for user ${userId}`);

    const where = { userId };
    const [grooms, totalGrooms] = await Promise.all([
      prisma.groom.findMany({
        where,
        select: {
          ...GROOM_LIST_SELECT,
          groomAssignments: {
            where: { isActive: true },
            select: { id: true, foal: { select: { id: true, name: true } } },
          },
          _count: {
            select: {
              groomAssignments: true,
              groomInteractions: true,
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { skillLevel: 'desc' }, { experience: 'desc' }],
        take: limit,
        skip,
      }),
      prisma.groom.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      message: `Retrieved ${grooms.length} grooms for user`,
      userId,
      grooms,
      activeGrooms: grooms.filter(g => g.isActive),
      totalGrooms,
      pagination: { total: totalGrooms, limit, offset: skip, hasMore: skip + limit < totalGrooms },
    });
  } catch (error) {
    logger.error(`[groomController.getUserGrooms] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user grooms',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * POST /api/grooms/hire
 * Hire a new groom for a user
 */
export async function hireGroom(req, res) {
  try {
    const {
      name,
      speciality,
      experience,
      skill_level,
      personality,
      session_rate,
      bio,
      availability,
    } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    logger.info(`[groomController.hireGroom] Hiring new groom ${name} for user ${userId}`);

    // Validate required fields
    if (!name || !speciality || !skill_level || !personality) {
      return res.status(400).json({
        success: false,
        message: 'name, speciality, skill_level, and personality are required',
        data: null,
      });
    }

    // Input validation and sanitization
    const sanitizedName = typeof name === 'string' ? name.trim() : '';
    if (sanitizedName.length < 2 || sanitizedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'name must be between 2 and 100 characters',
        data: null,
      });
    }

    // Validate experience (must be positive integer if provided)
    const sanitizedExperience =
      experience !== undefined && experience !== null ? parseInt(experience) : 1;
    if (
      experience !== undefined &&
      experience !== null &&
      (isNaN(sanitizedExperience) || sanitizedExperience < 1 || sanitizedExperience > 20)
    ) {
      return res.status(400).json({
        success: false,
        message: 'experience must be between 1 and 20 years',
        data: null,
      });
    }

    // Validate session rate (must be positive number if provided)
    const sanitizedSessionRate =
      session_rate !== undefined && session_rate !== null ? parseFloat(session_rate) : null;
    if (
      session_rate !== undefined &&
      session_rate !== null &&
      (isNaN(sanitizedSessionRate) || sanitizedSessionRate <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: 'session rate must be a positive number',
        data: null,
      });
    }

    // Validate speciality
    if (!GROOM_SPECIALTY_VALUES.includes(speciality)) {
      return res.status(400).json({
        success: false,
        message: `Invalid speciality. Must be one of: ${GROOM_SPECIALTY_VALUES.join(', ')}`,
        data: null,
      });
    }

    // Validate skill level
    if (!GROOM_SKILL_LEVEL_VALUES.includes(skill_level)) {
      return res.status(400).json({
        success: false,
        message: `Invalid skill level. Must be one of: ${GROOM_SKILL_LEVEL_VALUES.join(', ')}`,
        data: null,
      });
    }

    // Validate personality
    if (!GROOM_PERSONALITY_VALUES.includes(personality)) {
      return res.status(400).json({
        success: false,
        message: `Invalid personality. Must be one of: ${GROOM_PERSONALITY_VALUES.join(', ')}`,
        data: null,
      });
    }

    // Check if user has reached the maximum number of grooms
    const userGroomCount = await prisma.groom.count({
      where: { userId },
    });

    if (userGroomCount >= MAX_GROOMS_PER_USER) {
      return res.status(400).json({
        success: false,
        message: `You have reached the maximum limit of ${MAX_GROOMS_PER_USER} grooms. Please release a groom before hiring a new one.`,
        data: {
          currentCount: userGroomCount,
          maxAllowed: MAX_GROOMS_PER_USER,
        },
      });
    }

    // Calculate hiring cost based on skill level
    const skillLevelCostModifier = SKILL_LEVELS[skill_level].costModifier;
    const hiringCost = Math.round(BASE_HIRING_COST * skillLevelCostModifier);

    // Check if user has enough funds
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { money: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        data: null,
      });
    }

    if (user.money < hiringCost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds to hire this groom. You need ${hiringCost} coins, but only have ${user.money}.`,
        data: {
          requiredFunds: hiringCost,
          availableFunds: user.money,
          deficit: hiringCost - user.money,
        },
      });
    }

    // Create the groom and deduct funds in a transaction
    const result = await prisma.$transaction(async prismaTx => {
      // Create the groom
      const groom = await prismaTx.groom.create({
        data: {
          name: sanitizedName,
          speciality,
          experience: sanitizedExperience,
          skillLevel: skill_level,
          personality,
          sessionRate: sanitizedSessionRate || SKILL_LEVELS[skill_level].costModifier * 15.0,
          bio,
          availability: availability || {},
          userId,
          // Note: hiringCost is not stored in groom model, only used for transaction
        },
      });

      // Deduct funds from user
      await prismaTx.user.update({
        where: { id: userId },
        data: {
          money: {
            decrement: hiringCost,
          },
        },
      });

      return { groom, hiringCost };
    });

    logger.info(
      `[groomController.hireGroom] Successfully hired groom ${result.groom.name} (ID: ${result.groom.id}) for ${result.hiringCost} coins`,
    );

    // Invalidate groom list caches so new groom appears on next fetch
    invalidateCachePattern('grooms:*').catch(() => {
      /* non-critical */
    });

    res.status(201).json({
      success: true,
      message: `Successfully hired ${result.groom.name}`,
      data: {
        // Flatten groom data to match test expectations
        ...result.groom,
        // Include additional hiring information as separate fields
        hiringCost: result.hiringCost,
        remainingFunds: user.money - result.hiringCost,
      },
    });
  } catch (error) {
    logger.error(`[groomController.hireGroom] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to hire groom',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
  return null;
}

/**
 * GET /api/grooms/definitions
 * Get groom system definitions (specialties, skill levels, personalities)
 */
export async function getGroomDefinitions(_req, res) {
  try {
    logger.info('[groomController.getGroomDefinitions] Getting groom system definitions');

    res.status(200).json({
      success: true,
      message: 'Retrieved groom system definitions',
      data: {
        specialties: GROOM_SPECIALTIES,
        skillLevels: SKILL_LEVELS,
        personalities: PERSONALITY_TRAITS,
        defaultGrooms: DEFAULT_GROOMS,
      },
    });
  } catch (error) {
    logger.error(`[groomController.getGroomDefinitions] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve definitions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * Get groom profile including personality information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getGroomProfile(req, res) {
  try {
    const { id } = req.params;
    const groomId = parseInt(id, 10);

    if (isNaN(groomId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groom ID',
      });
    }

    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      include: {
        groomMetrics: true,
        groomAssignments: {
          where: { isActive: true },
          include: {
            foal: {
              select: {
                id: true,
                name: true,
                temperament: true,
                bondScore: true,
              },
            },
          },
        },
      },
    });

    if (!groom) {
      return res.status(404).json({
        success: false,
        message: 'Groom not found',
      });
    }

    // Calculate personality compatibility with current assignments
    const { calculatePersonalityCompatibility } =
      await import('../../../utils/groomPersonalityTraitBonus.mjs');
    const personalityCompatibility = groom.groomAssignments
      .map(assignment => {
        if (assignment.foal.temperament) {
          const compatibility = calculatePersonalityCompatibility(
            groom.personality,
            assignment.foal.temperament,
            assignment.foal.bondScore || 50,
          );

          return {
            foalId: assignment.foal.id,
            foalName: assignment.foal.name,
            foalTemperament: assignment.foal.temperament,
            compatibility,
          };
        }
        return null;
      })
      .filter(Boolean);

    const profile = {
      id: groom.id,
      name: groom.name,
      speciality: groom.speciality,
      experience: groom.experience,
      skillLevel: groom.skillLevel,
      personality: groom.personality,
      epigeneticInfluenceType: groom.epigeneticInfluenceType,
      sessionRate: groom.sessionRate,
      bio: groom.bio,
      imageUrl: groom.imageUrl,
      isActive: groom.isActive,
      hiredDate: groom.hiredDate,
      availability: groom.availability,
      metrics: groom.groomMetrics,
      currentAssignments: groom.groomAssignments.length,
      personalityCompatibility,
    };

    logger.info(`[groomController.getGroomProfile] Retrieved profile for groom ${groomId}`);

    res.json({
      success: true,
      groom: profile,
    });
  } catch (error) {
    logger.error(`[groomController.getGroomProfile] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve groom profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * GET /api/grooms/:id/bonus-traits
 * Get groom bonus traits
 */
export async function getGroomBonusTraits(req, res) {
  try {
    const { id } = req.params;
    const groomId = parseInt(id, 10);

    if (isNaN(groomId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groom ID',
      });
    }

    logger.info(`[groomController.getGroomBonusTraits] Getting bonus traits for groom ${groomId}`);

    const { getBonusTraits } = await import('../../../services/groomBonusTraitService.mjs');
    const bonusTraits = await getBonusTraits(groomId);

    res.json({
      success: true,
      message: 'Bonus traits retrieved successfully',
      data: {
        groomId,
        bonusTraits,
        hasBonusTraits: Object.keys(bonusTraits).length > 0,
        bonusTraitCount: Object.keys(bonusTraits).length,
      },
    });
  } catch (error) {
    logger.error(`[groomController.getGroomBonusTraits] Error: ${error.message}`);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bonus traits',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * PUT /api/grooms/:id/bonus-traits
 * Update groom bonus traits
 */
export async function updateGroomBonusTraits(req, res) {
  try {
    const { id } = req.params;
    const { bonusTraits } = req.body;
    const groomId = parseInt(id, 10);

    if (isNaN(groomId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groom ID',
      });
    }

    logger.info(
      `[groomController.updateGroomBonusTraits] Updating bonus traits for groom ${groomId}`,
    );

    const { assignBonusTraits } = await import('../../../services/groomBonusTraitService.mjs');
    const result = await assignBonusTraits(groomId, bonusTraits);

    res.json({
      success: true,
      message: 'Bonus traits updated successfully',
      data: {
        groomId: result.groomId,
        groomName: result.groomName,
        bonusTraits: result.bonusTraits,
        bonusTraitCount: Object.keys(result.bonusTraits).length,
      },
    });
  } catch (error) {
    logger.error(`[groomController.updateGroomBonusTraits] Error: ${error.message}`);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('constraints violated')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update bonus traits',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}
