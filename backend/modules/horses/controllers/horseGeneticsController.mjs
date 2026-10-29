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
import { satisfiesRole } from '../../staff/index.mjs';

/**
 * Canonical groom personalities — defined once at module scope (not per-request).
 */
const CANONICAL_PERSONALITIES = Object.freeze(['gentle', 'energetic', 'patient', 'strict']);

/**
 * Static descriptions for all 12 temperament types.
 * Kept in the controller layer — does NOT belong in temperamentService (data separation).
 * Owner ruling 2026-10-29 (q291, Equoria-9kakx): each temperament is described
 * on its own, with no breed hints (the old prevalence notes named breeds).
 * Owner rulings 2026-10-29 q303/q307 (Equoria-gbyzs): personality first, then a
 * general line on what temperament really touches — shows, groom bond, trainer
 * fit (ruling 2026-10-21) — with no numbers, no training or performance claims,
 * no "potential", and no groom/trainer personality names (the "Best with grooms"
 * line shows those).
 */
const TEMPERAMENT_DESCRIPTIONS = Object.freeze({
  Spirited: {
    description:
      'Bright-eyed and full of go, a Spirited horse greets every day as if something wonderful is about to happen. That fire goes with them into the show ring and lights up their time with their groom and their trainer.',
  },
  Nervous: {
    description:
      'Sensitive and watchful, a Nervous horse notices every rustle and shadow and needs to know they are safe. Their worries travel with them into the show ring, and into how they learn to trust their groom and their trainer.',
  },
  Calm: {
    description:
      'Easygoing and unflappable, a Calm horse takes the world as it comes, from a busy show ground to a new face at the stall door. That even nature carries into the show ring and into easy partnerships with their groom and their trainer.',
  },
  Bold: {
    description:
      'Confident and curious, a Bold horse walks straight up to anything unfamiliar to see what it is. That courage follows them into the show ring and shapes how they get on with their groom and their trainer.',
  },
  Steady: {
    description:
      'Dependable as the sunrise, a Steady horse is the same sensible partner on a quiet morning as on a big show day. That evenness shows in the show ring, with their groom and with their trainer.',
  },
  Willing: {
    description:
      'Cooperative and eager to please. A Willing horse tries their heart out for the people they trust, and it shows in the show ring, with their groom and with their trainer.',
  },
  Independent: {
    description:
      'Thoughtful and self-possessed, an Independent horse likes to make up their own mind before agreeing to anything. That streak follows them into the show ring and into every bond they form with their groom and their trainer.',
  },
  Reactive: {
    description:
      'Quick and keenly aware, a Reactive horse feels everything around them: the wind, the crowd, the mood of the barn. That sensitivity matters in the show ring, and in how they settle with their groom and their trainer.',
  },
  Stubborn: {
    description:
      'Opinionated and unhurried, a Stubborn horse knows exactly what they think and sees no reason to change their mind. That will goes with them into the show ring, and their groom and their trainer feel it too.',
  },
  Driven: {
    description:
      'Determined and hard-working. A Driven horse gives everything they have, every single time, and that heart shows in the show ring, with their groom and with their trainer.',
  },
  Lazy: {
    description:
      'Easygoing to a fault, a Lazy horse would happily doze in the sun all afternoon and sees no reason to rush. That relaxed outlook carries into the show ring and into their days with their groom and their trainer.',
  },
  Aggressive: {
    description:
      'Proud and quick to assert themselves, an Aggressive horse wants everyone in the barn to know who is in charge. That edge follows them into the show ring, and it colors how they get on with their groom and their trainer.',
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
      const description = desc?.description ?? name;

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
    // for an untested horse, except to the game admin (owner ruling 2026-10-29
    // q294: the owner/admin role sees all colour genetics, tested or not).
    const tested = horse.colorGeneticsTested === true;
    if (!tested && satisfiesRole(req.user?.role, 'admin')) {
      return res.status(200).json({
        success: true,
        message: 'Color genetics have not been tested for this horse',
        data: {
          horseId: horse.id,
          horseName: horse.name,
          colorGeneticsTested: false,
          colorGenotype: horse.colorGenotype,
          phenotype: horse.phenotype ?? null,
        },
      });
    }
    if (!tested) {
      return res.status(200).json({
        success: true,
        message: 'Color genetics have not been tested for this horse',
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
