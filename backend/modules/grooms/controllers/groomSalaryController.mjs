/**
 * Groom Salary Controller
 *
 * Handles API endpoints for groom salary management
 */

import logger from '../../../utils/logger.mjs';
import { calculateUserSalaryCost } from '../services/groomSalaryService.mjs';
import {
  GroomPayRefusal,
  getGroomPayStatus,
  payGroom,
} from '../services/groomPlayerPayService.mjs';

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
