/**
 * Horse XP Controller
 *
 * Handles HTTP requests for horse experience point management and stat allocation.
 * Provides RESTful API endpoints for the Horse XP system.
 *
 * Endpoints:
 * - GET /api/horses/:horseId/xp - Get horse XP status
 * - POST /api/horses/:horseId/allocate-stat - Allocate stat point
 * - GET /api/horses/:horseId/xp-history - Get horse XP history
 * - POST /api/horses/:horseId/award-xp - Award XP (admin/system use)
 *
 * Security:
 * - All endpoints require authentication
 * - Users can only access their own horses
 * - Input validation on all parameters
 * - Rate limiting and error handling
 */

import * as horseXpModel from '../models/horseXpModel.mjs';
import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import { ValidationError, AuthorizationError, NotFoundError } from '../errors/index.mjs';

/**
 * Get horse XP status
 * GET /api/horses/:horseId/xp
 */
export async function getHorseXpStatus(req, res) {
  try {
    const { horseId } = req.params;
    const userId = req.user.id;

    // Validate horse ID
    const horseIdNum = parseInt(horseId);
    if (isNaN(horseIdNum)) {
      throw new ValidationError('Invalid horse ID');
    }

    // Get horse and verify ownership
    const horse = await prisma.horse.findUnique({
      where: { id: horseIdNum },
      select: {
        id: true,
        name: true,
        userId: true,
        horseXp: true,
        availableStatPoints: true,
      },
    });

    if (!horse) {
      throw new NotFoundError('Horse');
    }

    if (horse.userId !== userId) {
      throw new AuthorizationError('You are not authorized to view this horse');
    }

    // Calculate XP progression info
    const currentXP = horse.horseXp || 0;
    const availableStatPoints = horse.availableStatPoints || 0;
    const nextStatPointAt = (Math.floor(currentXP / 100) + 1) * 100;
    const xpToNextStatPoint = nextStatPointAt - currentXP;

    logger.info(
      `[horseXpController.getHorseXpStatus] Retrieved XP status for horse ${horse.name} (ID: ${horseId})`,
    );

    res.json({
      success: true,
      data: {
        horseId: horse.id,
        horseName: horse.name,
        currentXP,
        availableStatPoints,
        nextStatPointAt,
        xpToNextStatPoint,
      },
    });
  } catch (error) {
    logger.error(`[horseXpController.getHorseXpStatus] Error: ${error.message}`);

    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error instanceof AuthorizationError) {
      return res.status(403).json({ success: false, error: error.message });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error while retrieving horse XP status',
    });
  }
}

/**
 * Allocate stat point to horse
 * POST /api/horses/:horseId/allocate-stat
 */
export async function allocateStatPoint(req, res) {
  try {
    const { horseId } = req.params;
    const { statName } = req.body;
    const userId = req.user.id;

    // Validate inputs
    const horseIdNum = parseInt(horseId);
    if (isNaN(horseIdNum)) {
      throw new ValidationError('Invalid horse ID');
    }

    if (!statName) {
      throw new ValidationError('statName is required');
    }

    // Validate stat name first
    if (!horseXpModel.validateStatName(statName)) {
      throw new ValidationError(
        `Invalid stat name: ${statName}. Valid stats: speed, stamina, agility, balance, precision, intelligence, boldness, flexibility, obedience, focus`,
      );
    }

    // Verify horse ownership
    const horse = await prisma.horse.findUnique({
      where: { id: horseIdNum },
      select: {
        id: true,
        name: true,
        userId: true,
        availableStatPoints: true,
        [statName]: true,
      },
    });

    if (!horse) {
      throw new NotFoundError('Horse');
    }

    if (horse.userId !== userId) {
      throw new AuthorizationError('You are not authorized to modify this horse');
    }

    // Allocate stat point using model
    const result = await horseXpModel.allocateStatPoint(horseIdNum, statName);

    if (!result.success) {
      throw new ValidationError(result.error);
    }

    logger.info(
      `[horseXpController.allocateStatPoint] Allocated stat point to ${statName} for horse ${horse.name} (ID: ${horseId})`,
    );

    res.json({
      success: true,
      data: {
        statName: result.statName,
        newStatValue: result.newStatValue,
        remainingStatPoints: result.remainingStatPoints,
      },
    });
  } catch (error) {
    logger.error(`[horseXpController.allocateStatPoint] Error: ${error.message}`);

    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error instanceof AuthorizationError) {
      return res.status(403).json({ success: false, error: error.message });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error while allocating stat point',
    });
  }
}

