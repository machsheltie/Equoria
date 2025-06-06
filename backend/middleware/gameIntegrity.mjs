import logger from '../utils/logger.mjs';
import { ApiResponse } from '../utils/apiResponse.mjs';
import prisma from '../db/index.mjs';

/**
 * Game Integrity Middleware
 * Prevents common horse game exploits and cheats
 */

/**
 * Validates horse stat modifications to prevent stat hacking
 */
export const validateStatChanges = (allowedFields = []) => {
  return (req, res, next) => {
    const { body } = req;

    // Define stat fields that should never be directly modified by users
    const protectedStats = [
      'precision',
      'strength',
      'speed',
      'agility',
      'endurance',
      'intelligence',
      'personality',
      'total_earnings',
      'level',
    ];

    // Check for unauthorized stat modifications
    const unauthorizedChanges = Object.keys(body).filter(
      field => protectedStats.includes(field) && !allowedFields.includes(field),
    );

    if (unauthorizedChanges.length > 0) {
      logger.warn(
        `[integrity] Unauthorized stat modification attempt by user ${req.user?.id}: ${unauthorizedChanges.join(', ')}`,
      );
      return res.status(403).json(ApiResponse.forbidden('Direct stat modification not allowed'));
    }

    // Validate stat ranges if stats are being modified legitimately
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const value = parseInt(body[field]);
        if (isNaN(value) || value < 0 || value > 100) {
          return res.status(400).json(ApiResponse.badRequest(`${field} must be between 0 and 100`));
        }
      }
    }

    next();
  };
};

/**
 * Prevents resource duplication exploits
 */
export const preventDuplication = resourceType => {
  const recentOperations = new Map();

  return async (req, res, next) => {
    const userId = req.user?.id;
    const operationKey = `${userId}_${resourceType}_${req.method}_${JSON.stringify(req.body)}`;
    const now = Date.now();

    // Check for duplicate operations within 5 seconds
    const lastOperation = recentOperations.get(operationKey);
    if (lastOperation && now - lastOperation < 5000) {
      logger.warn(
        `[integrity] Potential duplication exploit detected for user ${userId} on ${resourceType}`,
      );
      return res
        .status(429)
        .json(ApiResponse.error('Operation too recent. Please wait before trying again.'));
    }

    // Store operation timestamp
    recentOperations.set(operationKey, now);

    // Clean old entries (older than 1 minute)
    for (const [key, timestamp] of recentOperations.entries()) {
      if (now - timestamp > 60000) {
        recentOperations.delete(key);
      }
    }

    next();
  };
};

/**
 * Validates breeding operations to prevent exploit breeding
 */
export const validateBreeding = async (req, res, next) => {
  try {
    const { sireId, damId } = req.body;
    const userId = req.user?.id;

    if (!sireId || !damId) {
      return res.status(400).json(ApiResponse.badRequest('Both sire and dam IDs required'));
    }

    // Fetch horses with ownership verification
    const [sire, dam] = await Promise.all([
      prisma.horse.findUnique({
        where: { id: parseInt(sireId) },
        select: {
          id: true,
          sex: true,
          age: true,
          playerId: true,
          ownerId: true,
          last_bred_date: true,
          stud_status: true,
          health_status: true,
        },
      }),
      prisma.horse.findUnique({
        where: { id: parseInt(damId) },
        select: {
          id: true,
          sex: true,
          age: true,
          playerId: true,
          ownerId: true,
          last_bred_date: true,
          health_status: true,
        },
      }),
    ]);

    if (!sire || !dam) {
      return res.status(404).json(ApiResponse.notFound('One or both horses not found'));
    }

    // Ownership validation
    const userOwnsOrHasAccess = horse => horse.playerId === userId || horse.ownerId === userId;

    if (!userOwnsOrHasAccess(sire) && sire.stud_status !== 'Public Stud') {
      logger.warn(
        `[integrity] Unauthorized breeding attempt: User ${userId} tried to use sire ${sireId}`,
      );
      return res.status(403).json(ApiResponse.forbidden('You do not have access to this sire'));
    }

    if (!userOwnsOrHasAccess(dam)) {
      logger.warn(
        `[integrity] Unauthorized breeding attempt: User ${userId} tried to use dam ${damId}`,
      );
      return res.status(403).json(ApiResponse.forbidden('You do not own this mare'));
    }

    // Biological validation
    if (sire.sex !== 'Stallion' && sire.sex !== 'Colt') {
      return res.status(400).json(ApiResponse.badRequest('Sire must be a stallion or colt'));
    }

    if (dam.sex !== 'Mare' && dam.sex !== 'Filly') {
      return res.status(400).json(ApiResponse.badRequest('Dam must be a mare or filly'));
    }

    // Age validation
    if (sire.age < 3 || dam.age < 3) {
      return res
        .status(400)
        .json(ApiResponse.badRequest('Both horses must be at least 3 years old'));
    }

    // Health validation
    if (sire.health_status === 'Injured' || dam.health_status === 'Injured') {
      return res.status(400).json(ApiResponse.badRequest('Injured horses cannot breed'));
    }

    // Breeding cooldown validation
    const now = new Date();
    const breedingCooldown = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

    if (sire.last_bred_date) {
      const timeSinceLastBreed = now - new Date(sire.last_bred_date);
      if (timeSinceLastBreed < breedingCooldown) {
        return res.status(400).json(ApiResponse.badRequest('Sire is still in breeding cooldown'));
      }
    }

    if (dam.last_bred_date) {
      const timeSinceLastBreed = now - new Date(dam.last_bred_date);
      if (timeSinceLastBreed < breedingCooldown) {
        return res.status(400).json(ApiResponse.badRequest('Dam is still in breeding cooldown'));
      }
    }

    // Add validated horses to request for use in controller
    req.validatedHorses = { sire, dam };
    next();
  } catch (error) {
    logger.error('[integrity] Breeding validation error:', error);
    return res.status(500).json(ApiResponse.serverError('Breeding validation failed'));
  }
};

