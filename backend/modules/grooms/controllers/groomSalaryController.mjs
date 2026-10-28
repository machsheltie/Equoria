/**
 * Groom Salary Controller
 *
 * Handles API endpoints for groom salary management
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { gameDayIndex, startOfGameDayIndex, startOfGameWeek } from '../../../utils/gameTime.mjs';
import {
  calculateUserSalaryCost,
  getSalaryPaymentHistory,
} from '../services/groomSalaryService.mjs';
import { triggerSalaryProcessing, getCronJobStatus } from '../../../services/cronJobService.mjs';

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
    const weeksAffordable =
      salaryCost.totalWeeklyCost > 0
        ? Math.floor(user.money / salaryCost.totalWeeklyCost)
        : Infinity;

    // Check grace period status
    const inGracePeriod = user.groomSalaryGracePeriod !== null;
    let gracePeriodDaysRemaining = 0;

    if (inGracePeriod) {
      const gracePeriodEnd = new Date(user.groomSalaryGracePeriod);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // 7 day grace period
      gracePeriodDaysRemaining = Math.max(
        0,
        Math.ceil((gracePeriodEnd - new Date()) / (1000 * 60 * 60 * 24)),
      );
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
  // Payroll runs Mondays at 09:00 Eastern (the game clock). No daylight-saving
  // change happens between 00:00 and 09:00 on a Monday, so +9h is exact.
  const now = new Date();
  const NINE_HOURS_MS = 9 * 60 * 60 * 1000;
  const thisMonday = startOfGameWeek(now, 1);
  const payday = new Date(thisMonday.getTime() + NINE_HOURS_MS);
  if (now < payday) {
    return payday;
  }
  const nextMonday = startOfGameDayIndex(gameDayIndex(thisMonday) + 7);
  return new Date(nextMonday.getTime() + NINE_HOURS_MS);
}
