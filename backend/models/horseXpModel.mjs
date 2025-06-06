/**
 * Horse XP Model
 *
 * Manages horse-specific experience points and stat allocation system.
 * Separate from user XP system - horses earn their own XP from competitions and training.
 *
 * Business Rules:
 * - Every 100 Horse XP allows +1 stat point allocation to any horse stat
 * - Horses earn XP from competition participation (separate from user XP)
 * - Stat points can be allocated to any of the 10 core horse stats
 * - All XP events are logged for auditing and analytics
 *
 * Integration Points:
 * - Competition system awards horse XP based on performance
 * - Training system can award horse XP for skill development
 * - API endpoints for viewing and managing horse XP
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import { DatabaseError } from '../errors/index.mjs';

// Horse XP System Constants
const XP_PER_STAT_POINT = 100;

// Valid horse stats that can receive stat point allocations
const VALID_HORSE_STATS = [
  'speed',
  'stamina',
  'agility',
  'balance',
  'precision',
  'intelligence',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
];

/**
 * Calculate available stat points based on horse XP
 * @param {number} horseXp - Current horse XP
 * @returns {number} Total available stat points
 */
function calculateAvailableStatPoints(horseXp) {
  const earnedStatPoints = Math.floor(horseXp / XP_PER_STAT_POINT);
  return earnedStatPoints;
}

/**
 * Add XP to a horse and update available stat points
 * @param {number} horseId - Horse ID
 * @param {number} amount - Amount of XP to add
 * @param {string} reason - Reason for XP gain
 * @returns {Promise<Object>} Result object with success status and updated values
 */
export async function addXpToHorse(horseId, amount, reason) {
  try {
    // Validation
    if (!horseId) {
      throw new Error('Horse ID is required.');
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('XP amount must be a positive number.');
    }
    if (!reason || typeof reason !== 'string') {
      throw new Error('Reason is required and must be a string.');
    }

    // Get current horse data
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        name: true,
        horseXp: true,
        availableStatPoints: true,
      },
    });

    if (!horse) {
      throw new Error('Horse not found.');
    }

    // Calculate new XP and stat points
    const currentXp = horse.horseXp || 0;
    const currentStatPoints = horse.availableStatPoints || 0;
    const newXp = currentXp + amount;

    // Calculate total stat points that should be available based on new XP
    const newTotalStatPoints = calculateAvailableStatPoints(newXp);
    const previousTotalStatPoints = calculateAvailableStatPoints(currentXp);
    const statPointsGained = newTotalStatPoints - previousTotalStatPoints;

    // New available stat points = current unspent + newly gained
    const newAvailableStatPoints = currentStatPoints + statPointsGained;

    // Update horse in database
    await prisma.horse.update({
      where: { id: horseId },
      data: {
        horseXp: newXp,
        availableStatPoints: newAvailableStatPoints,
      },
    });

    // Log XP event
    await prisma.horseXpEvent.create({
      data: {
        horseId,
        amount,
        reason,
      },
    });

    logger.info(
      `[horseXpModel.addXpToHorse] Added ${amount} XP to horse ${horse.name} (ID: ${horseId}). ` +
        `New XP: ${newXp}, Stat points gained: ${statPointsGained}, Available: ${newAvailableStatPoints}`,
    );

    return {
      success: true,
      currentXP: newXp,
      availableStatPoints: newAvailableStatPoints,
      xpGained: amount,
      statPointsGained,
    };
  } catch (error) {
    logger.error(`[horseXpModel.addXpToHorse] Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      currentXP: null,
      availableStatPoints: null,
      xpGained: 0,
      statPointsGained: 0,
    };
  }
}

/**
 * Validate if a stat name is valid for allocation
 * @param {string} statName - Name of the stat to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function validateStatName(statName) {
  return VALID_HORSE_STATS.includes(statName);
}

/**
 * Allocate a stat point to a specific horse stat
 * @param {number} horseId - Horse ID
 * @param {string} statName - Name of the stat to increase
 * @returns {Promise<Object>} Result object with success status and updated values
 */
export async function allocateStatPoint(horseId, statName) {
  try {
    // Validation
    if (!horseId) {
      throw new Error('Horse ID is required.');
    }
    if (!validateStatName(statName)) {
      throw new Error(
        `Invalid stat name: ${statName}. Valid stats: ${VALID_HORSE_STATS.join(', ')}`,
      );
    }

    // Get current horse data
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        name: true,
        availableStatPoints: true,
        [statName]: true,
      },
    });

    if (!horse) {
      throw new Error('Horse not found.');
    }

    const availablePoints = horse.availableStatPoints || 0;
    if (availablePoints <= 0) {
      throw new Error('No stat points available for allocation.');
    }

    // Update horse stats
    const updateData = {
      [statName]: { increment: 1 },
      availableStatPoints: { decrement: 1 },
    };

    const updatedHorse = await prisma.horse.update({
      where: { id: horseId },
      data: updateData,
      select: {
        [statName]: true,
        availableStatPoints: true,
      },
    });

    logger.info(
      `[horseXpModel.allocateStatPoint] Allocated 1 stat point to ${statName} for horse ${horse.name} (ID: ${horseId}). ` +
        `New ${statName}: ${updatedHorse[statName]}, Remaining points: ${updatedHorse.availableStatPoints}`,
    );

    return {
      success: true,
      statName,
      newStatValue: updatedHorse[statName],
      remainingStatPoints: updatedHorse.availableStatPoints,
    };
  } catch (error) {
    logger.error(`[horseXpModel.allocateStatPoint] Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      statName: null,
      newStatValue: null,
      remainingStatPoints: null,
    };
  }
}

