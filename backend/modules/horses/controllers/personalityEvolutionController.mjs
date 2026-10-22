/**
 * Personality Evolution Controller
 *
 * Read-only analysis endpoints for a HORSE's temperament: evolution triggers,
 * stability, prediction and history.
 *
 * - No handler here changes a horse's temperament (Equoria-gu8jk; owner ruling
 *   2026-10-20: players must never write traits for themselves). The
 *   evolveHorseTemperamentController and batchEvolvePersonalitiesController
 *   handlers were removed with their routes.
 * - There is no groom personality evolution (Equoria-jy3f7, Equoria-j5qui;
 *   owner ruling 2026-10-22: groom personalities never evolve; a groom keeps
 *   the same personality for its whole career). The groom evolve handler went
 *   in jy3f7; the groom branches of these four read handlers went in j5qui,
 *   and their routes now serve horses only.
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
 * One message for both "no such horse" and "not your horse", so the endpoint
 * cannot be used as an existence oracle (CWE-639, the convention this codebase
 * already holds).
 */
const notFoundOrNotYoursMessage = 'Horse not found or you do not own this horse';

/**
 * Resolve the caller's horse from :horseId. Sends the 404 and returns null
 * when the horse is missing or not the caller's.
 */
async function ownedHorseIdOr404(req, res) {
  const horseId = parseInt(req.params.horseId, 10);
  const horse = await findOwnedResource('horse', horseId, req.user.id);
  if (!horse) {
    res.status(404).json({ success: false, message: notFoundOrNotYoursMessage });
    return null;
  }
  return horseId;
}

/**
 * Calculate temperament evolution triggers for a horse
 * GET /api/personality-evolution/horse/:horseId/triggers
 */
export async function getEvolutionTriggersController(req, res) {
  try {
    logger.info(
      `[personalityEvolutionController.getEvolutionTriggersController] Analyzing triggers for horse ID: ${req.params.horseId}`,
    );

    const horseId = await ownedHorseIdOr404(req, res);
    if (horseId === null) {
      return;
    }

    const result = await calculatePersonalityEvolutionTriggers(horseId);

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
 * Analyze temperament stability for a horse
 * GET /api/personality-evolution/horse/:horseId/stability
 */
export async function getPersonalityStabilityController(req, res) {
  try {
    logger.info(
      `[personalityEvolutionController.getPersonalityStabilityController] Analyzing stability for horse ID: ${req.params.horseId}`,
    );

    const horseId = await ownedHorseIdOr404(req, res);
    if (horseId === null) {
      return;
    }

    const result = await analyzePersonalityStability(horseId);

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
 * Predict future temperament evolution for a horse
 * GET /api/personality-evolution/horse/:horseId/predict
 */
export async function predictPersonalityEvolutionController(req, res) {
  try {
    const { timeframeDays = 30 } = req.query;

    const timeframe = parseInt(timeframeDays);
    if (isNaN(timeframe) || timeframe < 1 || timeframe > 365) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timeframe. Must be between 1 and 365 days',
      });
    }

    logger.info(
      `[personalityEvolutionController.predictPersonalityEvolutionController] Predicting evolution for horse ID: ${req.params.horseId} over ${timeframe} days`,
    );

    const horseId = await ownedHorseIdOr404(req, res);
    if (horseId === null) {
      return;
    }

    const result = await predictPersonalityEvolution(horseId, timeframe);

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
 * Get temperament evolution history for a horse
 * GET /api/personality-evolution/horse/:horseId/history
 */
export async function getPersonalityEvolutionHistoryController(req, res) {
  try {
    logger.info(
      `[personalityEvolutionController.getPersonalityEvolutionHistoryController] Getting evolution history for horse ID: ${req.params.horseId}`,
    );

    const horseId = await ownedHorseIdOr404(req, res);
    if (horseId === null) {
      return;
    }

    const result = await getPersonalityEvolutionHistory(horseId);

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
