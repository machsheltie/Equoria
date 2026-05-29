/**
 * Horse Genetics Controller
 *
 * Equoria-xod8b (child A of Equoria-mh937): extracted from horseController.mjs.
 * Owns temperament-definitions + genetics + color + breeding-color-prediction endpoints.
 * No behavior changes — functions moved verbatim.
 */
import { TEMPERAMENT_TYPES } from '../data/breedGeneticProfiles.mjs';
import {
  TEMPERAMENT_TRAINING_MODIFIERS,
  TEMPERAMENT_COMPETITION_MODIFIERS,
  TEMPERAMENT_GROOM_SYNERGY,
} from '../services/temperamentService.mjs';
import { predictBreedingColors } from '../services/breedingColorPredictionService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Canonical groom personalities — defined once at module scope (not per-request).
 */
const CANONICAL_PERSONALITIES = Object.freeze(['gentle', 'energetic', 'patient', 'strict']);

/**
 * Static descriptions and prevalence notes for all 11 temperament types.
 * Kept in the controller layer — does NOT belong in temperamentService (data separation).
 */
const TEMPERAMENT_DESCRIPTIONS = Object.freeze({
  Spirited: {
    description:
      'High-energy and excitable. Responds well to stimulation and performs impressively when engaged.',
    prevalenceNote: 'Common in hot-blooded racing and performance breeds',
  },
  Nervous: {
    description:
      'Easily startled and prone to anxiety. Requires calm, patient handling to reach full potential.',
    prevalenceNote: 'More common in sensitive light horse breeds',
  },
  Calm: {
    description:
      'Easygoing and unflappable. Performs consistently under pressure with minimal coaching.',
    prevalenceNote: 'Common in draft and stock horse breeds',
  },
  Bold: {
    description:
      'Confident and courageous. Takes on challenges without hesitation and excels in ridden competition.',
    prevalenceNote: 'Common in sport and jumping breeds',
  },
  Steady: {
    description:
      'Reliable and predictable. Rarely has exceptional or poor days — always performs as expected.',
    prevalenceNote: 'Well-distributed across working and sport horse breeds',
  },
  Independent: {
    description:
      "Self-reliant and strong-willed. Doesn't always respond to rider cues, but thinks for itself.",
    prevalenceNote: 'More common in gaited and semi-feral lineage breeds',
  },
  Reactive: {
    description:
      'Highly attuned to the environment. Quick to respond but easily distracted during training.',
    prevalenceNote: 'Common in Arabians and sensitive hot-blood breeds',
  },
  Stubborn: {
    description:
      'Willful and resistant to direction. Training progress is slow but gains are permanent once made.',
    prevalenceNote: 'More common in pony and mule-influenced breeds',
  },
  Playful: {
    description:
      'Enthusiastic and spirited, but struggles to maintain focus during structured training.',
    prevalenceNote: 'Common in younger-spirited light horse breeds',
  },
  Lazy: {
    description:
      'Low energy and unmotivated. Requires consistent encouragement but is easy to handle.',
    prevalenceNote: 'Common in easy-keeping draft and pony breeds',
  },
  Aggressive: {
    description:
      'Dominant and combative. Challenging to manage but can excel competitively with the right handler.',
    prevalenceNote: 'Rare; more common in stallions and certain warmbloods',
  },
});

