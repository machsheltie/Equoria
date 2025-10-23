/**
 * Dynamic Compatibility Controller
 *
 * Provides API endpoints for advanced real-time compatibility analysis between groom personalities and horse temperaments.
 * Exposes the dynamic compatibility scoring system through RESTful endpoints.
 *
 * Business Rules:
 * - Real-time compatibility scoring with contextual factors
 * - Environmental and situational modifiers
 * - Historical performance integration and learning
 * - Adaptive scoring based on interaction outcomes
 * - Multi-factor compatibility analysis
 * - Predictive compatibility modeling
 */

import logger from '../utils/logger.mjs';
import {
  calculateDynamicCompatibility,
  analyzeCompatibilityFactors,
  predictInteractionOutcome,
  updateCompatibilityHistory,
  getOptimalGroomRecommendations,
  analyzeCompatibilityTrends,
} from '../services/dynamicCompatibilityScoring.mjs';

/**
 * Calculate dynamic compatibility between a groom and horse
 * POST /api/compatibility/calculate
 */
export async function calculateCompatibility(req, res) {
  try {
    const { groomId, horseId, context } = req.body;

    logger.info(`[dynamicCompatibilityController.calculateCompatibility] Calculating compatibility for groom ${groomId} and horse ${horseId}`);

    // Validate required fields
    if (!groomId || !horseId || !context) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: groomId, horseId, and context are required',
      });
    }

    // Calculate dynamic compatibility
    const compatibility = await calculateDynamicCompatibility(groomId, horseId, context);

    logger.info(`[dynamicCompatibilityController.calculateCompatibility] Compatibility calculated: ${compatibility.overallScore.toFixed(3)} (${compatibility.recommendationLevel})`);

    res.json({
      success: true,
      message: 'Dynamic compatibility calculated successfully',
      data: compatibility,
    });

  } catch (error) {
    logger.error('[dynamicCompatibilityController.calculateCompatibility] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate dynamic compatibility',
      error: error.message,
    });
  }
}

/**
 * Analyze detailed compatibility factors
 * GET /api/compatibility/factors/:groomId/:horseId
 */
export async function getCompatibilityFactors(req, res) {
  try {
    const { groomId, horseId } = req.params;

    logger.info(`[dynamicCompatibilityController.getCompatibilityFactors] Analyzing factors for groom ${groomId} and horse ${horseId}`);

    const factors = await analyzeCompatibilityFactors(parseInt(groomId), parseInt(horseId));

    logger.info(`[dynamicCompatibilityController.getCompatibilityFactors] Factors analyzed: ${factors.overallAssessment.rating} compatibility`);

    res.json({
      success: true,
      message: 'Compatibility factors analyzed successfully',
      data: factors,
    });

  } catch (error) {
    logger.error('[dynamicCompatibilityController.getCompatibilityFactors] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze compatibility factors',
      error: error.message,
    });
  }
}

/**
 * Predict interaction outcome
 * POST /api/compatibility/predict
 */
export async function predictOutcome(req, res) {
  try {
    const { groomId, horseId, context } = req.body;

    logger.info(`[dynamicCompatibilityController.predictOutcome] Predicting outcome for groom ${groomId} and horse ${horseId}`);

    // Validate required fields
    if (!groomId || !horseId || !context) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: groomId, horseId, and context are required',
      });
    }

    const prediction = await predictInteractionOutcome(groomId, horseId, context);

    logger.info(`[dynamicCompatibilityController.predictOutcome] Outcome predicted: ${prediction.predictedQuality} quality, ${prediction.successProbability.toFixed(2)} success probability`);

    res.json({
      success: true,
      message: 'Interaction outcome predicted successfully',
      data: prediction,
    });

  } catch (error) {
    logger.error('[dynamicCompatibilityController.predictOutcome] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to predict interaction outcome',
      error: error.message,
    });
  }
}

/**
 * Get optimal groom recommendations for a horse
 * POST /api/compatibility/recommendations
 */
