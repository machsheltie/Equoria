/**
 * Horse Genetics Controller
 *
 * Equoria-xod8b (child A of Equoria-mh937): extracted from horseController.mjs.
 * Owns temperament-definitions + genetics + color endpoints. The breeding colour
 * prediction was removed (owner ruling q91, Equoria-m13fh: players see no foal outcome).
 * No behavior changes — functions moved verbatim.
 */
import { TEMPERAMENT_TYPES } from '../data/temperamentTypes.mjs';
import { TEMPERAMENT_GROOM_SYNERGY } from '../services/temperamentService.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Canonical groom personalities — defined once at module scope (not per-request).
 */
const CANONICAL_PERSONALITIES = Object.freeze(['gentle', 'energetic', 'patient', 'strict']);

/**
 * Static descriptions and prevalence notes for all 12 temperament types.
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
  // Owner ruling 2026-10-21: Willing is a new temperament.
  Willing: {
    description:
      'Cooperative and eager to please. Takes direction readily and tries hard for a rider it trusts.',
    prevalenceNote: 'Most common in draft and heavy breeds',
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
  // Owner ruling 2026-10-21: Playful was renamed Driven.
  Driven: {
    description:
      'Determined and hard-working. Gives full effort every time, though that drive can run ahead of the rider.',
    prevalenceNote: 'Most common in racing, trotting and hot-blooded sport breeds',
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
 * Get all temperament type definitions with groom synergy. Owner ruling
 * 2026-10-21: temperaments have no training or ridden/conformation modifiers,
 * so the definitions no longer carry them.
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

    // Owner ruling 2026-10-26 (q72): colour genetics stay hidden until the owner
    // pays for the vet's Genetic Testing. The genotype never leaves the server
    // for an untested horse.
    if (horse.colorGeneticsTested !== true) {
      return res.status(200).json({
        success: true,
        message: 'Colour genetics have not been tested for this horse',
        data: {
          horseId: horse.id,
          horseName: horse.name,
          colorGeneticsTested: false,
        },
      });
    }

    logger.info(`[horseController.getGenetics] Retrieved genetics for horse ${horse.id}`);

    return res.status(200).json({
      success: true,
      message: 'Genetics data retrieved successfully',
      data: {
        horseId: horse.id,
        horseName: horse.name,
        colorGeneticsTested: true,
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
