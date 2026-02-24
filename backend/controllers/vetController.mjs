/**
 * Vet Controller
 * Handles veterinary services: listing services and booking appointments.
 *
 * Uses existing Horse fields: healthStatus, lastVettedDate.
 * No schema changes required (Phase 1).
 *
 * Routes:
 *   GET  /api/vet/services            → list available vet services
 *   POST /api/vet/book-appointment    → book an appointment (deducts balance, updates horse)
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

// Predefined service catalog
export const VET_SERVICES = [
  {
    id: 'health-check',
    name: 'General Health Check',
    description:
      'Comprehensive physical examination including vital signs, weight, and overall condition assessment.',
    duration: '45 minutes',
    cost: 150,
    healthOutcome: 'Good',
  },
  {
    id: 'treatment',
    name: 'Medical Treatment',
    description:
      'Targeted treatment for injuries, illness, or ailments identified during examination.',
    duration: '60 minutes',
    cost: 350,
    healthOutcome: 'Excellent',
  },
  {
    id: 'dental',
    name: 'Dental Care',
    description: 'Teeth floating, dental examination, and oral health assessment.',
    duration: '30 minutes',
    cost: 200,
    healthOutcome: null, // Does not change healthStatus
  },
  {
    id: 'vaccination',
    name: 'Vaccination Package',
    description:
      'Annual vaccination schedule including flu, tetanus, and other essential immunisations.',
    duration: '20 minutes',
    cost: 120,
    healthOutcome: null,
  },
];

/**
 * GET /api/vet/services
 */
export async function getVetServices(_req, res) {
  res.status(200).json({
    success: true,
    message: 'Vet services retrieved successfully',
    data: VET_SERVICES,
  });
}

/**
 * POST /api/vet/book-appointment
 * Body: { horseId, serviceId }
 */
export async function bookVetAppointment(req, res) {
  try {
    const userId = req.user.id;
    const { horseId, serviceId } = req.body;

    const service = VET_SERVICES.find(s => s.id === serviceId);
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

    // Update horse and deduct funds in a transaction
    const updateData = { lastVettedDate: new Date() };
    if (service.healthOutcome) {
      updateData.healthStatus = service.healthOutcome;
    }

    const [updatedHorse] = await prisma.$transaction([
      prisma.horse.update({ where: { id: horseId }, data: updateData }),
      prisma.user.update({ where: { id: userId }, data: { money: { decrement: service.cost } } }),
    ]);

    logger.info(
      `[vetController] User ${userId} booked "${service.name}" for horse ${horseId} — cost $${service.cost}`,
    );

    res.status(200).json({
      success: true,
      message: `${service.name} booked successfully`,
      data: {
        horse: {
          id: updatedHorse.id,
          name: updatedHorse.name,
          healthStatus: updatedHorse.healthStatus,
          lastVettedDate: updatedHorse.lastVettedDate,
        },
        service,
        cost: service.cost,
        remainingMoney: user.money - service.cost,
      },
    });
  } catch (error) {
    logger.error(`[vetController] bookAppointment error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to book vet appointment', data: null });
  }
}
