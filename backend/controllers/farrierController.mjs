/**
 * Farrier Controller
 * Handles farrier services: listing services and booking appointments.
 *
 * Uses new Horse fields: lastFarrierDate, hoofCondition, lastShod.
 *
 * Routes:
 *   GET  /api/farrier/services    → list available farrier services
 *   POST /api/farrier/book-service → book a service for a horse
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

// Predefined service catalog
export const FARRIER_SERVICES = [
  {
    id: 'hoof-trim',
    name: 'Hoof Trim',
    description:
      'Regular trimming and balancing of hooves to maintain proper hoof shape and angle.',
    duration: '30 minutes',
    cost: 80,
    hoofConditionOutcome: 'good',
    includesShoing: false,
  },
  {
    id: 'shoeing',
    name: 'Standard Shoeing',
    description: 'Application of metal shoes to protect hooves during competition and training.',
    duration: '60 minutes',
    cost: 180,
    hoofConditionOutcome: 'good',
    includesShoing: true,
  },
  {
    id: 'corrective',
    name: 'Corrective Shoeing',
    description:
      'Specialised shoeing to address conformational issues, lameness, or rehabilitation needs.',
    duration: '90 minutes',
    cost: 320,
    hoofConditionOutcome: 'excellent',
    includesShoing: true,
  },
  {
    id: 'emergency',
    name: 'Emergency Care',
    description: 'Urgent farrier visit for cracked hooves, lost shoes, or acute hoof issues.',
    duration: '45 minutes',
    cost: 250,
    hoofConditionOutcome: 'fair',
    includesShoing: false,
  },
];

/**
 * GET /api/farrier/services
 */
export async function getFarrierServices(_req, res) {
  res.status(200).json({
    success: true,
    message: 'Farrier services retrieved successfully',
    data: FARRIER_SERVICES,
  });
}

/**
 * POST /api/farrier/book-service
 * Body: { horseId, serviceId }
 */
export async function bookFarrierService(req, res) {
  try {
    const userId = req.user.id;
    const { horseId, serviceId } = req.body;

    const service = FARRIER_SERVICES.find(s => s.id === serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found', data: null });
    }

    const horse = await prisma.horse.findFirst({ where: { id: horseId, userId } });
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found', data: null });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    if (user.money < service.cost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. ${service.name} costs $${service.cost}`,
        data: { required: service.cost, available: user.money },
      });
    }

    const now = new Date();
    const updateData = {
      lastFarrierDate: now,
      hoofCondition: service.hoofConditionOutcome,
    };
    if (service.includesShoing) {
      updateData.lastShod = now;
    }

    const [updatedHorse] = await prisma.$transaction([
      prisma.horse.update({ where: { id: horseId }, data: updateData }),
      prisma.user.update({ where: { id: userId }, data: { money: { decrement: service.cost } } }),
    ]);

    logger.info(
      `[farrierController] User ${userId} booked "${service.name}" for horse ${horseId} — cost $${service.cost}`,
    );

    res.status(200).json({
      success: true,
      message: `${service.name} booked successfully`,
      data: {
        horse: {
          id: updatedHorse.id,
          name: updatedHorse.name,
          hoofCondition: updatedHorse.hoofCondition,
          lastFarrierDate: updatedHorse.lastFarrierDate,
          lastShod: updatedHorse.lastShod,
        },
        service,
        cost: service.cost,
        remainingMoney: user.money - service.cost,
      },
    });
  } catch (error) {
    logger.error(`[farrierController] bookService error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to book farrier service', data: null });
  }
}
