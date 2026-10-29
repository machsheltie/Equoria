/**
 * Groom Salary Controller
 *
 * Handles API endpoints for groom salary management
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import {
  calculateUserSalaryCost,
  getPayWeekStart,
  getSalaryPaymentHistory,
} from '../services/groomSalaryService.mjs';
import {
  GroomPayRefusal,
  getGroomPayStatus,
  payGroom,
} from '../services/groomPlayerPayService.mjs';
import { getCronJobStatus } from '../../../services/cronJobService.mjs';

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
 * When this week's pay is due: the end of the pay week, Sunday midnight Eastern
 * (owner ruling 2026-10-29, q268, Equoria-hc96y). Old contract: the automatic Monday
 * 09:00 payroll run.
 * @returns {Date}
 */
function getNextPaymentDate() {
  return startOfGameDayIndex(gameDayIndex(getPayWeekStart(new Date())) + 7);
}

/**
 * GET /api/v1/groom-salaries/pay-status
 * This week's pay state for each groom on the player's staff (Equoria-hc96y).
 */
export async function getGroomPayStatusHandler(req, res, next) {
  try {
    const data = await getGroomPayStatus(req.user.id);
    return res.json({ success: true, message: 'Groom pay retrieved', data });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/groom-salaries/grooms/:groomId/pay
 * The player's Pay Groom button: one groom, this week (plus any owed weeks the wallet
 * covers). Answers with the refreshed pay state so the page updates in place.
 */
export async function payGroomHandler(req, res, next) {
  try {
    const paid = await payGroom(req.user.id, Number(req.params.groomId));
    const data = await getGroomPayStatus(req.user.id);
    return res.json({ success: true, message: 'Groom paid', data: { ...data, paid } });
  } catch (error) {
    if (error instanceof GroomPayRefusal) {
      return res
        .status(error.status)
        .json({ success: false, code: error.code, message: error.message });
    }
    return next(error);
  }
}
