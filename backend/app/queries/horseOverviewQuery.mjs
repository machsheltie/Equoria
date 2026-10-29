/**
 * Horse overview read (application query layer, Equoria-q4uem.4 / WS4 S3).
 *
 * These handlers compose horse data with competition results and training state, so they live
 * above the domain modules: Horses must not import Competition or Training. Moved verbatim from
 * backend/modules/horses/controllers/horseOverviewController.mjs; behaviour, responses and status
 * codes are unchanged.
 */
import { activeTrainingCooldownEnd, getTrainingVerdict } from '../../modules/training/index.mjs';
import { canGroomToday } from '../../modules/grooms/index.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import logger from '../../utils/logger.mjs';
import { getFeedHealth, getVetHealth, getDisplayedHealth } from '../../utils/horseHealth.mjs';
import { getHorseAgeYears, liveHorseAgeYears } from '../../utils/horseAge.mjs';
import { asFlagObject } from '../../utils/jsonbArrayGuard.mjs';

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
        // Health-band inputs (A11): required by withHealth() / getFeedHealth() /
        // getVetHealth() to derive feedHealth, vetHealth, displayedHealth on
        // the response. See backend/utils/horseHealth.mjs.
        lastFedDate: true,
        hungerSince: true,
        lastVettedDate: true,
        healthStatus: true,
        // Current Status dates (Equoria-0l0tq).
        lastShod: true,
        lastGroomed: true,
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

    // The server's verdicts for the horse page's Last Trained / Last Groomed
    // lines (Equoria-0l0tq): the same rules the train and groom actions apply.
    // A verdict that cannot be read is null (unknown), never a guessed false.
    let lastTrainedAt = null;
    let canTrainNow = null;
    let canGroomTodayVerdict = null;
    try {
      const training = await getTrainingVerdict(horse);
      lastTrainedAt = training.lastTrainedAt ? training.lastTrainedAt.toISOString() : null;
      canTrainNow = training.canTrainNow;
      canGroomTodayVerdict = await canGroomToday(horseId);
    } catch (error) {
      logger.warn(
        `[horseController.getHorseOverview] Error reading care verdicts: ${error.message}`,
      );
    }

    // The horse's rider is its active RiderAssignment (Equoria-97se: the Horse.rider
    // JSON copy is gone). Shape: { id, name, starLevel }, else 'none'. The old 1-10
    // level gave way to the star level (owner ruling 2026-10-28, q229); a rider has no
    // visible speciality (owner ruling 2026-10-29, q283).
    const riderAssignment = await prisma.riderAssignment.findFirst({
      where: { horseId, isActive: true },
      orderBy: { id: 'desc' },
      select: {
        rider: {
          select: { id: true, firstName: true, lastName: true, starLevel: true },
        },
      },
    });
    const assignedRider = riderAssignment
      ? {
          id: riderAssignment.rider.id,
          name: `${riderAssignment.rider.firstName} ${riderAssignment.rider.lastName}`,
          starLevel: riderAssignment.rider.starLevel,
        }
      : 'none';

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
      // transitional: kept for backwards compat; deprecated in OpenAPI (Equoria-lvjy).
      // The live age, not the stored column the nightly job writes (Equoria-6pbka).
      age: liveHorseAgeYears(horse),
      // Game-year age computed from dateOfBirth (1 week = 1 game-year).
      // Frontend reads `horse.ageYears ?? horse.age` — this is the primary path.
      ageYears: getHorseAgeYears(horse.dateOfBirth),
      trait: horse.trait,
      disciplineScores: asFlagObject(horse.disciplineScores),
      nextTrainingDate,
      earnings: horse.totalEarnings || 0,
      lastShowResult,
      rider: assignedRider,
      tack: horse.tack || {},
      // Current Status (Equoria-0l0tq): dates and the server's can-do-now verdicts.
      lastShod: horse.lastShod ? horse.lastShod.toISOString() : null,
      lastGroomed: horse.lastGroomed ? horse.lastGroomed.toISOString() : null,
      lastTrainedAt,
      canTrainNow,
      canGroomToday: canGroomTodayVerdict,
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
