/**
 * Horse Overview Controller
 *
 * Equoria-xod8b (child A of Equoria-mh937): extracted from horseController.mjs.
 * Owns competition-history + overview + personality-impact endpoints.
 * No behavior changes — functions moved verbatim.
 */
import { getResultsByHorse } from '../../../models/resultModel.mjs';
import { getAnyRecentTraining } from '../../../models/trainingModel.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { getFeedHealth, getVetHealth, getDisplayedHealth } from '../../../utils/horseHealth.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';
import { asFlagObject } from '../../../utils/jsonbArrayGuard.mjs';

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
      statGain: result.statGains ? JSON.parse(result.statGains) : null,
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
 * GET /api/horses/:horseId/competition-history
 *
 * Returns per-horse competition history + aggregated statistics in the
 * `CompetitionHistoryData` shape consumed by the
 * `useHorseCompetitionHistory` frontend hook. Powers the /my-stable Hall of
 * Fame career display.
 *
 * Story 21S-4: closes the missing endpoint.
 */
export async function getHorseCompetitionHistory(req, res, next) {
  try {
    const { horseId: horseIdParam } = req.params;
    const horseId = parseInt(horseIdParam, 10);

    if (isNaN(horseId) || horseId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid horse ID' });
    }

    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { id: true, name: true, userId: true },
    });

    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }

    // Equoria-r54u9: ownership guard. Competition history (prizeWon, entrant
    // counts, score progression) is PII-equivalent — it reconstructs another
    // user's full earnings + stalking-grade show targeting. Return 404 (same
    // envelope as missing horse, CWE-639) on any non-owner access.
    if (horse.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }

    const results = await prisma.competitionResult.findMany({
      where: { horseId },
      select: {
        id: true,
        score: true,
        placement: true,
        discipline: true,
        runDate: true,
        showName: true,
        prizeWon: true,
        showId: true,
        show: {
          select: {
            id: true,
            name: true,
            // Equoria-r54u9: dropped _count.competitionResults — entrant count
            // leaks competitive intel across all show participants. Frontend
            // hook does not display it; remove from public projection.
          },
        },
      },
      orderBy: { runDate: 'desc' },
    });

    const totalCompetitions = results.length;

    if (totalCompetitions === 0) {
      return res.json({
        horseId,
        horseName: horse.name,
        statistics: {
          totalCompetitions: 0,
          wins: 0,
          top3Finishes: 0,
          winRate: 0,
          totalPrizeMoney: 0,
          averagePlacement: 0,
          bestPlacement: 0,
        },
        competitions: [],
      });
    }

    let wins = 0;
    let top3Finishes = 0;
    let totalPrizeMoney = 0;
    let placementSum = 0;
    let placementCount = 0;
    let bestPlacement = Number.POSITIVE_INFINITY;

    for (const r of results) {
      const p = parseCompetitionPlacement(r.placement);
      if (p === 1) {
        wins += 1;
      }
      if (p > 0 && p <= 3) {
        top3Finishes += 1;
      }
      if (p > 0) {
        placementSum += p;
        placementCount += 1;
        if (p < bestPlacement) {
          bestPlacement = p;
        }
      }
      totalPrizeMoney += Number(r.prizeWon ?? 0);
    }

    if (bestPlacement === Number.POSITIVE_INFINITY) {
      bestPlacement = 0;
    }

    const winRate = totalCompetitions > 0 ? (wins / totalCompetitions) * 100 : 0;
    const averagePlacement = placementCount > 0 ? placementSum / placementCount : 0;

    const competitions = results.map(r => ({
      competitionId: r.showId,
      competitionName: r.show?.name ?? r.showName,
      discipline: r.discipline,
      date: r.runDate,
      placement: parseCompetitionPlacement(r.placement),
      // Equoria-r54u9: totalParticipants previously derived from
      // r.show._count.competitionResults — that aggregate count leaks
      // competitive intel about ALL show participants when the endpoint
      // returns data for a single horse. The _count projection has been
      // dropped above; this field stays 0 by design. If a future UX needs
      // a per-show participant count for the OWNER's own results, fetch it
      // via an authenticated /shows/:id/participants endpoint that enforces
      // its own ownership / event-attendance check.
      totalParticipants: 0,
      finalScore: Number(r.score),
      prizeMoney: Number(r.prizeWon ?? 0),
      // xpGained: omitted — not stored in CompetitionResult and cannot be reliably
      // derived without a schema change (Equoria-aenc). Remove the misleading zero.
    }));

    return res.json({
      horseId,
      horseName: horse.name,
      statistics: {
        totalCompetitions,
        wins,
        top3Finishes,
        winRate: Math.round(winRate * 100) / 100,
        totalPrizeMoney,
        averagePlacement: Math.round(averagePlacement * 100) / 100,
        bestPlacement,
      },
      competitions,
    });
  } catch (error) {
    logger.error(`[horseController.getHorseCompetitionHistory] Error: ${error.message}`);
    return next ? next(error) : res.status(500).json({ success: false, message: 'Internal error' });
  }
}

