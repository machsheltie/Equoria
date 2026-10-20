/**
 * Trait discovery routes — read-only (progress, conditions, status).
 *
 * No route here reveals or writes traits (Equoria-gu8jk; owner ruling
 * 2026-10-20: players must never write traits for themselves).
 * POST /discover/batch, POST /discover/:horseId and POST /batch-discover were
 * removed. Traits will be activated by grooms (Equoria-09g33).
 */
import express from 'express';
import { param, validationResult } from 'express-validator';
import { getDiscoveryProgress, DISCOVERY_CONDITIONS } from '../../../utils/traitDiscovery.mjs';
import { getDiscoveryStatus } from '../controllers/traitController.mjs';
import { handleValidationErrors } from '../../../middleware/validationErrorHandler.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import logger from '../../../utils/logger.mjs';
import AppError from '../../../errors/AppError.mjs';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/traits/progress/:horseId
 * Get trait discovery progress for a horse
 */
router.get(
  '/progress/:horseId',
  [param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer')],
  requireOwnership('horse', { idParam: 'horseId' }),
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { horseId } = req.params;
      logger.info(`[traitDiscoveryRoutes] GET /progress/${horseId} - Getting discovery progress`);

      const progress = await getDiscoveryProgress(horseId);

      // Transform conditions from array to object format expected by tests
      const metConditions = progress.conditions || [];
      const conditionsObject = {};

      // Create conditions object with snake_case keys as expected by tests
      Object.entries(DISCOVERY_CONDITIONS).forEach(([key, condition]) => {
        const snakeKey = key.toLowerCase();
        const isMetCondition = metConditions.find(c => c.name === key);
        conditionsObject[snakeKey] = {
          name: condition.name,
          description: condition.description,
          met: !!isMetCondition,
          progress: isMetCondition ? 100 : 0,
        };
      });

      res.json({
        success: true,
        data: {
          ...progress,
          conditions: conditionsObject,
        },
      });
    } catch (error) {
      logger.error(
        `[traitDiscoveryRoutes] GET /progress/${req.params.horseId} error: ${error.message}`,
      );

      // Equoria-4xwyi: TYPE-based 404 detection. getDiscoveryProgress throws a
      // typed NotFoundError (AppError, statusCode 404) for a missing horse.
      // Fail-closed: any other error surfaces as 500 rather than being string-
      // matched into a misleading 404 (the Equoria-93lhj antipattern).
      if (AppError.isAppError(error) && error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error while getting discovery progress',
      });
    }
  },
);

/**
 * GET /api/traits/conditions
 * Get all available discovery conditions and their requirements
 */
router.get('/conditions', async (req, res) => {
  try {
    logger.info('[traitDiscoveryRoutes] GET /conditions - Getting discovery conditions');

    // No per-condition trait-name hint lists in any discovery response (owner
    // ruling 2026-10-19, Equoria-6dace).
    const conditions = Object.entries(DISCOVERY_CONDITIONS).map(([key, condition]) => ({
      key,
      name: condition.name,
      description: condition.description,
      category: categorizeCondition(key),
    }));

    res.json({
      success: true,
      data: {
        conditions,
        totalConditions: conditions.length,
        categories: {
          bonding: conditions.filter(c => c.category === 'bonding').length,
          stress: conditions.filter(c => c.category === 'stress').length,
          activities: conditions.filter(c => c.category === 'activities').length,
          milestones: conditions.filter(c => c.category === 'milestones').length,
        },
      },
    });
  } catch (error) {
    logger.error(`[traitDiscoveryRoutes] GET /conditions error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error while getting discovery conditions',
    });
  }
});

/**
 * POST /api/traits/check-conditions/:horseId
 * Check which conditions a horse currently meets (without triggering discovery)
 */
router.post(
  '/check-conditions/:horseId',
  [param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer')],
  requireOwnership('horse', { idParam: 'horseId' }),
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { horseId } = req.params;
      logger.info(
        `[traitDiscoveryRoutes] POST /check-conditions/${horseId} - Checking conditions without discovery`,
      );

      // Get progress which includes condition checking
      const progress = await getDiscoveryProgress(horseId);

      // Extract just the condition status - conditions is an array of met conditions
      const metConditions = progress.conditions || [];

      // Create full condition status including unmet conditions
      const conditionStatus = Object.entries(DISCOVERY_CONDITIONS).map(([key, condition]) => {
        const isMetCondition = metConditions.find(c => c.name === key);
        return {
          key,
          name: condition.name,
          description: condition.description,
          met: !!isMetCondition,
          progress: isMetCondition ? 100 : 0,
        };
      });

      res.json({
        success: true,
        data: {
          horseId: progress.horseId,
          horseName: progress.horseName,
          currentStats: progress.currentStats,
          conditions: conditionStatus,
          summary: {
            totalConditions: conditionStatus.length,
            conditionsMet: conditionStatus.filter(c => c.met).length,
            averageProgress: Math.round(
              conditionStatus.reduce((sum, c) => sum + c.progress, 0) / conditionStatus.length,
            ),
            hiddenTraitsRemaining: progress.hiddenTraitsCount,
          },
        },
      });
    } catch (error) {
      logger.error(
        `[traitDiscoveryRoutes] POST /check-conditions/${req.params.horseId} error: ${error.message}`,
      );

      // Equoria-4xwyi: TYPE-based 404 detection. getDiscoveryProgress throws a
      // typed NotFoundError (AppError, statusCode 404) for a missing horse.
      // Fail-closed: any other error surfaces as 500 rather than being string-
      // matched into a misleading 404 (the Equoria-93lhj antipattern).
      if (AppError.isAppError(error) && error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error while checking conditions',
      });
    }
  },
);

/**
 * Helper function to categorize discovery conditions
 * @param {string} conditionKey - Key of the condition
 * @returns {string} Category name
 */
function categorizeCondition(conditionKey) {
  if (conditionKey.includes('bonding') || conditionKey === 'perfect_care') {
    return 'bonding';
  }
  if (conditionKey.includes('stress')) {
    return 'stress';
  }
  if (conditionKey.includes('activities')) {
    return 'activities';
  }
  if (conditionKey.includes('development') || conditionKey.includes('complete')) {
    return 'milestones';
  }
  return 'other';
}

/**
 * GET /api/trait-discovery/discovery-status/:horseId
 * Get discovery status and conditions for a horse
 */
router.get(
  '/discovery-status/:horseId',
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    handleValidationErrors,
  ],
  requireOwnership('horse', { idParam: 'horseId' }),
  getDiscoveryStatus,
);

export default router;
