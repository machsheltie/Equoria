/**
 * Personality Evolution Controller
 *
 * Handles API endpoints for personality evolution system including groom and horse personality development,
 * evolution triggers, stability analysis, and prediction capabilities.
 *
 * Business Rules:
 * - Groom personalities evolve based on interaction patterns and experience
 * - Horse temperaments evolve based on care history and environmental factors
 * - Evolution requires minimum thresholds and consistency patterns
 * - Provides prediction and analysis capabilities for strategic planning
 * - Supports both individual and batch evolution processing
 */

import logger from '../../../utils/logger.mjs';
import { findOwnedResource, validateBatchOwnership } from '../../../middleware/ownership.mjs';
import {
  evolveGroomPersonality,
  evolveHorseTemperament,
  calculatePersonalityEvolutionTriggers,
  analyzePersonalityStability,
  predictPersonalityEvolution,
  getPersonalityEvolutionHistory,
} from '../../horses/index.mjs';

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
 * Evolve groom personality based on interaction patterns
 * POST /api/personality-evolution/groom/:groomId/evolve
 */
export async function evolveGroomPersonalityController(req, res) {
  try {
    const { groomId } = req.params;

    logger.info(
      `[personalityEvolutionController.evolveGroomPersonalityController] Processing groom evolution for ID: ${groomId}`,
    );

    const result = await evolveGroomPersonality(parseInt(groomId));

    res.status(200).json({
      success: true,
      message: result.personalityEvolved
        ? 'Groom personality evolution completed successfully'
        : 'Groom personality evolution not triggered',
      data: result,
    });
  } catch (error) {
    logger.error(
      `[personalityEvolutionController.evolveGroomPersonalityController] Error: ${error.message}`,
    );
    res.status(500).json({
      success: false,
      message: 'Failed to process groom personality evolution',
      error: error.message,
    });
  }
}

/**
 * Evolve horse temperament based on care history
 * POST /api/personality-evolution/horse/:horseId/evolve
 */
export async function evolveHorseTemperamentController(req, res) {
  try {
    const { horseId } = req.params;

    logger.info(
      `[personalityEvolutionController.evolveHorseTemperamentController] Processing horse evolution for ID: ${horseId}`,
    );

    const result = await evolveHorseTemperament(parseInt(horseId));

    res.status(200).json({
      success: true,
      message: result.temperamentEvolved
        ? 'Horse temperament evolution completed successfully'
        : 'Horse temperament evolution not triggered',
      data: result,
    });
  } catch (error) {
    logger.error(
      `[personalityEvolutionController.evolveHorseTemperamentController] Error: ${error.message}`,
    );
    res.status(500).json({
      success: false,
      message: 'Failed to process horse temperament evolution',
      error: error.message,
    });
  }
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

/**
 * Batch process personality evolution for multiple entities
 * POST /api/personality-evolution/batch-evolve
 *
 * Equoria-bvddn.4 (audit 2026-09-25): this previously evolved ANY entityId
 * the caller passed with no ownership check at all — the single-horse/groom
 * `/evolve` routes gate through `requireOwnership`, but batch-evolve called
 * `evolveGroomPersonality`/`evolveHorseTemperament` directly. Those functions
 * persist unconditionally (personalityEvolutionSystem.mjs:201 writes
 * `horse.temperament` with no owner filter), so a player could rewrite a
 * victim horse's temperament (or read a victim groom's care-quality data via
 * the returned `result`) by naming any id they didn't own.
 *
 * Fix mirrors the batch-ownership pattern already used by
 * traitDiscoveryRoutes.mjs POST /discover/batch: validate ownership for both
 * entity types up front with `validateBatchOwnership` (one IN-clause query
 * per type instead of N `requireOwnership` round trips), then only evolve
 * entities the caller owns. A foreign or nonexistent id is never evolved and
 * gets the SAME generic message this controller already uses for the
 * single-entity 404s (`notFoundOrNotYours`) — CWE-639: it cannot be told
 * apart from "doesn't exist", so batch-evolve cannot be used as an ownership
 * oracle. An invalid `entityType` (defense in depth; the route's
 * express-validator `isIn(['groom','horse'])` already rejects this over
 * HTTP) keeps its original per-item "Invalid entity type" result untouched.
 */
export async function batchEvolvePersonalitiesController(req, res) {
  try {
    const { entities } = req.body;
    const userId = req.user?.id;

    if (!Array.isArray(entities) || entities.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Entities array is required and must not be empty',
      });
    }

    logger.info(
      `[personalityEvolutionController.batchEvolvePersonalitiesController] Processing batch evolution for ${entities.length} entities`,
    );

    const groomIds = [
      ...new Set(
        entities
          .filter(e => e.entityType === 'groom')
          .map(e => parseInt(e.entityId, 10))
          .filter(id => !Number.isNaN(id)),
      ),
    ];
    const horseIds = [
      ...new Set(
        entities
          .filter(e => e.entityType === 'horse')
          .map(e => parseInt(e.entityId, 10))
          .filter(id => !Number.isNaN(id)),
      ),
    ];

    const [ownedGrooms, ownedHorses] = await Promise.all([
      groomIds.length ? validateBatchOwnership('groom', groomIds, userId) : [],
      horseIds.length ? validateBatchOwnership('horse', horseIds, userId) : [],
    ]);
    const ownedGroomIds = new Set(ownedGrooms.map(g => g.id));
    const ownedHorseIds = new Set(ownedHorses.map(h => h.id));

    const results = [];

    for (const entity of entities) {
      if (entity.entityType !== 'groom' && entity.entityType !== 'horse') {
        results.push({
          entityId: entity.entityId,
          entityType: entity.entityType,
          result: { success: false, error: 'Invalid entity type' },
        });
        continue;
      }

      const entityId = parseInt(entity.entityId, 10);
      const owned =
        entity.entityType === 'groom' ? ownedGroomIds.has(entityId) : ownedHorseIds.has(entityId);

      if (!owned) {
        results.push({
          entityId: entity.entityId,
          entityType: entity.entityType,
          result: { success: false, error: notFoundOrNotYours(entity.entityType) },
        });
        continue;
      }

      try {
        const result =
          entity.entityType === 'groom'
            ? await evolveGroomPersonality(entityId)
            : await evolveHorseTemperament(entityId);

        results.push({
          entityId: entity.entityId,
          entityType: entity.entityType,
          result,
        });
      } catch (error) {
        results.push({
          entityId: entity.entityId,
          entityType: entity.entityType,
          result: { success: false, error: error.message },
        });
      }
    }

    const successCount = results.filter(r => r.result.success).length;
    const evolutionCount = results.filter(
      r => r.result.personalityEvolved || r.result.temperamentEvolved,
    ).length;

    res.status(200).json({
      success: true,
      message: `Batch evolution completed. ${successCount}/${entities.length} processed successfully, ${evolutionCount} evolved`,
      data: {
        results,
        summary: {
          total: entities.length,
          successful: successCount,
          evolved: evolutionCount,
          failed: entities.length - successCount,
        },
      },
    });
  } catch (error) {
    logger.error(
      `[personalityEvolutionController.batchEvolvePersonalitiesController] Error: ${error.message}`,
    );
    res.status(500).json({
      success: false,
      message: 'Failed to process batch personality evolution',
      error: error.message,
    });
  }
}