/**
 * Get all temperament type definitions with training/competition modifiers and groom synergy.
 * Returns static game data — no DB query, no auth required.
 * All data sourced from temperamentService constants.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getTemperamentDefinitions(req, res) {
  try {
    const definitions = TEMPERAMENT_TYPES.map(name => {
      const desc = TEMPERAMENT_DESCRIPTIONS[name];
      if (!desc) {
        logger.warn(
          `[horseController.getTemperamentDefinitions] Unknown temperament "${name}" — missing description`,
        );
      }
      const { description = name, prevalenceNote = '' } = desc ?? {};

      const trainingMods = TEMPERAMENT_TRAINING_MODIFIERS[name];
      if (!trainingMods) {
        throw new Error(`Missing training modifiers for temperament: ${name}`);
      }

      const competitionMods = TEMPERAMENT_COMPETITION_MODIFIERS[name];
      if (!competitionMods) {
        throw new Error(`Missing competition modifiers for temperament: ${name}`);
      }

      const synergyMap = TEMPERAMENT_GROOM_SYNERGY[name] ?? {};

      let bestGroomPersonalities;
      if ('_any' in synergyMap) {
        bestGroomPersonalities = [...CANONICAL_PERSONALITIES];
      } else {
        bestGroomPersonalities = Object.entries(synergyMap)
          .filter(([, v]) => v > 0)
          .map(([k]) => k);
      }

      return {
        name,
        description,
        prevalenceNote,
        trainingModifiers: {
          xpModifier: trainingMods.xpModifier,
          scoreModifier: trainingMods.scoreModifier,
        },
        competitionModifiers: {
          riddenModifier: competitionMods.riddenModifier,
          conformationModifier: competitionMods.conformationModifier,
        },
        bestGroomPersonalities,
      };
    });

    logger.info(
      `[horseController.getTemperamentDefinitions] Returned ${definitions.length} temperament definitions`,
    );

    res.status(200).json({
      success: true,
      message: 'Temperament definitions retrieved successfully',
      data: {
        count: definitions.length,
        definitions,
      },
    });
  } catch (error) {
    logger.error(`[horseController.getTemperamentDefinitions] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving temperament definitions',
      data: null,
    });
  }
}

/**
 * Get full color genotype and phenotype for a horse.
 * Pure pass-through — reads from req.horse set by requireOwnership middleware.
 * No additional DB queries.
 *
 * @param {object} req - Express request (req.horse set by requireOwnership)
 * @param {object} res - Express response
 */
export async function getGenetics(req, res) {
  try {
    // D-3: explicit guard — requireOwnership must have set req.horse
    if (!req.horse) {
      logger.error(
        '[horseController.getGenetics] req.horse not set — requireOwnership middleware did not run',
      );
      return res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving genetics data',
        data: null,
      });
    }

    const horse = req.horse;

    // D-2: JSONB type guard — reject non-object values (arrays, scalars)
    const hasGenotype =
      horse.colorGenotype !== null &&
      horse.colorGenotype !== undefined &&
      typeof horse.colorGenotype === 'object' &&
      !Array.isArray(horse.colorGenotype);

    if (!hasGenotype) {
      return res.status(200).json({
        success: true,
        message: 'No genetics data available for this horse',
        data: null,
      });
    }

    logger.info(`[horseController.getGenetics] Retrieved genetics for horse ${horse.id}`);

    return res.status(200).json({
      success: true,
      message: 'Genetics data retrieved successfully',
      data: {
        horseId: horse.id,
        horseName: horse.name,
        colorGenotype: horse.colorGenotype,
        phenotype: horse.phenotype ?? null,
      },
    });
  } catch (error) {
    logger.error(`[horseController.getGenetics] Unexpected error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving genetics data',
      data: null,
    });
  }
}

/**
 * Get player-facing coat color and markings summary for a horse.
 * Returns colorName, shade, markings, and modifiers — no genotype (player-safe).
 * Pure pass-through — reads from req.horse set by requireOwnership middleware.
 *
 * @param {object} req - Express request (req.horse set by requireOwnership)
 * @param {object} res - Express response
 */
export async function getColor(req, res) {
  try {
    // D-3: explicit guard — requireOwnership must have set req.horse
    if (!req.horse) {
      logger.error(
        '[horseController.getColor] req.horse not set — requireOwnership middleware did not run',
      );
      return res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving color data',
        data: null,
      });
    }

    const horse = req.horse;
    const phenotype = horse.phenotype;

    // D-2: JSONB type guard — reject non-object values (arrays, scalars)
    const hasPhenotype =
      phenotype !== null &&
      phenotype !== undefined &&
      typeof phenotype === 'object' &&
      !Array.isArray(phenotype);

    if (!hasPhenotype) {
      return res.status(200).json({
        success: true,
        message: 'No color data available for this horse',
        data: null,
      });
    }

    logger.info(`[horseController.getColor] Retrieved color for horse ${horse.id}`);

    return res.status(200).json({
      success: true,
      message: 'Color data retrieved successfully',
      data: {
        horseId: horse.id,
        horseName: horse.name,
        colorName: phenotype.colorName ?? null,
        shade: phenotype.shade ?? null,
        faceMarking: phenotype.faceMarking ?? null,
        legMarkings: phenotype.legMarkings ?? null,
        advancedMarkings: phenotype.advancedMarkings ?? null,
        modifiers: phenotype.modifiers ?? null,
      },
    });
  } catch (error) {
    logger.error(`[horseController.getColor] Unexpected error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving color data',
      data: null,
    });
  }
}

