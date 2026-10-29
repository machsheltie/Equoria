/**
 * Epigenetic Flag Controller
 * API endpoints for epigenetic flag evaluation and management
 *
 * 🎯 PURPOSE:
 * Provides REST API endpoints for the flag definitions (names, labels,
 * polarity) and a horse's care-pattern analysis. Nothing here evaluates or
 * assigns a flag.
 *
 * 📋 BUSINESS RULES:
 * - No endpoint assigns flags (Equoria-gu8jk, Equoria-a7f1p); the weekly flag
 *   job was retired too (Equoria-koxep): traits change only through the
 *   grooming-day reveal ladder
 * - GET /horses/:id/flags, which showed the old epigeneticFlags store, was
 *   removed with the store (owner ruling 2026-10-29, q300, Equoria-efs4j)
 * - Requires authentication for all endpoints
 * - Validates horse ownership for user operations
 */

import logger from '../../../utils/logger.mjs';
import {
  getAllFlagDefinitions,
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
  getFlagDefinitions,
  getCarePatterns,
};
