/**
 * Groom Handler Controller
 * Manages groom assignments as competition handlers
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import {
  getAssignedHandler,
  validateHandlerEligibility,
  calculateHandlerBonus,
  HANDLER_SKILL_BONUSES,
  PERSONALITY_DISCIPLINE_SYNERGY,
  SPECIALTY_DISCIPLINE_BONUSES,
} from '../services/groomHandlerService.mjs';
import { isValidConformationClass } from '../services/conformationShowService.mjs';

/**
 * GET /api/groom-handlers/horse/:horseId
 * Get the assigned handler for a horse
 */
export async function getHorseHandler(req, res) {
  try {
    const { horseId } = req.params;
    const userId = req.user?.id;

    logger.info(`[groomHandlerController] Getting handler for horse ${horseId}`);

    // Validate horse ID
    const parsedHorseId = parseInt(horseId);
    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID',
        data: null,
      });
    }

    // Check horse ownership
    const horse = await prisma.horse.findUnique({
      where: { id: parsedHorseId },
      select: { id: true, name: true, userId: true },
    });

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    if (horse.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this horse',
        data: null,
      });
    }

    // Get assigned handler
    const handlerData = await getAssignedHandler(parsedHorseId, userId);

    res.status(200).json({
      success: true,
      message: handlerData.hasHandler
        ? `Handler ${handlerData.groom.name} is assigned to ${horse.name}`
        : `No handler assigned to ${horse.name}`,
      data: {
        hasHandler: handlerData.hasHandler,
        horse: {
          id: horse.id,
          name: horse.name,
        },
        handler: handlerData.hasHandler
          ? {
              id: handlerData.groom.id,
              name: handlerData.groom.name,
              skillLevel: handlerData.groom.skillLevel,
              speciality: handlerData.groom.speciality,
              personality: handlerData.groom.personality,
              experience: handlerData.groom.experience,
            }
          : 'none',
        assignment: handlerData.hasHandler
          ? {
              id: handlerData.assignment.id,
              priority: handlerData.assignment.priority,
              createdAt: handlerData.assignment.createdAt,
            }
          : 'none',
      },
    });
  } catch (error) {
    logger.error(`[groomHandlerController] Error getting horse handler: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null,
    });
  }
}

/**
 * GET /api/groom-handlers/eligibility/:horseId/:className
 * Check handler eligibility for a specific conformation class
 */
export async function checkHandlerEligibility(req, res) {
  try {
    const { horseId, className } = req.params;
    const userId = req.user?.id;

    logger.info(
      `[groomHandlerController] Checking handler eligibility for horse ${horseId} in conformation class ${className}`,
    );

    // Validate horse ID
    const parsedHorseId = parseInt(horseId);
    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID',
        data: null,
      });
    }

    // Check horse ownership
    const horse = await prisma.horse.findUnique({
      where: { id: parsedHorseId },
      select: {
        id: true,
        name: true,
        userId: true,
        bondScore: true,
        stressLevel: true,
      },
    });

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    if (horse.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this horse',
        data: null,
      });
    }

    // Validate conformation class
    if (!isValidConformationClass(className)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conformation class',
        data: null,
      });
    }

    // Check handler eligibility
    const eligibility = await validateHandlerEligibility(parsedHorseId, userId, className);

    res.status(200).json({
      success: true,
      message: eligibility.reason,
      data: {
        horse: {
          id: horse.id,
          name: horse.name,
          bondScore: horse.bondScore,
        },
        className,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        recommendation: eligibility.recommendation,
        handlerBonus: eligibility.handlerBonus,
        bonusBreakdown: eligibility.bonusBreakdown,
        handler: eligibility.groom
          ? {
              id: eligibility.groom.id,
              name: eligibility.groom.name,
              skillLevel: eligibility.groom.skillLevel,
              speciality: eligibility.groom.speciality,
              personality: eligibility.groom.personality,
              experience: eligibility.groom.experience,
            }
          : null,
        isConformationShow: true,
      },
    });
  } catch (error) {
    logger.error(`[groomHandlerController] Error checking handler eligibility: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null,
    });
  }
}

/**
 * GET /api/groom-handlers/config
 * Get handler configuration and bonuses
 */
export async function getHandlerConfig(req, res) {
  try {
    logger.info('[groomHandlerController] Getting handler configuration');

    res.status(200).json({
      success: true,
      message: 'Handler configuration retrieved successfully',
      data: {
        skillBonuses: HANDLER_SKILL_BONUSES,
        personalitySynergy: PERSONALITY_DISCIPLINE_SYNERGY,
        specialtyBonuses: SPECIALTY_DISCIPLINE_BONUSES,
        description: {
          skillBonuses: 'Base and maximum bonuses by skill level',
          personalitySynergy: 'Bonus for personality-discipline matches',
          specialtyBonuses: 'Bonus for specialty-discipline matches',
        },
      },
    });
  } catch (error) {
    logger.error(`[groomHandlerController] Error getting handler config: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null,
    });
  }
}

/**
 * GET /api/groom-handlers/recommendations/:horseId
 * Get handler recommendations for a horse
 */
export async function getHandlerRecommendations(req, res) {
  try {
    const { horseId } = req.params;
    const { className } = req.query;
    const userId = req.user?.id;

    logger.info(`[groomHandlerController] Getting handler recommendations for horse ${horseId}`);

    // Validate horse ID
    const parsedHorseId = parseInt(horseId);
    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID',
        data: null,
      });
    }

    // Check horse ownership
    const horse = await prisma.horse.findUnique({
      where: { id: parsedHorseId },
      select: {
        id: true,
        name: true,
        userId: true,
        bondScore: true,
        stressLevel: true,
      },
    });

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    if (horse.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this horse',
        data: null,
      });
    }

    // Get all user's grooms
    const grooms = await prisma.groom.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        skillLevel: true,
        speciality: true,
        personality: true,
        experience: true,
      },
    });

    // Calculate potential bonuses for each groom
    const recommendations = [];
    for (const groom of grooms) {
      const bonus = calculateHandlerBonus(groom, horse, className || 'Mares', { isActive: true });
      recommendations.push({
        groom,
        bonus: bonus.handlerBonus,
        bonusBreakdown: bonus.bonusBreakdown,
        isCurrentHandler: false, // Will be updated below
      });
    }

    // Sort by bonus (highest first)
    recommendations.sort((a, b) => b.bonus - a.bonus);

    // Check if any is the current handler
    const currentHandler = await getAssignedHandler(parsedHorseId, userId);
    if (currentHandler.hasHandler) {
      const currentHandlerIndex = recommendations.findIndex(
        r => r.groom.id === currentHandler.groom.id,
      );
      if (currentHandlerIndex >= 0) {
        recommendations[currentHandlerIndex].isCurrentHandler = true;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Handler recommendations retrieved successfully',
      data: {
        horse: {
          id: horse.id,
          name: horse.name,
          bondScore: horse.bondScore,
        },
        className: className || 'General',
        recommendations,
        currentHandler: currentHandler.hasHandler
          ? {
              id: currentHandler.groom.id,
              name: currentHandler.groom.name,
            }
          : null,
      },
    });
  } catch (error) {
    logger.error(
      `[groomHandlerController] Error getting handler recommendations: ${error.message}`,
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null,
    });
  }
}
