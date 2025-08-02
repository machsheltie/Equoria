import express from 'express';
import { body, param, validationResult } from 'express-validator';
import {
  batchRevealTraits,
  getDiscoveryProgress,
  DISCOVERY_CONDITIONS,
} from '../utils/traitDiscovery.mjs';
import { discoverTraits, getDiscoveryStatus, batchDiscoverTraits } from '../controllers/traitController.mjs';
import { handleValidationErrors } from '../middleware/validationErrorHandler.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

/**
 * POST /api/traits/discover/batch
 * Trigger trait discovery for multiple horses
 * NOTE: This route must come BEFORE /discover/:horseId to avoid route conflicts
 */
router.post(
  '/discover/batch',
  [
    body('horseIds')
      .isArray({ min: 1 })
      .withMessage('horseIds must be a non-empty array')
      .custom(horseIds => {
        if (!horseIds.every(id => Number.isInteger(Number(id)) && Number(id) > 0)) {
          throw new Error('All horse IDs must be positive integers');
        }
        return true;
      }),
  ],
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

      const { horseIds } = req.body;
      logger.info(
        `[traitDiscoveryRoutes] POST /discover/batch - Processing ${horseIds.length} horses`,
      );

      const results = await batchRevealTraits(horseIds);

      const summary = {
        totalHorses: horseIds.length,
        successfulDiscoveries: results.filter(r => !r.error).length,
        failedDiscoveries: results.filter(r => r.error).length,
        totalTraitsRevealed: results.reduce((sum, r) => sum + (r.traitsRevealed?.length || 0), 0),
      };

      res.json({
        success: true,
        message: `Batch discovery completed for ${horseIds.length} horses`,
        data: {
          results,
          summary,
        },
      });
    } catch (error) {
      logger.error(`[traitDiscoveryRoutes] POST /discover/batch error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error during batch trait discovery',
      });
    }
  },
);

// NOTE: Individual horse discovery route moved to traitRoutes.mjs to avoid conflicts
// The /discover/:horseId route is now handled by traitRoutes.mjs

/**
 * GET /api/traits/progress/:horseId
 * Get trait discovery progress for a horse
 */
router.get(
  '/progress/:horseId',
  [param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer')],
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
          revealableTraits: condition.revealableTraits,
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

      if (error.message.includes('not found')) {
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

    const conditions = Object.entries(DISCOVERY_CONDITIONS).map(([key, condition]) => ({
      key,
      name: condition.name,
      description: condition.description,
      revealableTraits: condition.revealableTraits,
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
          revealableTraits: condition.revealableTraits,
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

      if (error.message.includes('not found')) {
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
 * POST /api/trait-discovery/discover/:horseId
 * Trigger trait discovery for a specific horse
 */
router.post(
  '/discover/:horseId',
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    body('checkEnrichment').optional().isBoolean().withMessage('checkEnrichment must be a boolean'),
    body('forceCheck').optional().isBoolean().withMessage('forceCheck must be a boolean'),
    handleValidationErrors,
  ],
  discoverTraits,
);

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
  getDiscoveryStatus,
);

/**
 * POST /api/trait-discovery/batch-discover
 * Trigger trait discovery for multiple horses
 */
router.post(
  '/batch-discover',
  [
    body('horseIds')
      .isArray({ min: 1, max: 10 })
      .withMessage('horseIds must be an array with 1-10 elements')
      .custom(horseIds => {
        if (!horseIds.every(id => Number.isInteger(Number(id)) && Number(id) > 0)) {
          throw new Error('All horse IDs must be positive integers');
        }
        return true;
      }),
    body('checkEnrichment').optional().isBoolean().withMessage('checkEnrichment must be a boolean'),
    handleValidationErrors,
  ],
  batchDiscoverTraits,
);

export default router;
