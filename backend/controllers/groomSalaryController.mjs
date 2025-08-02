/**
 * Groom Salary Controller
 *
 * Handles API endpoints for groom salary management
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import {
  calculateUserSalaryCost,
  getSalaryPaymentHistory,
  calculateWeeklySalary,
} from '../services/groomSalaryService.mjs';
import { triggerSalaryProcessing, getCronJobStatus } from '../services/cronJobService.mjs';

/**
 * GET /api/groom-salaries/cost
 * Get current weekly salary cost for the authenticated user
 */
export async function getUserSalaryCost(req, res) {
  try {
    const userId = req.user?.id;

    logger.info(`[groomSalaryController] Getting salary cost for user ${userId}`);

    const salaryCost = await calculateUserSalaryCost(userId);

    res.json({
      success: true,
      message: 'Salary cost retrieved successfully',
      data: salaryCost,
    });

  } catch (error) {
    logger.error(`[groomSalaryController] Error getting salary cost: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get salary cost',
      data: null,
    });
  }
}

/**
 * GET /api/groom-salaries/history
 * Get salary payment history for the authenticated user
 */
export async function getSalaryHistory(req, res) {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit) || 50;

    logger.info(`[groomSalaryController] Getting salary history for user ${userId}, limit: ${limit}`);

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100',
        data: null,
      });
    }

    const paymentHistory = await getSalaryPaymentHistory(userId, limit);

    res.json({
      success: true,
      message: 'Salary history retrieved successfully',
      data: {
        payments: paymentHistory,
        count: paymentHistory.length,
      },
    });

  } catch (error) {
    logger.error(`[groomSalaryController] Error getting salary history: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get salary history',
      data: null,
    });
  }
}

/**
 * GET /api/groom-salaries/groom/:groomId/salary
 * Get weekly salary for a specific groom
 */
export async function getGroomSalary(req, res) {
  try {
    const { groomId } = req.params;
    const userId = req.user?.id;

    logger.info(`[groomSalaryController] Getting salary for groom ${groomId}`);

    // Validate groom ID
    const parsedGroomId = parseInt(groomId);
    if (isNaN(parsedGroomId) || parsedGroomId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groom ID',
        data: null,
      });
    }

    // Check groom ownership
    const groom = await prisma.groom.findUnique({
      where: { id: parsedGroomId },
      select: {
        id: true,
        name: true,
        skillLevel: true,
        speciality: true,
        userId: true,
      },
    });

    if (!groom) {
      return res.status(404).json({
        success: false,
        message: 'Groom not found',
        data: null,
      });
    }

    if (groom.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this groom',
        data: null,
      });
    }

    const weeklySalary = calculateWeeklySalary(groom);

    res.json({
      success: true,
      message: 'Groom salary retrieved successfully',
      data: {
        groom: {
          id: groom.id,
          name: groom.name,
          skillLevel: groom.skillLevel,
          speciality: groom.speciality,
        },
        weeklySalary,
      },
    });

  } catch (error) {
    logger.error(`[groomSalaryController] Error getting groom salary: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get groom salary',
      data: null,
    });
  }
}

/**
 * POST /api/groom-salaries/process (Admin only)
 * Manually trigger salary processing
 */
export async function triggerSalaryProcessingEndpoint(req, res) {
  try {
    const userId = req.user?.id;

    logger.info(`[groomSalaryController] Manual salary processing triggered by user ${userId}`);

    // Check if user is admin (you may want to implement proper admin role checking)
    const _user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    // For now, allow any user to trigger (you can restrict this later)
    const results = await triggerSalaryProcessing();

    res.json({
      success: true,
      message: 'Salary processing completed',
      data: results,
    });

  } catch (error) {
    logger.error(`[groomSalaryController] Error triggering salary processing: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger salary processing',
      data: null,
    });
  }
}

/**
 * GET /api/groom-salaries/status
 * Get cron job status information
 */
export async function getCronStatus(req, res) {
  try {
    const userId = req.user?.id;

    logger.info(`[groomSalaryController] Getting cron job status for user ${userId}`);

    const status = getCronJobStatus();

    res.json({
      success: true,
      message: 'Cron job status retrieved successfully',
      data: status,
    });

  } catch (error) {
    logger.error(`[groomSalaryController] Error getting cron status: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get cron status',
      data: null,
    });
  }
}

/**
 * GET /api/groom-salaries/summary
 * Get comprehensive salary summary for user
 */
export async function getSalarySummary(req, res) {
  try {
    const userId = req.user?.id;

    logger.info(`[groomSalaryController] Getting salary summary for user ${userId}`);

    // Get current cost
    const salaryCost = await calculateUserSalaryCost(userId);

    // Get recent payment history
    const recentPayments = await getSalaryPaymentHistory(userId, 10);

    // Get user's current money
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        money: true,
        groomSalaryGracePeriod: true,
      },
    });

    // Calculate weeks user can afford
    const weeksAffordable = salaryCost.totalWeeklyCost > 0
      ? Math.floor(user.money / salaryCost.totalWeeklyCost)
      : Infinity;

    // Check grace period status
    const inGracePeriod = user.groomSalaryGracePeriod !== null;
    let gracePeriodDaysRemaining = 0;

    if (inGracePeriod) {
      const gracePeriodEnd = new Date(user.groomSalaryGracePeriod);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // 7 day grace period
      gracePeriodDaysRemaining = Math.max(0, Math.ceil((gracePeriodEnd - new Date()) / (1000 * 60 * 60 * 24)));
    }

    res.json({
      success: true,
      message: 'Salary summary retrieved successfully',
      data: {
        currentCost: salaryCost,
        currentMoney: user.money,
        weeksAffordable,
        inGracePeriod,
        gracePeriodDaysRemaining,
        recentPayments: recentPayments.slice(0, 5), // Last 5 payments
        nextPaymentDate: getNextPaymentDate(),
      },
    });

  } catch (error) {
    logger.error(`[groomSalaryController] Error getting salary summary: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get salary summary',
      data: null,
    });
  }
}

/**
 * Calculate next payment date (next Monday)
 * @returns {Date} Next payment date
 */
function getNextPaymentDate() {
  const now = new Date();
  const nextMonday = new Date(now);

  // Get days until next Monday (1 = Monday)
  const daysUntilMonday = (1 + 7 - now.getDay()) % 7;
  if (daysUntilMonday === 0 && now.getHours() >= 9) {
    // If it's Monday after 9 AM, get next Monday
    nextMonday.setDate(now.getDate() + 7);
  } else {
    nextMonday.setDate(now.getDate() + daysUntilMonday);
  }

  nextMonday.setHours(9, 0, 0, 0); // 9:00 AM

  return nextMonday;
}
