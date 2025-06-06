/**
 * Trait Management Controller
 * Handles trait discovery, revelation, and management operations
 */

import { revealTraits } from '../utils/traitDiscovery.mjs';
import { getTraitDefinition, getTraitsByType } from '../utils/epigeneticTraits.mjs';
import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

/**
 * POST /api/traits/discover/:horseId
 * Trigger trait discovery for a specific horse
 */
export async function discoverTraits(req, res) {
  try {
    const { horseId } = req.params;
    const { checkEnrichment = true, forceCheck = false } = req.body;

    // Validate horse ID
    const parsedHorseId = parseInt(horseId, 10);
    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
        data: null,
      });
    }

    logger.info(
      `[traitController.discoverTraits] Triggering trait discovery for horse ${parsedHorseId}`,
    );

    // Check if horse exists
    const horse = await prisma.horse.findUnique({
      where: { id: parsedHorseId },
      select: { id: true, name: true },
    });

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    // Perform trait discovery
    const discoveryResult = await revealTraits(parsedHorseId, {
      checkEnrichment,
      forceCheck,
    });

    // Log discovery event
    if (discoveryResult.revealed.length > 0) {
      logger.info(
        `[traitController.discoverTraits] Discovered ${discoveryResult.revealed.length} traits for horse ${parsedHorseId} (${horse.name})`,
      );
    }

    res.status(200).json({
      success: true,
      message: discoveryResult.message,
      data: {
        horseId: parsedHorseId,
        horseName: horse.name,
        ...discoveryResult,
      },
    });
  } catch (error) {
    logger.error(`[traitController.discoverTraits] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to discover traits',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * GET /api/traits/horse/:horseId
 * Get all traits for a specific horse
 */
export async function getHorseTraits(req, res) {
  try {
    const { horseId } = req.params;

    // Validate horse ID
    const parsedHorseId = parseInt(horseId, 10);
    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
        data: null,
      });
    }

    logger.info(`[traitController.getHorseTraits] Getting traits for horse ${parsedHorseId}`);

    // Get horse with traits
    const horse = await prisma.horse.findUnique({
      where: { id: parsedHorseId },
      select: {
        id: true,
        name: true,
        epigenetic_modifiers: true,
        bond_score: true,
        stress_level: true,
        age: true,
      },
    });

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    // Parse and enhance traits with definitions
    const traits = horse.epigenetic_modifiers || { positive: [], negative: [], hidden: [] };

    const enhancedTraits = {
      positive:
        traits.positive?.map(trait => ({
          name: trait,
          definition: getTraitDefinition(trait),
        })) || [],
      negative:
        traits.negative?.map(trait => ({
          name: trait,
          definition: getTraitDefinition(trait),
        })) || [],
      hidden:
        traits.hidden?.map(trait => ({
          name: trait,
          definition: getTraitDefinition(trait),
        })) || [],
    };

    res.status(200).json({
      success: true,
      message: `Retrieved traits for horse ${horse.name}`,
      data: {
        horseId: parsedHorseId,
        horseName: horse.name,
        bondScore: horse.bond_score,
        stressLevel: horse.stress_level,
        age: horse.age,
        traits: enhancedTraits,
        summary: {
          totalTraits:
            enhancedTraits.positive.length +
            enhancedTraits.negative.length +
            enhancedTraits.hidden.length,
          visibleTraits: enhancedTraits.positive.length + enhancedTraits.negative.length,
          hiddenTraits: enhancedTraits.hidden.length,
        },
      },
    });
  } catch (error) {
    logger.error(`[traitController.getHorseTraits] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve horse traits',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * GET /api/traits/definitions
 * Get all available trait definitions
 */
export async function getTraitDefinitions(req, res) {
  try {
    const { type } = req.query;

    logger.info(
      `[traitController.getTraitDefinitions] Getting trait definitions${type ? ` for type: ${type}` : ''}`,
    );

    let traits;
    if (type && ['positive', 'negative'].includes(type)) {
      traits = getTraitsByType(type);
    } else {
      traits = getTraitsByType('all');
    }

    // Enhance with full definitions
    const definitions = traits.reduce((acc, trait) => {
      const definition = getTraitDefinition(trait);
      if (definition) {
        acc[trait] = {
          name: trait,
          ...definition,
        };
      }
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      message: `Retrieved ${Object.keys(definitions).length} trait definitions`,
      data: {
        traits: definitions,
        count: Object.keys(definitions).length,
        filter: type || 'all',
      },
    });
  } catch (error) {
    logger.error(`[traitController.getTraitDefinitions] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve trait definitions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * GET /api/traits/discovery-status/:horseId
 * Get discovery status and conditions for a horse
 */
export async function getDiscoveryStatus(req, res) {
  try {
    const { horseId } = req.params;

    // Validate horse ID
    const parsedHorseId = parseInt(horseId, 10);
    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
        data: null,
      });
    }

    logger.info(
      `[traitController.getDiscoveryStatus] Getting discovery status for horse ${parsedHorseId}`,
    );

    // Get horse data
    const horse = await prisma.horse.findUnique({
      where: { id: parsedHorseId },
      include: {
        foalActivities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    // Import discovery functions
    const { checkDiscoveryConditions, checkEnrichmentDiscoveries } = await import(
      '../utils/traitDiscovery.js'
    );

    // Check current conditions
    const metConditions = await checkDiscoveryConditions(horse);
    const enrichmentConditions = checkEnrichmentDiscoveries(horse.foalActivities || []);

    const traits = horse.epigenetic_modifiers || { positive: [], negative: [], hidden: [] };

    res.status(200).json({
      success: true,
      message: `Discovery status for horse ${horse.name}`,
      data: {
        horseId: parsedHorseId,
        horseName: horse.name,
        currentStats: {
          bondScore: horse.bond_score,
          stressLevel: horse.stress_level,
          age: horse.age,
        },
        traitCounts: {
          visible: (traits.positive?.length || 0) + (traits.negative?.length || 0),
          hidden: traits.hidden?.length || 0,
        },
        discoveryConditions: {
          met: metConditions,
          enrichment: enrichmentConditions,
          total: metConditions.length + enrichmentConditions.length,
        },
        canDiscover:
          metConditions.length + enrichmentConditions.length > 0 &&
          (traits.hidden?.length || 0) > 0,
      },
    });
  } catch (error) {
    logger.error(`[traitController.getDiscoveryStatus] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get discovery status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * POST /api/traits/batch-discover
 * Trigger trait discovery for multiple horses
 */
export async function batchDiscoverTraits(req, res) {
  try {
    const { horseIds, checkEnrichment = true } = req.body;

    // Validate input
    if (!Array.isArray(horseIds) || horseIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'horseIds must be a non-empty array',
        data: null,
      });
    }

    if (horseIds.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 horses can be processed at once',
        data: null,
      });
    }

    logger.info(
      `[traitController.batchDiscoverTraits] Processing batch discovery for ${horseIds.length} horses`,
    );

    const results = [];
    const errors = [];

    // Process each horse
    for (const horseId of horseIds) {
      try {
        const parsedHorseId = parseInt(horseId, 10);
        if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
          errors.push({ horseId, error: 'Invalid horse ID' });
          continue;
        }

        const discoveryResult = await revealTraits(parsedHorseId, { checkEnrichment });
        results.push({
          horseId: parsedHorseId,
          ...discoveryResult,
        });
      } catch (error) {
        logger.error(
          `[traitController.batchDiscoverTraits] Error processing horse ${horseId}: ${error.message}`,
        );
        errors.push({ horseId, error: error.message });
      }
    }

    const totalRevealed = results.reduce((sum, result) => sum + (result.revealed?.length || 0), 0);

    res.status(200).json({
      success: true,
      message: `Batch discovery completed. Revealed ${totalRevealed} traits across ${results.length} horses.`,
      data: {
        results,
        errors,
        summary: {
          processed: results.length,
          failed: errors.length,
          totalRevealed,
        },
      },
    });
  } catch (error) {
    logger.error(`[traitController.batchDiscoverTraits] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to process batch discovery',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}
