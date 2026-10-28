/**
 * Trait Management Controller
 * Read-only trait handlers: a horse's traits, trait definitions and discovery
 * status.
 *
 * The discoverTraits / batchDiscoverTraits handlers were removed with their
 * routes (Equoria-gu8jk; owner ruling 2026-10-20: players must never write
 * traits for themselves).
 */

import { getTraitsByType, playerTraitDefinition } from '../../../utils/epigeneticTraits.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { getCachedQuery, generateCacheKey } from '../../../utils/cacheHelper.mjs';
import {
  dormantTraitKeys,
  publicTraitModifiers,
  visibleTraitKeys,
} from '../../../utils/publicTraitView.mjs';
import { markTraitsSeen, seenTraitKeys } from '../services/traitSeenService.mjs';

// TTL constants (in seconds)
const TRAIT_DEFINITIONS_TTL = 600; // 10 minutes — static reference data

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

    // Horse ownership already validated by requireOwnership middleware
    // Fetch full horse data with needed fields (ownership check already done by middleware)
    const horse = await prisma.horse.findUnique({
      where: { id: parsedHorseId },
      select: {
        id: true,
        name: true,
        epigeneticModifiers: true,
        bondScore: true,
        age: true,
      },
    });

    if (!horse) {
      logger.error(
        `[traitController.getHorseTraits] Horse ${parsedHorseId} not found after middleware validation`,
      );
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    // Visible traits with definitions; unrevealed hidden traits are a count
    // only, never named, to anyone (Equoria-6dace).
    const traits = publicTraitModifiers(horse.epigeneticModifiers);
    // First-view glow (Equoria-lylhb): a revealed trait is `isNew` until this
    // viewer's private seen marker covers it. Never set for a hidden trait,
    // which is not in this list at all.
    const viewer = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { settings: true },
    });
    const seen = seenTraitKeys(viewer?.settings, parsedHorseId);
    // Players never see a trait's rarity (owner ruling 2026-10-27, q112).
    const withDefinition = trait => ({
      name: trait,
      definition: playerTraitDefinition(trait),
      isNew: !seen.has(trait),
    });

    // Dormant traits are revealed and switched off: named, greyed out on the
    // horse page (owner ruling q213, 2026-10-28). Seen before they went
    // dormant, so they never glow.
    const enhancedTraits = {
      positive: traits.positive.map(withDefinition),
      negative: traits.negative.map(withDefinition),
      dormant: dormantTraitKeys(horse.epigeneticModifiers).map(trait => ({
        ...withDefinition(trait),
        isNew: false,
      })),
      hiddenCount: traits.hiddenCount,
    };
    const visibleCount =
      enhancedTraits.positive.length +
      enhancedTraits.negative.length +
      enhancedTraits.dormant.length;

    res.status(200).json({
      success: true,
      message: `Retrieved traits for horse ${horse.name}`,
      data: {
        horseId: parsedHorseId,
        horseName: horse.name,
        bondScore: horse.bondScore,
        age: horse.age,
        traits: enhancedTraits,
        summary: {
          totalTraits: visibleCount + traits.hiddenCount,
          visibleTraits: visibleCount,
          hiddenTraits: traits.hiddenCount,
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
 * POST /api/traits/horse/:horseId/seen
 * Record that the owner has now viewed this horse's revealed traits, so each
 * glows only once (Equoria-lylhb). Writes only the viewer's private marker.
 */
export async function markHorseTraitsSeen(req, res) {
  try {
    const parsedHorseId = parseInt(req.params.horseId, 10);
    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
        data: null,
      });
    }

    // Ownership already validated by requireOwnership middleware.
    const horse = await prisma.horse.findUnique({
      where: { id: parsedHorseId },
      select: { epigeneticModifiers: true },
    });
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found', data: null });
    }

    const affected = await markTraitsSeen(
      prisma,
      req.user.id,
      parsedHorseId,
      visibleTraitKeys(horse.epigeneticModifiers),
    );
    if (affected === 0) {
      return res.status(404).json({ success: false, message: 'Player not found', data: null });
    }

    return res.status(200).json({ success: true, message: 'Traits marked as seen', data: null });
  } catch (error) {
    logger.error(`[traitController.markHorseTraitsSeen] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to record seen traits',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * GET /api/traits/definitions
 * Get all available trait definitions
 * Cached for 10 minutes — trait definitions are static reference data
 */
export async function getTraitDefinitions(req, res) {
  try {
    const { type, fields } = req.query;

    logger.info(
      `[traitController.getTraitDefinitions] Getting trait definitions${type ? ` for type: ${type}` : ''}`,
    );

    // Determine field selection (comma-separated: e.g. ?fields=name,description,effects)
    const selectedFields = fields ? fields.split(',').map(f => f.trim()) : null;

    const cacheKey = generateCacheKey('traits:definitions', type || 'all', fields || 'all-fields');

    const data = await getCachedQuery(
      cacheKey,
      async () => {
        let traits;
        if (type && ['positive', 'negative'].includes(type)) {
          traits = getTraitsByType(type);
        } else {
          traits = getTraitsByType('all');
        }

        // Enhance with the player view of each definition: never the rarity
        // (owner ruling 2026-10-27, q112). Admin tooling keeps it.
        const definitions = traits.reduce((acc, trait) => {
          const definition = playerTraitDefinition(trait);
          if (definition) {
            const fullDef = { name: trait, ...definition };
            // Apply field selection if requested
            if (selectedFields) {
              acc[trait] = selectedFields.reduce((selected, field) => {
                if (field in fullDef) {
                  selected[field] = fullDef[field];
                }
                return selected;
              }, {});
            } else {
              acc[trait] = fullDef;
            }
          }
          return acc;
        }, {});

        return {
          traits: definitions,
          count: Object.keys(definitions).length,
          filter: type || 'all',
        };
      },
      TRAIT_DEFINITIONS_TTL,
    );

    // Equoria-cmw85.28: static reference data, so HTTP caching is opted in.
    res.locals.cacheable = { maxAge: 300 };
    res.status(200).json({
      success: true,
      message: `Retrieved ${data.count} trait definitions`,
      data,
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

    // Horse ownership already validated by requireOwnership middleware
    // Fetch full horse data with needed fields (ownership check already done by middleware)
    const horse = await prisma.horse.findUnique({
      where: { id: parsedHorseId },
    });

    if (!horse) {
      logger.error(
        `[traitController.getDiscoveryStatus] Horse ${parsedHorseId} not found after middleware validation`,
      );
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    // Import discovery functions
    const { checkDiscoveryConditions } = await import('../../../utils/traitDiscovery.mjs');

    // Check current conditions. There is no enrichment discovery list
    // (Equoria-ecp0i; owner ruling 2026-10-16: the player-run enrichment
    // activities it counted no longer exist).
    const metConditions = await checkDiscoveryConditions(horse);

    const traits = horse.epigeneticModifiers || { positive: [], negative: [], hidden: [] };

    res.status(200).json({
      success: true,
      message: `Discovery status for horse ${horse.name}`,
      data: {
        horseId: parsedHorseId,
        horseName: horse.name,
        currentStats: {
          bondScore: horse.bondScore || 0,
          age: horse.age,
        },
        traitCounts: {
          visible: (traits.positive?.length || 0) + (traits.negative?.length || 0),
          hidden: traits.hidden?.length || 0,
        },
        discoveryConditions: {
          met: metConditions,
          total: metConditions.length,
        },
        canDiscover: metConditions.length > 0 && (traits.hidden?.length || 0) > 0,
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
