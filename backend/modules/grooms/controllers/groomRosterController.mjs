/**
 * Groom Roster Handlers
 *
 * Equoria-8kuhf: extracted from groomController.mjs (god-file split to satisfy
 * the 800-line max-lines cap). Behavior, signatures, response shapes, and
 * route wiring are unchanged — groomController.mjs re-exports these so the
 * public import surface is identical.
 *
 * Handlers: getUserGrooms, hireGroom, getGroomProfile, getGroomDefinitions.
 */

// Maximum number of grooms a user can hire
const MAX_GROOMS_PER_USER = 10;

// Base hiring cost for grooms (modified by skill level)
const BASE_HIRING_COST = 500;

import {
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
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { invalidateCachePattern } from '../../../utils/cacheHelper.mjs';
import { parsePaginationParams } from '../../../utils/paginationHelper.mjs';

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
    const result = await withRetryableTxMapping(
      prisma.$transaction(async prismaTx => {
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
      }),
      { message: 'The server is busy right now, please retry in a moment.' },
    );

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
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message });
    }
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
