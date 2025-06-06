import express from 'express';
import { body, param, validationResult } from 'express-validator';
import {
  revealTraits,
  batchRevealTraits,
  getDiscoveryProgress,
  DISCOVERY_CONDITIONS,
} from '../utils/traitDiscovery.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

/**
 * POST /api/traits/discover/batch
 * Trigger trait discovery for multiple foals
 * NOTE: This route must come BEFORE /discover/:foalId to avoid route conflicts
 */
router.post(
  '/discover/batch',
  [
    body('foalIds')
      .isArray({ min: 1 })
      .withMessage('foalIds must be a non-empty array')
      .custom(foalIds => {
        if (!foalIds.every(id => Number.isInteger(Number(id)) && Number(id) > 0)) {
          throw new Error('All foal IDs must be positive integers');
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

      const { foalIds } = req.body;
      logger.info(
        `[traitDiscoveryRoutes] POST /discover/batch - Processing ${foalIds.length} foals`,
      );

      const results = await batchRevealTraits(foalIds);

      const summary = {
        totalFoals: foalIds.length,
        successfulDiscoveries: results.filter(r => !r.error).length,
        failedDiscoveries: results.filter(r => r.error).length,
        totalTraitsRevealed: results.reduce((sum, r) => sum + (r.traitsRevealed?.length || 0), 0),
      };

      res.json({
        success: true,
        message: `Batch discovery completed for ${foalIds.length} foals`,
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

/**
 * POST /api/traits/discover/:foalId
 * Trigger trait discovery for a specific foal
 */
router.post(
  '/discover/:foalId',
  [param('foalId').isInt({ min: 1 }).withMessage('Foal ID must be a positive integer')],
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

      const { foalId } = req.params;
      logger.info(
        `[traitDiscoveryRoutes] POST /discover/${foalId} - Manual trait discovery triggered`,
      );

      const discoveryResults = await revealTraits(foalId);

      res.json({
        success: true,
        message:
          discoveryResults.traitsRevealed.length > 0
            ? `Discovered ${discoveryResults.traitsRevealed.length} new traits!`
            : 'No new traits discovered at this time',
        data: {
          foalId: discoveryResults.foalId,
          foalName: discoveryResults.foalName,
          conditionsMet: discoveryResults.conditionsMet,
          traitsRevealed: discoveryResults.traitsRevealed,
          hiddenTraitsRemaining: discoveryResults.totalHiddenAfter,
          summary: {
            totalConditionsMet: discoveryResults.conditionsMet.length,
            totalTraitsRevealed: discoveryResults.traitsRevealed.length,
            hiddenBefore: discoveryResults.totalHiddenBefore,
            hiddenAfter: discoveryResults.totalHiddenAfter,
          },
        },
      });
    } catch (error) {
      logger.error(
        `[traitDiscoveryRoutes] POST /discover/${req.params.foalId} error: ${error.message}`,
      );

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes('not a foal')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during trait discovery',
      });
    }
  },
);

/**
 * GET /api/traits/progress/:foalId
 * Get trait discovery progress for a foal
 */
router.get(
  '/progress/:foalId',
  [param('foalId').isInt({ min: 1 }).withMessage('Foal ID must be a positive integer')],
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

      const { foalId } = req.params;
      logger.info(`[traitDiscoveryRoutes] GET /progress/${foalId} - Getting discovery progress`);

      const progress = await getDiscoveryProgress(foalId);

      res.json({
        success: true,
        data: progress,
      });
    } catch (error) {
      logger.error(
        `[traitDiscoveryRoutes] GET /progress/${req.params.foalId} error: ${error.message}`,
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
 * POST /api/traits/check-conditions/:foalId
 * Check which conditions a foal currently meets (without triggering discovery)
 */
router.post(
  '/check-conditions/:foalId',
  [param('foalId').isInt({ min: 1 }).withMessage('Foal ID must be a positive integer')],
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

      const { foalId } = req.params;
      logger.info(
        `[traitDiscoveryRoutes] POST /check-conditions/${foalId} - Checking conditions without discovery`,
      );

      // Get progress which includes condition checking
      const progress = await getDiscoveryProgress(foalId);

      // Extract just the condition status
      const conditionStatus = Object.entries(progress.conditions).map(([key, condition]) => ({
        key,
        name: condition.name,
        description: condition.description,
        met: condition.met,
        progress: condition.progress,
        revealableTraits: condition.revealableTraits,
      }));

      res.json({
        success: true,
        data: {
          foalId: progress.foalId,
          foalName: progress.foalName,
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
        `[traitDiscoveryRoutes] POST /check-conditions/${req.params.foalId} error: ${error.message}`,
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

export default router;