/**
 * Parse a placement string like "1st", "3rd", "5th", or "4" into its
 * numeric rank. Returns 0 when no numeric prefix is found.
 *
 * Duplicated locally for locality — shared util can be extracted if a
 * third consumer shows up.
 */
function parseCompetitionPlacement(placement) {
  if (placement === null || placement === undefined) {
    return 0;
  }
  if (typeof placement === 'number') {
    return placement;
  }
  const str = String(placement).trim();
  const match = str.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
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
      const lastTrainingDate = await getAnyRecentTraining(horseId);
      if (lastTrainingDate) {
        const nextTraining = new Date(lastTrainingDate);
        nextTraining.setDate(nextTraining.getDate() + 7); // Add 7 days

        // Only set next training date if it's in the future
        const now = new Date();
        if (nextTraining > now) {
          nextTrainingDate = nextTraining.toISOString();
        }
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

/**
 * Get most compatible grooms for a horse based on temperament
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getHorsePersonalityImpact(req, res) {
  try {
    const { id } = req.params;
    const horseId = parseInt(id, 10);

    if (isNaN(horseId) || horseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
      });
    }

    // Get horse with temperament
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        name: true,
        temperament: true,
        bondScore: true,
        userId: true,
      },
    });

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
      });
    }

    // Equoria-07ym2: IDOR fix. This endpoint returns the user-scoped groom
    // roster (names, personalities, skill levels, session rates — user-supplied
    // PII). Before the fix, ANY authenticated user could enumerate horse IDs
    // and read every other user's complete groom roster. Reject non-owners
    // with 404 (same shape as a missing-horse response — NOT 403, which would
    // be a CWE-639 existence-leak: 403 vs 404 differing by horse existence
    // tells an attacker the id is real, just owned by someone else).
    if (horse.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
      });
    }

    if (!horse.temperament) {
      return res.status(400).json({
        success: false,
        message: 'Horse temperament not set. Cannot calculate personality compatibility.',
      });
    }

    // Get all grooms for the user
    const grooms = await prisma.groom.findMany({
      where: { userId: horse.userId },
      select: {
        id: true,
        name: true,
        personality: true,
        speciality: true,
        skillLevel: true,
        experience: true,
        sessionRate: true,
        isActive: true,
      },
    });

    // Calculate compatibility for each groom
    const { getCompatibleGroomsForTemperament, calculatePersonalityCompatibility } =
      await import('../../../utils/groomPersonalityTraitBonus.mjs');

    const groomCompatibility = grooms.map(groom => {
      const compatibility = calculatePersonalityCompatibility(
        groom.personality,
        horse.temperament,
        horse.bondScore || 50,
      );

      return {
        groom: {
          id: groom.id,
          name: groom.name,
          personality: groom.personality,
          speciality: groom.speciality,
          skillLevel: groom.skillLevel,
          experience: groom.experience,
          sessionRate: groom.sessionRate,
          isActive: groom.isActive,
        },
        compatibility: {
          isMatch: compatibility.isMatch,
          isStrongMatch: compatibility.isStrongMatch,
          traitModifier: compatibility.traitModifierScore,
          stressReduction: Math.abs(compatibility.stressResistanceBonus * 100), // Convert to percentage
          bondModifier: compatibility.bondModifier,
          description: compatibility.description,
          recommendation: compatibility.isMatch
            ? "Excellent match for this horse's temperament"
            : "May not be the best match for this horse's temperament",
        },
      };
    });

    // Sort by compatibility (matches first, then by trait modifier)
    groomCompatibility.sort((a, b) => {
      if (a.compatibility.isMatch && !b.compatibility.isMatch) {
        return -1;
      }
      if (!a.compatibility.isMatch && b.compatibility.isMatch) {
        return 1;
      }
      return b.compatibility.traitModifier - a.compatibility.traitModifier;
    });

    // Get general compatibility info for this temperament
    const generalCompatibility = getCompatibleGroomsForTemperament(horse.temperament);

    logger.info(
      `[horseController.getHorsePersonalityImpact] Retrieved personality compatibility for horse ${horseId} (${horse.temperament})`,
    );

    res.json({
      success: true,
      horse: {
        id: horse.id,
        name: horse.name,
        temperament: horse.temperament,
        bondScore: horse.bondScore,
      },
      groomCompatibility,
      generalCompatibility,
      totalGrooms: grooms.length,
      compatibleGrooms: groomCompatibility.filter(g => g.compatibility.isMatch).length,
    });
  } catch (error) {
    logger.error(`[horseController.getHorsePersonalityImpact] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate personality compatibility',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}