/**
 * Get horse XP event history
 * @param {number} horseId - Horse ID
 * @param {Object} options - Query options (limit, offset, startDate, endDate)
 * @returns {Promise<Object>} Result object with XP events
 */
export async function getHorseXpHistory(horseId, options = {}) {
  try {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    if (!horseId) {
      throw new Error('Horse ID is required.');
    }

    // Build where clause
    const where = { horseId };
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const events = await prisma.horseXpEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });

    logger.info(
      `[horseXpModel.getHorseXpHistory] Retrieved ${events.length} XP events for horse ${horseId}`,
    );

    return {
      success: true,
      events,
      count: events.length,
    };
  } catch (error) {
    logger.error(`[horseXpModel.getHorseXpHistory] Error: ${error.message}`);
    throw new DatabaseError(`Failed to get horse XP history: ${error.message}`);
  }
}

/**
 * Award horse XP based on competition performance
 * @param {number} horseId - Horse ID
 * @param {string} placement - Competition placement (1st, 2nd, 3rd, etc.)
 * @param {string} discipline - Competition discipline
 * @returns {Promise<Object>} Result object with XP awarded
 */
export async function awardCompetitionXp(horseId, placement, discipline) {
  try {
    // Calculate XP based on placement
    const baseXp = 20; // Base XP for participation
    let placementBonus = 0;

    switch (placement) {
      case '1st':
        placementBonus = 10;
        break;
      case '2nd':
        placementBonus = 7;
        break;
      case '3rd':
        placementBonus = 5;
        break;
      default:
        placementBonus = 0;
    }

    const totalXp = baseXp + placementBonus;
    const reason = `Competition: ${placement} place in ${discipline}`;

    const result = await addXpToHorse(horseId, totalXp, reason);

    return {
      success: result.success,
      xpAwarded: totalXp,
      currentXP: result.currentXP,
      statPointsGained: result.statPointsGained,
      error: result.error,
    };
  } catch (error) {
    logger.error(`[horseXpModel.awardCompetitionXp] Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      xpAwarded: 0,
    };
  }
}
