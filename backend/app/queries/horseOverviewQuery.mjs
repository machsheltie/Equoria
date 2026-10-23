/**
 * Horse overview and competition-history reads (application query layer, Equoria-q4uem.4 / WS4 S3).
 *
 * These handlers compose horse data with competition results and training state, so they live
 * above the domain modules: Horses must not import Competition or Training. Moved verbatim from
 * backend/modules/horses/controllers/horseOverviewController.mjs; behaviour, responses and status
 * codes are unchanged.
 */
import { getResultsByHorse, readRecordedAwards } from '../../modules/competition/index.mjs';
import { activeTrainingCooldownEnd } from '../../modules/training/index.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import logger from '../../utils/logger.mjs';
import { getFeedHealth, getVetHealth, getDisplayedHealth } from '../../utils/horseHealth.mjs';
import { getHorseAgeYears } from '../../utils/horseAge.mjs';
import { asFlagObject } from '../../utils/jsonbArrayGuard.mjs';

/**
 * Get competition history for a specific horse
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getHorseHistory(req, res) {
  try {
    const { id } = req.params;

    // Validate horse ID
    const horseId = parseInt(id, 10);
    if (isNaN(horseId) || horseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
        data: null,
      });
    }

    // Get competition results for the horse
    const results = await getResultsByHorse(horseId);

    // Transform results for frontend display
    const history = results.map(result => ({
      id: result.id,
      showName: result.showName,
      discipline: result.discipline,
      placement: result.placement,
      score: result.score,
      prize: result.prizeWon,
      // statGains holds a ridden stat gain or a conformation ribbon (an object; a
      // JSON string on legacy rows). JSON.parse on the object answered 500.
      ...readRecordedAwards(result.discipline, result.statGains),
      runDate: result.runDate,
      createdAt: result.createdAt,
    }));

    logger.info(
      `[horseController.getHorseHistory] Retrieved ${history.length} competition results for horse ${horseId}`,
    );

    res.status(200).json({
      success: true,
      message: `Found ${history.length} competition results for horse ${horseId}`,
      data: history,
    });
  } catch (error) {
    logger.error('[horseController.getHorseHistory] Error retrieving horse history: %o', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving horse history',
      data: null,
    });
  }
}

/**
 * Get horse overview data for detailed display
 * Returns everything needed for the horse overview screen
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getHorseOverview(req, res) {
  try {
    const { id } = req.params;

    // Validate horse ID
    const horseId = parseInt(id, 10);
    if (isNaN(horseId) || horseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
        data: null,
      });
    }

    logger.info(`[horseController.getHorseOverview] Getting overview for horse ${horseId}`);

    // Get full horse record with all needed data
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        name: true,
        age: true,
        // The one training-cooldown source (Equoria-w0qb7).
        trainingCooldown: true,
        // dateOfBirth required by getHorseAgeYears() — supplies the
        // ageYears field on the overview response (Equoria-lvjy).
        dateOfBirth: true,
        trait: true,
        disciplineScores: true,
        totalEarnings: true,
        tack: true,
        rider: true,
        // Health-band inputs (A11): required by withHealth() / getFeedHealth() /
        // getVetHealth() to derive feedHealth, vetHealth, displayedHealth on
        // the response. See backend/utils/horseHealth.mjs.
        lastFedDate: true,
        lastVettedDate: true,
        healthStatus: true,
        // Pregnancy state (B6 / Equoria-1adr): /overview is a projection used
        // by future consumers; include the same pregnancy fields the full
        // GET /:id route surfaces so /overview is not silently missing them.
        inFoalSinceDate: true,
        pregnancySireId: true,
        pregnancyFeedingsByTier: true,
      },
    });

    if (!horse) {
      logger.warn(`[horseController.getHorseOverview] Horse ${horseId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    // Calculate next training date
    let nextTrainingDate = 'never';
    try {
      // Horse.trainingCooldown is the one cooldown source (Equoria-w0qb7); it is
      // only a future time while a cooldown runs.
      const cooldownEnd = activeTrainingCooldownEnd(horse.trainingCooldown);
      if (cooldownEnd) {
        nextTrainingDate = cooldownEnd.toISOString();
      }
    } catch (error) {
      logger.warn(
        `[horseController.getHorseOverview] Error calculating next training date: ${error.message}`,
      );
      // Continue with null next training date
    }

    // Get most recent show result
    let lastShowResult = 'never';
    try {
      const recentResult = await prisma.competitionResult.findFirst({
        where: {
          horseId,
        },
        orderBy: {
          runDate: 'desc',
        },
        select: {
          showName: true,
          placement: true,
          runDate: true,
        },
      });

      if (recentResult) {
        lastShowResult = {
          showName: recentResult.showName,
          placement: recentResult.placement,
          runDate: recentResult.runDate.toISOString(),
        };
      }
    } catch (error) {
      logger.warn(
        `[horseController.getHorseOverview] Error getting last show result: ${error.message}`,
      );
      // Continue with null last show result
    }

    // Prepare response data
    const overviewData = {
      id: horse.id,
      name: horse.name,
      age: horse.age, // transitional: kept for backwards compat; deprecated in OpenAPI (Equoria-lvjy)
      // Game-year age computed from dateOfBirth (1 week = 1 game-year).
      // Frontend reads `horse.ageYears ?? horse.age` — this is the primary path.
      ageYears: getHorseAgeYears(horse.dateOfBirth),
      trait: horse.trait,
      disciplineScores: asFlagObject(horse.disciplineScores),
      nextTrainingDate,
      earnings: horse.totalEarnings || 0,
      lastShowResult,
      rider: horse.rider || 'none',
      tack: horse.tack || {},
      // Derived health bands (A11). See backend/utils/horseHealth.mjs.
      feedHealth: getFeedHealth(horse),
      vetHealth: getVetHealth(horse),
      displayedHealth: getDisplayedHealth(horse),
      // Pregnancy state parity with GET /:id (B6 / Equoria-1adr).
      // pregnancyFeedingsByTier defaults to {} (not null/undefined) so any
      // consumer can read tier counts without an existence check.
      inFoalSinceDate: horse.inFoalSinceDate ? horse.inFoalSinceDate.toISOString() : null,
      pregnancySireId: horse.pregnancySireId ?? null,
      pregnancyFeedingsByTier: horse.pregnancyFeedingsByTier ?? {},
    };

    logger.info(
      `[horseController.getHorseOverview] Successfully retrieved overview for horse ${horse.name} (ID: ${horseId})`,
    );

    res.status(200).json({
      success: true,
      message: 'Horse overview retrieved successfully',
      data: overviewData,
    });
  } catch (error) {
    logger.error(
      `[horseController.getHorseOverview] Error getting horse overview: ${error.message}`,
    );

    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving horse overview',
      data: null,
    });
  }
}