export async function getRecommendations(req, res) {
  try {
    const { horseId, context } = req.body;

    logger.info(`[dynamicCompatibilityController.getRecommendations] Getting recommendations for horse ${horseId}`);

    // Validate required fields
    if (!horseId || !context) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: horseId and context are required',
      });
    }

    const recommendations = await getOptimalGroomRecommendations(horseId, context);

    logger.info(`[dynamicCompatibilityController.getRecommendations] Found ${recommendations.rankedGrooms.length} groom recommendations`);

    res.json({
      success: true,
      message: 'Groom recommendations generated successfully',
      data: recommendations,
    });

  } catch (error) {
    logger.error('[dynamicCompatibilityController.getRecommendations] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate groom recommendations',
      error: error.message,
    });
  }
}

/**
 * Analyze compatibility trends over time
 * GET /api/compatibility/trends/:groomId/:horseId
 */
export async function getCompatibilityTrends(req, res) {
  try {
    const { groomId, horseId } = req.params;

    logger.info(`[dynamicCompatibilityController.getCompatibilityTrends] Analyzing trends for groom ${groomId} and horse ${horseId}`);

    const trends = await analyzeCompatibilityTrends(parseInt(groomId), parseInt(horseId));

    logger.info(`[dynamicCompatibilityController.getCompatibilityTrends] Trends analyzed: ${trends.overallTrend} trend with ${trends.dataPoints} data points`);

    res.json({
      success: true,
      message: 'Compatibility trends analyzed successfully',
      data: trends,
    });

  } catch (error) {
    logger.error('[dynamicCompatibilityController.getCompatibilityTrends] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze compatibility trends',
      error: error.message,
    });
  }
}

/**
 * Update compatibility history with interaction results
 * POST /api/compatibility/history/update
 */
export async function updateHistory(req, res) {
  try {
    const { groomId, horseId, interactionId } = req.body;

    logger.info(`[dynamicCompatibilityController.updateHistory] Updating history for groom ${groomId}, horse ${horseId}, interaction ${interactionId}`);

    // Validate required fields
    if (!groomId || !horseId || !interactionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: groomId, horseId, and interactionId are required',
      });
    }

    const result = await updateCompatibilityHistory(groomId, horseId, interactionId);

    logger.info(`[dynamicCompatibilityController.updateHistory] History updated: ${result.compatibilityTrend} trend, ${result.totalInteractions} total interactions`);

    res.json({
      success: true,
      message: 'Compatibility history updated successfully',
      data: result,
    });

  } catch (error) {
    logger.error('[dynamicCompatibilityController.updateHistory] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update compatibility history',
      error: error.message,
    });
  }
}

/**
 * Get compatibility system configuration and definitions
 * GET /api/compatibility/config
 */
export async function getCompatibilityConfig(req, res) {
  try {
    logger.info('[dynamicCompatibilityController.getCompatibilityConfig] Getting compatibility system configuration');

    const config = {
      personalityTypes: ['calm', 'energetic', 'methodical'],
      temperamentTypes: ['nervous', 'fearful', 'reactive', 'confident', 'developing', 'outgoing', 'curious', 'complex'],
      taskTypes: ['trust_building', 'desensitization', 'hoof_handling', 'showground_exposure', 'sponge_bath'],
      environmentalFactors: ['quiet', 'noisy', 'familiar', 'unfamiliar', 'structured', 'chaotic', 'stimulating'],
      timeOfDayOptions: ['morning', 'afternoon', 'evening'],
      recommendationLevels: ['highly_recommended', 'recommended', 'acceptable', 'not_recommended'],
      qualityLevels: ['poor', 'fair', 'good', 'excellent'],
      trendTypes: ['improving', 'stable', 'declining', 'insufficient_data'],
    };

    res.json({
      success: true,
      message: 'Compatibility system configuration retrieved successfully',
      data: config,
    });

  } catch (error) {
    logger.error('[dynamicCompatibilityController.getCompatibilityConfig] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get compatibility configuration',
      error: error.message,
    });
  }
}