/**
 * Get horse XP history
 * GET /api/horses/:horseId/xp-history
 */
export async function getHorseXpHistory(req, res) {
  try {
    const { horseId } = req.params;
    const userId = req.user.id;

    // Parse query parameters
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 per request
    const offset = parseInt(req.query.offset) || 0;

    // Validate horse ID
    const horseIdNum = parseInt(horseId);
    if (isNaN(horseIdNum)) {
      throw new ValidationError('Invalid horse ID');
    }

    // Verify horse ownership
    const horse = await prisma.horse.findUnique({
      where: { id: horseIdNum },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!horse) {
      throw new NotFoundError('Horse');
    }

    if (horse.userId !== userId) {
      throw new AuthorizationError('You are not authorized to view this horse');
    }

    // Get XP history using model
    const result = await horseXpModel.getHorseXpHistory(horseIdNum, { limit, offset });

    if (!result.success) {
      throw new Error(result.error);
    }

    logger.info(
      `[horseXpController.getHorseXpHistory] Retrieved ${result.events.length} XP events for horse ${horseId}`,
    );

    res.json({
      success: true,
      data: {
        events: result.events,
        count: result.count,
        pagination: {
          limit,
          offset,
          hasMore: result.events.length === limit,
        },
      },
    });
  } catch (error) {
    logger.error(`[horseXpController.getHorseXpHistory] Error: ${error.message}`);

    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error instanceof AuthorizationError) {
      return res.status(403).json({ success: false, error: error.message });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error while retrieving horse XP history',
    });
  }
}

/**
 * Award XP to horse (admin/system use)
 * POST /api/horses/:horseId/award-xp
 */
export async function awardXpToHorse(req, res) {
  try {
    const { horseId } = req.params;
    const { amount, reason } = req.body;
    const userId = req.user.id;

    // Validate inputs
    const horseIdNum = parseInt(horseId);
    if (isNaN(horseIdNum)) {
      throw new ValidationError('Invalid horse ID');
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new ValidationError('XP amount must be a positive number');
    }

    if (!reason || typeof reason !== 'string') {
      throw new ValidationError('Reason is required');
    }

    // Verify horse ownership
    const horse = await prisma.horse.findUnique({
      where: { id: horseIdNum },
      select: {
        id: true,
        name: true,
        userId: true,
      },
    });

    if (!horse) {
      throw new NotFoundError('Horse');
    }

    if (horse.userId !== userId) {
      throw new AuthorizationError('You are not authorized to modify this horse');
    }

    // Award XP using model
    const result = await horseXpModel.addXpToHorse(horseIdNum, amount, reason);

    if (!result.success) {
      throw new Error(result.error);
    }

    logger.info(
      `[horseXpController.awardXpToHorse] Awarded ${amount} XP to horse ${horse.name} (ID: ${horseId})`,
    );

    res.json({
      success: true,
      data: {
        currentXP: result.currentXP,
        availableStatPoints: result.availableStatPoints,
        xpGained: result.xpGained,
        statPointsGained: result.statPointsGained,
      },
    });
  } catch (error) {
    logger.error(`[horseXpController.awardXpToHorse] Error: ${error.message}`);

    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error instanceof AuthorizationError) {
      return res.status(403).json({ success: false, error: error.message });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error while awarding horse XP',
    });
  }
}
