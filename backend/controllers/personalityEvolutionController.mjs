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

import logger from '../utils/logger.mjs';
import { findOwnedResource } from '../middleware/ownership.mjs';
import {
  evolveGroomPersonality,
  evolveHorseTemperament,
  calculatePersonalityEvolutionTriggers,
  analyzePersonalityStability,
  predictPersonalityEvolution,
  getPersonalityEvolutionHistory,
  applyPersonalityEvolutionEffects,
} from '../services/personalityEvolutionSystem.mjs';

/**
 * Evolve groom personality based on interaction patterns
 * POST /api/personality-evolution/groom/:groomId/evolve
 */
export async function evolveGroomPersonalityController(req, res) {
  try {
    const { groomId } = req.params;

    logger.info(`[personalityEvolutionController.evolveGroomPersonalityController] Processing groom evolution for ID: ${groomId}`);

    const result = await evolveGroomPersonality(parseInt(groomId));

    res.status(200).json({
      success: true,
      message: result.personalityEvolved
        ? 'Groom personality evolution completed successfully'
        : 'Groom personality evolution not triggered',
      data: result,
    });

  } catch (error) {
    logger.error(`[personalityEvolutionController.evolveGroomPersonalityController] Error: ${error.message}`);
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

    logger.info(`[personalityEvolutionController.evolveHorseTemperamentController] Processing horse evolution for ID: ${horseId}`);

    const result = await evolveHorseTemperament(parseInt(horseId));

    res.status(200).json({
      success: true,
      message: result.temperamentEvolved
        ? 'Horse temperament evolution completed successfully'
        : 'Horse temperament evolution not triggered',
      data: result,
    });

  } catch (error) {
    logger.error(`[personalityEvolutionController.evolveHorseTemperamentController] Error: ${error.message}`);
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

    logger.info(`[personalityEvolutionController.getEvolutionTriggersController] Analyzing triggers for ${entityType} ID: ${entityId}`);

    // Validate entity ownership (atomic)
    const entity = await findOwnedResource(entityType, parseInt(entityId), userId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} not found or you do not own this ${entityType}`,
      });
    }

    const result = await calculatePersonalityEvolutionTriggers(parseInt(entityId), entityType);

    res.status(200).json({
      success: true,
      message: 'Evolution triggers calculated successfully',
      data: result,
    });

  } catch (error) {
    logger.error(`[personalityEvolutionController.getEvolutionTriggersController] Error: ${error.message}`);
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

    logger.info(`[personalityEvolutionController.getPersonalityStabilityController] Analyzing stability for ${entityType} ID: ${entityId}`);

    // Validate entity ownership (atomic)
    const entity = await findOwnedResource(entityType, parseInt(entityId), userId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} not found or you do not own this ${entityType}`,
      });
    }

    const result = await analyzePersonalityStability(parseInt(entityId), entityType);

    res.status(200).json({
      success: true,
      message: 'Personality stability analyzed successfully',
      data: result,
    });

  } catch (error) {
    logger.error(`[personalityEvolutionController.getPersonalityStabilityController] Error: ${error.message}`);
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

    logger.info(`[personalityEvolutionController.predictPersonalityEvolutionController] Predicting evolution for ${entityType} ID: ${entityId} over ${timeframe} days`);

    // Validate entity ownership (atomic)
    const entity = await findOwnedResource(entityType, parseInt(entityId), userId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} not found or you do not own this ${entityType}`,
      });
    }

    const result = await predictPersonalityEvolution(parseInt(entityId), entityType, timeframe);

    res.status(200).json({
      success: true,
      message: 'Personality evolution prediction completed successfully',
      data: result,
    });

  } catch (error) {
    logger.error(`[personalityEvolutionController.predictPersonalityEvolutionController] Error: ${error.message}`);
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

    logger.info(`[personalityEvolutionController.getPersonalityEvolutionHistoryController] Getting evolution history for ${entityType} ID: ${entityId}`);

    // Validate entity ownership (atomic)
    const entity = await findOwnedResource(entityType, parseInt(entityId), userId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} not found or you do not own this ${entityType}`,
      });
    }

    const result = await getPersonalityEvolutionHistory(parseInt(entityId), entityType);

    res.status(200).json({
      success: true,
      message: 'Personality evolution history retrieved successfully',
      data: result,
    });

  } catch (error) {
    logger.error(`[personalityEvolutionController.getPersonalityEvolutionHistoryController] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve personality evolution history',
      error: error.message,
    });
  }
}

/**
 * Apply personality evolution effects manually (admin function)
 * POST /api/personality-evolution/apply-effects
 */
export async function applyPersonalityEvolutionEffectsController(req, res) {
  try {
    const evolutionData = req.body;

    // Validate required fields
    const requiredFields = ['entityId', 'entityType', 'evolutionType'];
    const missingFields = requiredFields.filter(field => !evolutionData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    if (!['groom', 'horse'].includes(evolutionData.entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be "groom" or "horse"',
      });
    }

    logger.info(`[personalityEvolutionController.applyPersonalityEvolutionEffectsController] Applying evolution effects for ${evolutionData.entityType} ID: ${evolutionData.entityId}`);

    const result = await applyPersonalityEvolutionEffects(evolutionData);

    res.status(200).json({
      success: true,
      message: 'Personality evolution effects applied successfully',
      data: result,
    });

  } catch (error) {
    logger.error(`[personalityEvolutionController.applyPersonalityEvolutionEffectsController] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to apply personality evolution effects',
      error: error.message,
    });
  }
}

/**
 * Batch process personality evolution for multiple entities
 * POST /api/personality-evolution/batch-evolve
 */
export async function batchEvolvePersonalitiesController(req, res) {
  try {
    const { entities } = req.body;

    if (!Array.isArray(entities) || entities.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Entities array is required and must not be empty',
      });
    }

    logger.info(`[personalityEvolutionController.batchEvolvePersonalitiesController] Processing batch evolution for ${entities.length} entities`);

    const results = [];

    for (const entity of entities) {
      try {
        let result;
        if (entity.entityType === 'groom') {
          result = await evolveGroomPersonality(entity.entityId);
        } else if (entity.entityType === 'horse') {
          result = await evolveHorseTemperament(entity.entityId);
        } else {
          result = { success: false, error: 'Invalid entity type' };
        }

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
    const evolutionCount = results.filter(r => r.result.personalityEvolved || r.result.temperamentEvolved).length;

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
    logger.error(`[personalityEvolutionController.batchEvolvePersonalitiesController] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to process batch personality evolution',
      error: error.message,
    });
  }
}
