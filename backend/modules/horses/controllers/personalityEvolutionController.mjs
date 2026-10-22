/**
 * Personality Evolution Controller
 *
 * Handles API endpoints for personality evolution system including groom and horse personality development,
 * evolution triggers, stability analysis, and prediction capabilities.
 *
 * Business Rules:
 * - Groom personalities evolve based on interaction patterns and experience
 * - Evolution requires minimum thresholds and consistency patterns
 * - Provides prediction and analysis capabilities for strategic planning
 * - No handler here changes a horse's temperament (Equoria-gu8jk; owner ruling
 *   2026-10-20: players must never write traits for themselves). The
 *   evolveHorseTemperamentController and batchEvolvePersonalitiesController
 *   handlers were removed with their routes.
 */

import logger from '../../../utils/logger.mjs';
import { findOwnedResource } from '../../../middleware/ownership.mjs';
import {
  calculatePersonalityEvolutionTriggers,
  analyzePersonalityStability,
  predictPersonalityEvolution,
  getPersonalityEvolutionHistory,
} from '../services/personalityEvolutionSystem.mjs';

/**
 * The 404 body for "this entity is not yours", correct for BOTH entity types.
 *
 * Equoria-ypb7d.2 fix round 3. These four responses interpolated
 * `"... not found or you do not own this ${entityType}"`, which is right for a horse and
 * wrong for a groom: players never own grooms, they engage them. Four copies of a string
 * that must agree is the same shape as the drift finding F1 was about, so the wording has
 * ONE definition here rather than four.
 *
 * The not-found / not-yours COLLAPSE is preserved deliberately: one message per branch,
 * distinguishing nothing, so the endpoint cannot be used as an existence oracle
 * (CWE-639, the convention this codebase already holds).
 *
 * @param {'groom'|'horse'} entityType — already validated by the caller
 * @returns {string}
 */
function notFoundOrNotYours(entityType) {
  return entityType === 'groom'
    ? 'Groom not found or not on your staff'
    : 'Horse not found or you do not own this horse';
}

/**
 * Calculate personality evolution triggers for an entity
 * GET /api/personality-evolution/:entityType/:entityId/triggers
 */
export async function getEvolutionTriggersController(req, res) {
  try {
    const { entityType, entityId } = req.params;
    const userId = req.user.id;

    if (!['groom', 'horse'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be "groom" or "horse"',
      });
    }

    logger.info(
      `[personalityEvolutionController.getEvolutionTriggersController] Analyzing triggers for ${entityType} ID: ${entityId}`,
    );

    // Validate entity ownership (atomic)
    const entity = await findOwnedResource(entityType, parseInt(entityId), userId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: notFoundOrNotYours(entityType),
      });
    }

    const result = await calculatePersonalityEvolutionTriggers(parseInt(entityId), entityType);

    res.status(200).json({
      success: true,
      message: 'Evolution triggers calculated successfully',
      data: result,
    });
  } catch (error) {
    logger.error(
      `[personalityEvolutionController.getEvolutionTriggersController] Error: ${error.message}`,
    );
    res.status(500).json({
      success: false,
      message: 'Failed to calculate evolution triggers',
      error: error.message,
    });
  }
}

/**
 * Analyze personality stability for an entity
 * GET /api/personality-evolution/:entityType/:entityId/stability
 */
export async function getPersonalityStabilityController(req, res) {
  try {
    const { entityType, entityId } = req.params;
    const userId = req.user.id;

    if (!['groom', 'horse'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be "groom" or "horse"',
      });
    }

    logger.info(
      `[personalityEvolutionController.getPersonalityStabilityController] Analyzing stability for ${entityType} ID: ${entityId}`,
    );

    // Validate entity ownership (atomic)
    const entity = await findOwnedResource(entityType, parseInt(entityId), userId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: notFoundOrNotYours(entityType),
      });
    }

    const result = await analyzePersonalityStability(parseInt(entityId), entityType);

    res.status(200).json({
      success: true,
      message: 'Personality stability analyzed successfully',
      data: result,
    });
  } catch (error) {
    logger.error(
      `[personalityEvolutionController.getPersonalityStabilityController] Error: ${error.message}`,
    );
    res.status(500).json({
      success: false,
      message: 'Failed to analyze personality stability',
      error: error.message,
    });
  }
}

/**
 * Predict future personality evolution
 * GET /api/personality-evolution/:entityType/:entityId/predict
 */
export async function predictPersonalityEvolutionController(req, res) {
  try {
    const { entityType, entityId } = req.params;
    const { timeframeDays = 30 } = req.query;
    const userId = req.user.id;

    if (!['groom', 'horse'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be "groom" or "horse"',
      });
    }

    const timeframe = parseInt(timeframeDays);
    if (isNaN(timeframe) || timeframe < 1 || timeframe > 365) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timeframe. Must be between 1 and 365 days',
      });
    }

    logger.info(
      `[personalityEvolutionController.predictPersonalityEvolutionController] Predicting evolution for ${entityType} ID: ${entityId} over ${timeframe} days`,
    );

    // Validate entity ownership (atomic)
    const entity = await findOwnedResource(entityType, parseInt(entityId), userId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: notFoundOrNotYours(entityType),
      });
    }

    const result = await predictPersonalityEvolution(parseInt(entityId), entityType, timeframe);

    res.status(200).json({
      success: true,
      message: 'Personality evolution prediction completed successfully',
      data: result,
    });
  } catch (error) {
    logger.error(
      `[personalityEvolutionController.predictPersonalityEvolutionController] Error: ${error.message}`,
    );
    res.status(500).json({
      success: false,
      message: 'Failed to predict personality evolution',
      error: error.message,
    });
  }
}

/**
 * Get personality evolution history for an entity
 * GET /api/personality-evolution/:entityType/:entityId/history
 */
export async function getPersonalityEvolutionHistoryController(req, res) {
  try {
    const { entityType, entityId } = req.params;
    const userId = req.user.id;

    if (!['groom', 'horse'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be "groom" or "horse"',
      });
    }

    logger.info(
      `[personalityEvolutionController.getPersonalityEvolutionHistoryController] Getting evolution history for ${entityType} ID: ${entityId}`,
    );

    // Validate entity ownership (atomic)
    const entity = await findOwnedResource(entityType, parseInt(entityId), userId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: notFoundOrNotYours(entityType),
      });
    }

    const result = await getPersonalityEvolutionHistory(parseInt(entityId), entityType);

    res.status(200).json({
      success: true,
      message: 'Personality evolution history retrieved successfully',
      data: result,
    });
  } catch (error) {
    logger.error(
      `[personalityEvolutionController.getPersonalityEvolutionHistoryController] Error: ${error.message}`,
    );
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve personality evolution history',
      error: error.message,
    });
  }
}