/**
 * Validates training operations to prevent training exploits
 */
export const validateTraining = async (req, res, next) => {
  try {
    const { horseId, discipline } = req.body;
    const userId = req.user?.id;

    if (!horseId || !discipline) {
      return res.status(400).json(ApiResponse.badRequest('Horse ID and discipline required'));
    }

    // Fetch horse with ownership verification
    const horse = await prisma.horse.findUnique({
      where: { id: parseInt(horseId) },
      select: {
        id: true,
        age: true,
        playerId: true,
        ownerId: true,
        health_status: true,
        trainingCooldown: true,
      },
    });

    if (!horse) {
      return res.status(404).json(ApiResponse.notFound('Horse not found'));
    }

    // Ownership validation
    if (horse.playerId !== userId && horse.ownerId !== userId) {
      logger.warn(
        `[integrity] Unauthorized training attempt: User ${userId} tried to train horse ${horseId}`,
      );
      return res.status(403).json(ApiResponse.forbidden('You do not own this horse'));
    }

    // Age validation
    if (horse.age < 3) {
      return res
        .status(400)
        .json(ApiResponse.badRequest('Horse must be at least 3 years old to train'));
    }

    // Health validation
    if (horse.health_status === 'Injured') {
      return res.status(400).json(ApiResponse.badRequest('Injured horses cannot train'));
    }

    // Training cooldown validation
    if (horse.trainingCooldown) {
      const now = new Date();
      const cooldownEnd = new Date(horse.trainingCooldown);
      if (now < cooldownEnd) {
        const remainingTime = Math.ceil((cooldownEnd - now) / (1000 * 60 * 60)); // hours
        return res
          .status(400)
          .json(
            ApiResponse.badRequest(`Horse is in training cooldown for ${remainingTime} more hours`),
          );
      }
    }

    // Validate discipline
    const validDisciplines = ['Racing', 'Show Jumping', 'Dressage', 'Cross Country', 'Western'];
    if (!validDisciplines.includes(discipline)) {
      return res.status(400).json(ApiResponse.badRequest('Invalid discipline'));
    }

    next();
  } catch (error) {
    logger.error('[integrity] Training validation error:', error);
    return res.status(500).json(ApiResponse.serverError('Training validation failed'));
  }
};

/**
 * Validates financial transactions to prevent money exploits
 */
export const validateTransaction = transactionType => {
  return async (req, res, next) => {
    try {
      const { amount, targetUserId } = req.body;
      const userId = req.user?.id;

      if (!amount || amount <= 0) {
        return res.status(400).json(ApiResponse.badRequest('Invalid transaction amount'));
      }

      // Fetch user's current balance
      const user = await prisma.player.findUnique({
        where: { id: userId },
        select: { money: true },
      });

      if (!user) {
        return res.status(404).json(ApiResponse.notFound('User not found'));
      }

      // Validate sufficient funds for outgoing transactions
      if (['purchase', 'transfer', 'bet'].includes(transactionType)) {
        if (user.money < amount) {
          return res.status(400).json(ApiResponse.badRequest('Insufficient funds'));
        }

        // Additional validation for large transactions
        if (amount > 100000) {
          logger.warn(
            `[integrity] Large transaction attempt: User ${userId} trying to ${transactionType} ${amount}`,
          );
          return res.status(400).json(ApiResponse.badRequest('Transaction amount exceeds limit'));
        }
      }

      // Validate transfer target
      if (transactionType === 'transfer' && targetUserId) {
        if (targetUserId === userId) {
          return res.status(400).json(ApiResponse.badRequest('Cannot transfer to yourself'));
        }

        const targetUser = await prisma.player.findUnique({
          where: { id: targetUserId },
          select: { id: true },
        });

        if (!targetUser) {
          return res.status(404).json(ApiResponse.notFound('Target user not found'));
        }
      }

      next();
    } catch (error) {
      logger.error('[integrity] Transaction validation error:', error);
      return res.status(500).json(ApiResponse.serverError('Transaction validation failed'));
    }
  };
};

/**
 * Prevents time-based exploits by validating server-side timestamps
 */
export const validateTimestamp = (req, res, next) => {
  const clientTimestamp = req.body.timestamp || req.query.timestamp;

  if (clientTimestamp) {
    const serverTime = Date.now();
    const clientTime = new Date(clientTimestamp).getTime();
    const timeDiff = Math.abs(serverTime - clientTime);

    // Allow 5 minutes of clock drift
    if (timeDiff > 5 * 60 * 1000) {
      logger.warn(
        `[integrity] Timestamp manipulation detected: User ${req.user?.id}, diff: ${timeDiff}ms`,
      );
      return res.status(400).json(ApiResponse.badRequest('Invalid timestamp'));
    }
  }

  // Always use server timestamp for operations
  req.serverTimestamp = new Date();
  next();
};

export default {
  validateStatChanges,
  preventDuplication,
  validateBreeding,
  validateTraining,
  validateTransaction,
  validateTimestamp,
};
