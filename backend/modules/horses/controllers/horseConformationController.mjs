/**
 * Horse Conformation Controller
 *
 * Equoria-xod8b (child A of Equoria-mh937): extracted from horseController.mjs.
 * Owns conformation + gait endpoints.
 * No behavior changes — functions moved verbatim.
 *
 * GET /:id/conformation/analysis (per-region percentiles vs the breed) was
 * retired with the Conformation tab's percentile numbers (owner request
 * 2026-10-29, Equoria-oxbda): nothing else read it.
 */
import {
  CONFORMATION_REGIONS,
  calculateOverallConformation,
} from '../services/conformationService.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Get conformation scores for a horse.
 * Returns all 8 region scores + overall conformation average.
 * Horse is pre-attached to req.horse by requireOwnership middleware.
 *
 * @param {Object} req - Express request object (req.horse attached by middleware)
 * @param {Object} res - Express response object
 */
export async function getConformation(req, res) {
  try {
    const horse = req.horse;
    const scores = horse.conformationScores;

    // Legacy horse without conformation scores
    if (!scores) {
      return res.status(200).json({
        success: true,
        message: 'No conformation scores available for this horse',
        data: null,
      });
    }

    // Build response with all 8 regions + overall (null for missing legacy regions)
    const conformationScores = {};
    for (const region of CONFORMATION_REGIONS) {
      conformationScores[region] = scores[region] ?? null;
    }
    conformationScores.overallConformation =
      scores.overallConformation ?? calculateOverallConformation(scores);

    logger.info(
      `[horseController.getConformation] Retrieved conformation for horse ${horse.id}: overall=${conformationScores.overallConformation}`,
    );

    res.status(200).json({
      success: true,
      message: 'Conformation scores retrieved successfully',
      data: {
        horseId: horse.id,
        horseName: horse.name,
        breedId: horse.breedId,
        conformationScores,
      },
    });
  } catch (error) {
    logger.error(`[horseController.getConformation] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving conformation scores',
      data: null,
    });
  }
}

/**
 * Get gait quality scores for a specific horse.
 * Returns walk, trot, canter, gallop scores + gaiting entries for gaited breeds.
 * Horse is pre-attached to req.horse by requireOwnership middleware.
 *
 * @param {Object} req - Express request object (req.horse attached by middleware)
 * @param {Object} res - Express response object
 */
export async function getGaits(req, res) {
  try {
    const horse = req.horse;
    const gaitScores = horse.gaitScores;

    // Every horse has gait scores (Equoria-576c0.5: the column is NOT NULL and every
    // creation path rolls them from the breed). Old contract: a horse with none got a
    // 200 with data:null ("No gait scores available for this horse").

    logger.info(`[horseController.getGaits] Retrieved gait scores for horse ${horse.id}`);

    res.status(200).json({
      success: true,
      message: 'Gait scores retrieved successfully',
      data: {
        horseId: horse.id,
        horseName: horse.name,
        breedId: horse.breedId,
        gaitScores,
      },
    });
  } catch (error) {
    logger.error(`[horseController.getGaits] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving gait scores',
      data: null,
    });
  }
}