/**
 * Validate that a colorGenotype value is a proper JSONB object.
 * Rejects null, undefined, arrays, and scalar values.
 *
 * @param {*} genotype - value from horse.colorGenotype
 * @returns {boolean}
 */
function isValidGenotype(genotype) {
  return (
    genotype !== null &&
    genotype !== undefined &&
    typeof genotype === 'object' &&
    !Array.isArray(genotype)
  );
}

/**
 * Calculate breeding color prediction for two parent horses.
 * Returns a probability chart of possible offspring coat colors.
 * Controller handles DB fetching and ownership — calls pure-function service.
 *
 * @param {object} req - Express request with body { sireId, damId, foalBreedId? }
 * @param {object} res - Express response
 */
export async function getBreedingColorPrediction(req, res) {
  try {
    const { sireId, damId, foalBreedId } = req.body;

    // Self-cross guard (Equoria-eef8): reject sireId === damId with 400
    // BEFORE any DB work — pattern documented in PATTERN_LIBRARY.md
    // "Per-Locus Probability — Multi-Locus Genetics Calculation (31E-5)".
    // Prevents both the obvious self-breeding bug and a class of wasted-DB
    // work that would otherwise scale with attacker volume.
    if (sireId === damId) {
      return res.status(400).json({
        success: false,
        message: 'Sire and dam cannot be the same horse',
      });
    }

    // Fetch both horses with ownership validation
    const [sire, dam] = await Promise.all([
      prisma.horse.findUnique({
        where: { id: sireId },
        select: { id: true, name: true, colorGenotype: true, userId: true, breedId: true },
      }),
      prisma.horse.findUnique({
        where: { id: damId },
        select: { id: true, name: true, colorGenotype: true, userId: true, breedId: true },
      }),
    ]);

    // AC5: Ownership enforcement — 404 for both not-found and not-owned
    if (!sire || sire.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
      });
    }
    if (!dam || dam.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
      });
    }

    // AC6: Legacy horse handling — both parents must have genetics data
    if (!isValidGenotype(sire.colorGenotype) || !isValidGenotype(dam.colorGenotype)) {
      return res.status(200).json({
        success: true,
        message: 'Color prediction requires both parents to have genetics data',
        data: null,
      });
    }

    // Resolve foal breed profile (default to dam's breed)
    const resolvedBreedId = foalBreedId || dam.breedId;
    let foalBreedProfile = null;
    if (resolvedBreedId) {
      // Use raw SQL to bypass stale Prisma client DMMF that may not include breedGeneticProfile
      const breedRows = await prisma.$queryRaw`
        SELECT "breedGeneticProfile" FROM breeds WHERE id = ${resolvedBreedId}
      `;
      foalBreedProfile = breedRows[0]?.breedGeneticProfile ?? null;
    }

    // Call the pure prediction service (statically imported at top — no circular dep).
    // Pattern: PATTERN_LIBRARY.md "Per-Locus Probability — Multi-Locus Genetics Calculation".
    const prediction = predictBreedingColors(
      sire.colorGenotype,
      dam.colorGenotype,
      foalBreedProfile,
    );

    logger.info(
      `[horseController.getBreedingColorPrediction] Predicted ${prediction.possibleColors.length} colors for sire=${sire.id} dam=${dam.id}`,
    );

    return res.status(200).json({
      success: true,
      message: 'Breeding color prediction calculated successfully',
      data: {
        sireId: sire.id,
        damId: dam.id,
        ...prediction,
      },
    });
  } catch (error) {
    logger.error(`[horseController.getBreedingColorPrediction] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while calculating breeding color prediction',
      data: null,
    });
  }
}
