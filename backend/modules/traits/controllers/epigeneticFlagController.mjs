/**
 * Epigenetic Flag Controller
 * API endpoints for epigenetic flag evaluation and management
 *
 * 🎯 PURPOSE:
 * Provides REST API endpoints for evaluating and retrieving epigenetic flags
 * based on care patterns and trigger conditions.
 *
 * 📋 BUSINESS RULES:
 * - No player endpoint assigns flags (Equoria-gu8jk): POST /flags/evaluate and
 *   its evaluateFlags handler were removed; the weekly flag job assigns them
 * - GET /horses/:id/flags - Get all flags for a horse
 * - Requires authentication for all endpoints
 * - Validates horse ownership for user operations
 */

import logger from '../../../utils/logger.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';
import {
  getAllFlagDefinitions,
  getFlagDefinition,
  getFlagsByType,
} from '../../../config/epigeneticFlagDefinitions.mjs';
import { analyzeCarePatterns } from '../../../utils/carePatternAnalysis.mjs';

/**
 * The player view of one flag: its stored name, authored name and polarity.
 * No description, source or modifiers (Equoria-v6sp2, Equoria-rqz1z): no live
 * gameplay code consumed the old competition/training/bonding/trait-weight
 * modifiers, and the owner has not yet ruled what any trait does (2026-10-27,
 * q117: "Do not add what each actually does yet"), so nothing here claims an
 * effect.
 * @param {{ name: string, displayName: string, type: string }} definition
 */
const publicFlagView = definition => ({
  name: definition.name,
  displayName: definition.displayName,
  type: definition.type,
});

/**
 * Get epigenetic flags for a horse
 * GET /api/horses/:id/flags
 */
export async function getHorseFlags(req, res) {
  try {
    // Horse ownership already validated by requireOwnership middleware
    // Middleware caches validated horse in req.validatedResources
    const horse = req.validatedResources?.horse;
    if (!horse) {
      logger.error(
        '[epigeneticFlagController.getHorseFlags] Horse not found in validated resources',
      );
      return res.status(404).json({
        success: false,
        message: 'Horse not found or you do not own this horse',
      });
    }

    const _horseId = horse.id;

    // Get flag definitions for assigned flags
    const flagDetails = (horse.epigeneticFlags || []).map(flagName => {
      const definition = getFlagDefinition(flagName);
      return definition
        ? publicFlagView(definition)
        : { name: flagName, displayName: flagName, type: 'unknown' };
    });

    // Calculate horse age in canonical game-years (1 game-week = 1 game-year,
    // floor(ageDays / 7)) — consistent with horseController serializer and the
    // leaderboard /horse/:horseId route. NOT calendar-years (Equoria-8qu4).
    const ageInYears = getHorseAgeYears(horse.dateOfBirth);

    return res.status(200).json({
      success: true,
      message: 'Horse flags retrieved successfully',
      data: {
        horseId: horse.id,
        horseName: horse.name,
        ageInYears,
        currentBondScore: horse.bondScore || 0,
        flagCount: flagDetails.length,
        flags: flagDetails,
        maxFlags: 5,
        canReceiveMoreFlags: flagDetails.length < 5 && ageInYears < 3,
      },
    });
  } catch (error) {
    logger.error(`[epigeneticFlagController.getHorseFlags] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving horse flags',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Get flag definitions
 * GET /api/flags/definitions
 */
export async function getFlagDefinitions(req, res) {
  try {
    const { type } = req.query;

    let flagDefinitions;
    if (type) {
      flagDefinitions = getFlagsByType(type);
    } else {
      flagDefinitions = Object.values(getAllFlagDefinitions());
    }

    // Format for API response
    const formattedDefinitions = flagDefinitions.map(publicFlagView);

    return res.status(200).json({
      success: true,
      message: 'Flag definitions retrieved successfully',
      data: {
        count: formattedDefinitions.length,
        flags: formattedDefinitions,
      },
    });
  } catch (error) {
    logger.error(`[epigeneticFlagController.getFlagDefinitions] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving flag definitions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Get care pattern analysis for a horse (Debug/Admin)
 * GET /api/horses/:id/care-patterns
 */
export async function getCarePatterns(req, res) {
  try {
    // Horse ownership already validated by requireOwnership middleware
    // Middleware caches validated horse in req.validatedResources
    const horse = req.validatedResources?.horse;
    if (!horse) {
      logger.error(
        '[epigeneticFlagController.getCarePatterns] Horse not found in validated resources',
      );
      return res.status(404).json({
        success: false,
        message: 'Horse not found or you do not own this horse',
      });
    }

    const horseId = horse.id;

    // Analyze care patterns
    const careAnalysis = await analyzeCarePatterns(horseId);

    return res.status(200).json({
      success: true,
      message: 'Care pattern analysis retrieved successfully',
      data: careAnalysis,
    });
  } catch (error) {
    logger.error(`[epigeneticFlagController.getCarePatterns] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving care patterns',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

export default {
  getHorseFlags,
  getFlagDefinitions,
  getCarePatterns,
};
