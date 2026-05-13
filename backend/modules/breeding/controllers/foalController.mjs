/**
 * FoalController
 *
 * Extracted from inline route handlers in foalRoutes.mjs.
 * Validation middleware (express-validator) and ownership checks remain in foalRoutes.mjs.
 *
 * Routes:
 *   GET  /api/foals/:foalId/development  — get foal development data
 *   POST /api/foals/:foalId/activity     — complete a foal enrichment activity
 *   POST /api/foals/:foalId/advance-day  — advance foal to next day (admin/cron)
 *   POST /api/foals/:foalId/enrichment   — complete enrichment activity (Task 5 API)
 *   POST /api/foals/:foalId/graduate     — graduate a foal at age 3
 */

import { validationResult } from 'express-validator';
import {
  getFoalDevelopment,
  completeActivity,
  advanceDay,
  completeEnrichmentActivity,
  graduateFoal,
} from '../../../models/foalModel.mjs';
import { ensureDefaultGroomAssignment } from '../../../utils/groomSystem.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * GET /api/foals/:foalId/development
 * Get foal development data including current status and activity history
 */
export async function getFoalDevelopmentHandler(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { foalId } = req.params;
    logger.info(`[foalController] GET /api/foals/${foalId}/development`);

    const developmentData = await getFoalDevelopment(foalId);

    // Ensure foal has a groom assignment (requires authenticated user)
    if (req.user?.id) {
      try {
        await ensureDefaultGroomAssignment(parseInt(foalId, 10), req.user.id);
      } catch (groomError) {
        logger.warn(
          `[foalController] Failed to ensure groom assignment for foal ${foalId}: ${groomError.message}`,
        );
      }
    }

    res.json({ success: true, data: developmentData });
  } catch (error) {
    logger.error(`[foalController] GET /api/foals/:foalId/development error: ${error.message}`);
    if (error.message.includes('not found') || error.message.includes('not a foal')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/foals/:foalId/activity
 * Complete a foal enrichment activity
 */
export async function completeFoalActivity(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { foalId } = req.params;
    const { activityType } = req.body;
    logger.info(`[foalController] POST /api/foals/${foalId}/activity - ${activityType}`);

    const updatedData = await completeActivity(foalId, activityType);

    res.json({
      success: true,
      message: `Activity "${activityType}" completed successfully`,
      data: updatedData,
    });
  } catch (error) {
    logger.error(`[foalController] POST /api/foals/:foalId/activity error: ${error.message}`);
    if (error.message.includes('not found') || error.message.includes('not available')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes('already completed') || error.message.includes('not available')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/foals/:foalId/advance-day
 * Advance foal to next day (admin/cron endpoint)
 */
export async function advanceFoalDay(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { foalId } = req.params;
    logger.info(`[foalController] POST /api/foals/${foalId}/advance-day`);

    const updatedData = await advanceDay(foalId);

    res.json({
      success: true,
      message: `Foal advanced to day ${updatedData.development.currentDay}`,
      data: updatedData,
    });
  } catch (error) {
    logger.error(`[foalController] POST /api/foals/:foalId/advance-day error: ${error.message}`);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes('already completed')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/foals/:foalId/enrichment
 * Complete a foal enrichment activity (Task 5 API)
 */
export async function completeFoalEnrichment(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { foalId } = req.params;
    const { day, activity } = req.body;
    logger.info(
      `[foalController] POST /api/foals/${foalId}/enrichment - Day ${day}, Activity: ${activity}`,
    );

    const result = await completeEnrichmentActivity(foalId, day, activity);

    res.json({
      success: true,
      message: `Enrichment activity "${result.activity.name}" completed successfully`,
      data: {
        foal: result.foal,
        activity: result.activity,
        updatedLevels: {
          bondScore: result.levels.bondScore,
          stressLevel: result.levels.stressLevel,
        },
        changes: {
          bondChange: result.levels.bondChange,
          stressChange: result.levels.stressChange,
        },
        trainingRecordId: result.trainingRecordId,
      },
    });
  } catch (error) {
    logger.error(`[foalController] POST /api/foals/:foalId/enrichment error: ${error.message}`);
    if (error.message.includes('not found') || error.message.includes('not a foal')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes('not appropriate') || error.message.includes('must be between')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/foals/:foalId/graduate
 * Graduate a foal — closes development window and clears groom assignments.
 * Called when a foal reaches age 3 (104 weeks).
 */
export async function graduateFoalHandler(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { foalId } = req.params;
    const userId = req.user?.id;
    logger.info(`[foalController] POST /api/foals/${foalId}/graduate`);

    const result = await graduateFoal(foalId, userId);

    res.json({
      success: true,
      message: `${result.horse.name} has graduated! Now eligible for training and competition.`,
      data: result,
    });
  } catch (error) {
    logger.error(`[foalController] POST /api/foals/:foalId/graduate error: ${error.message}`);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (
      error.message.includes('not reached graduation age') ||
      error.message.includes('already graduated')
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
