/**
 * Groom Bonus-Traits Handlers
 *
 * Equoria-8kuhf: extracted from groomController.mjs (god-file split to satisfy
 * the 800-line max-lines cap). Behavior, signatures, response shapes, and
 * route wiring are unchanged — groomController.mjs re-exports these so the
 * public import surface is identical.
 *
 * Handlers: getGroomBonusTraits, updateGroomBonusTraits.
 */

import logger from '../../../utils/logger.mjs';
import AppError from '../../../errors/AppError.mjs';

/**
 * GET /api/grooms/:id/bonus-traits
 * Get groom bonus traits
 */
export async function getGroomBonusTraits(req, res) {
  try {
    const { id } = req.params;
    const groomId = parseInt(id, 10);

    if (isNaN(groomId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groom ID',
      });
    }

    logger.info(`[groomController.getGroomBonusTraits] Getting bonus traits for groom ${groomId}`);

    const { getBonusTraits } = await import('../services/groomBonusTraitService.mjs');
    const bonusTraits = await getBonusTraits(groomId);

    res.json({
      success: true,
      message: 'Bonus traits retrieved successfully',
      data: {
        groomId,
        bonusTraits,
        hasBonusTraits: Object.keys(bonusTraits).length > 0,
        bonusTraitCount: Object.keys(bonusTraits).length,
      },
    });
  } catch (error) {
    logger.error(`[groomController.getGroomBonusTraits] Error: ${error.message}`);

    // Equoria-4xwyi: TYPE-based 404 detection. getBonusTraits throws a typed
    // NotFoundError (AppError, statusCode 404) for a missing groom. Fail-closed:
    // any other error surfaces as 500 rather than being string-matched into a
    // misleading 404 (the Equoria-93lhj antipattern).
    if (AppError.isAppError(error) && error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bonus traits',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * PUT /api/grooms/:id/bonus-traits
 * Update groom bonus traits
 */
export async function updateGroomBonusTraits(req, res) {
  try {
    const { id } = req.params;
    const { bonusTraits } = req.body;
    const groomId = parseInt(id, 10);

    if (isNaN(groomId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groom ID',
      });
    }

    logger.info(
      `[groomController.updateGroomBonusTraits] Updating bonus traits for groom ${groomId}`,
    );

    const { assignBonusTraits } = await import('../services/groomBonusTraitService.mjs');
    const result = await assignBonusTraits(groomId, bonusTraits);

    res.json({
      success: true,
      message: 'Bonus traits updated successfully',
      data: {
        groomId: result.groomId,
        groomName: result.groomName,
        bonusTraits: result.bonusTraits,
        bonusTraitCount: Object.keys(result.bonusTraits).length,
      },
    });
  } catch (error) {
    logger.error(`[groomController.updateGroomBonusTraits] Error: ${error.message}`);

    // Equoria-4xwyi: TYPE-based 404 detection. assignBonusTraits now does an
    // explicit existence check that throws a typed NotFoundError (AppError,
    // statusCode 404) for a missing groom BEFORE the prisma.groom.update() — so
    // the missing-groom 404 (previously produced by string-matching the Prisma
    // P2025 'not found' message) is now detected by type. Fail-closed: a real
    // P2025 from a concurrent delete between the check and the update, or any
    // other error, surfaces as 500 rather than being masked as a 404.
    if (AppError.isAppError(error) && error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('constraints violated')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update bonus traits',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}
