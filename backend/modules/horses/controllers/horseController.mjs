import { getResultsByHorse } from '../../../models/resultModel.mjs';
import { getHorseById } from '../../../models/horseModel.mjs';
import { getAnyRecentTraining } from '../../../models/trainingModel.mjs';
import {
  CONFORMATION_REGIONS,
  calculateOverallConformation,
} from '../services/conformationService.mjs';
import { TEMPERAMENT_TYPES } from '../data/breedGeneticProfiles.mjs';
import { getBreedProfile } from '../data/breedProfileLoader.mjs';
import {
  TEMPERAMENT_TRAINING_MODIFIERS,
  TEMPERAMENT_COMPETITION_MODIFIERS,
  TEMPERAMENT_GROOM_SYNERGY,
} from '../services/temperamentService.mjs';
import { predictBreedingColors } from '../services/breedingColorPredictionService.mjs';
import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';
import { getFeedHealth, getVetHealth, getDisplayedHealth } from '../../../utils/horseHealth.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';

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
      select: { id: true, name: true },
    });

    if (!horse) {
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
            _count: { select: { competitionResults: true } },
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
      // Derive participant count from the number of results recorded for this show.
      // This is the actual number of horses that competed (not just entries), which
      // is the most accurate representation of the field size.
      totalParticipants: r.show?._count?.competitionResults ?? 0,
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
 * Begin a delayed pregnancy on the dam mare.
 *
 * Phase B (feed-system redesign 2026-04-29): breeding no longer creates a
 * foal Horse row. This handler validates sire/dam, then sets the mare's
 * `inFoalSinceDate`, `pregnancySireId`, `pregnancyFeedingsByTier`, and
 * `lastBredDate`. The foaling job (B5) materialises the foal +7 days later
 * via `foalingService.createFoalFromPregnancy()`.
 *
 * Response shape: 200 with
 *   { success, message, data: { pregnancyStarted, damId, sireId, foalDueDate } }
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function createFoal(req, res) {
  try {
    const { name, breedId, sireId, damId } = req.body;

    logger.info(
      `[horseController.createFoal] Beginning pregnancy: sire ${sireId}, dam ${damId} (foal name "${name}")`,
    );

    // sireId and damId are required; name and breedId are optional and stored as
    // pending intent on the dam for the foaling job to honour when the foal is born.
    if (!sireId || !damId) {
      return res.status(400).json({
        success: false,
        message: 'sireId and damId are required for foal creation',
        data: null,
      });
    }

    // Validate that sire and dam exist.
    const [sire, dam] = await Promise.all([getHorseById(sireId), getHorseById(damId)]);

    if (!sire) {
      return res.status(404).json({
        success: false,
        message: `Sire with ID ${sireId} not found`,
        data: null,
      });
    }

    if (!dam) {
      return res.status(404).json({
        success: false,
        message: `Dam with ID ${damId} not found`,
        data: null,
      });
    }

    // Critical-health gate (Equoria-2e7e): mirrors conformationShowController's A12 check.
    // Both sire and dam must have displayedHealth !== 'critical' before pregnancy can begin.
    if (getDisplayedHealth(sire) === 'critical') {
      const msg = `${sire.name} is in critical health and cannot breed. Feed and vet to restore health.`;
      logger.info(`[horseController.createFoal] Rejected: sire ${sireId} is in critical health`);
      return res.status(400).json({ success: false, message: msg, data: null });
    }
    if (getDisplayedHealth(dam) === 'critical') {
      const msg = `${dam.name} is in critical health and cannot breed. Feed and vet to restore health.`;
      logger.info(`[horseController.createFoal] Rejected: dam ${damId} is in critical health`);
      return res.status(400).json({ success: false, message: msg, data: null });
    }

    // Validate breedId if provided — malformed values must not put the mare
    // into an in-foal state with bad data.
    let normalizedBreedId = null;
    if (breedId !== undefined && breedId !== null && breedId !== '') {
      normalizedBreedId = Number.parseInt(breedId, 10);
      if (!Number.isInteger(normalizedBreedId) || normalizedBreedId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'breedId must be a positive integer',
          data: null,
        });
      }
      const breedRecord = await prisma.breed.findUnique({
        where: { id: normalizedBreedId },
        select: { name: true },
      });
      if (!breedRecord?.name) {
        return res.status(400).json({
          success: false,
          message: `No breed found for id ${normalizedBreedId}`,
          data: null,
        });
      }
    }

    // The mare must not already be in foal.
    if (dam.inFoalSinceDate) {
      return res.status(400).json({
        success: false,
        message: `${dam.name} is already in foal.`,
        data: null,
      });
    }

    const now = new Date();
    await prisma.horse.update({
      where: { id: damId },
      data: {
        inFoalSinceDate: now,
        pregnancySireId: sireId,
        pregnancyFeedingsByTier: {},
        lastBredDate: now,
        pendingFoalName: name ?? null,
        pendingFoalBreedId: normalizedBreedId || null,
      },
    });

    const foalDueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    logger.info(
      `[horseController.createFoal] Pregnancy started for dam ${damId} (sire ${sireId}); foal due ${foalDueDate.toISOString()}`,
    );

    return res.status(200).json({
      success: true,
      message: `${dam.name} is now in foal. The foal will be born in 7 days.`,
      data: {
        pregnancyStarted: true,
        damId,
        sireId,
        foalDueDate: foalDueDate.toISOString(),
      },
    });
  } catch (error) {
    logger.error(`[horseController.createFoal] Error starting pregnancy: ${error.message}`);

    res.status(500).json({
      success: false,
      message: 'Internal server error during pregnancy start',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
      data: null,
    });
  }
}

// Lineage gathering + mare feed-quality assessment moved to
// `services/foalingService.mjs` as part of the B3 delayed-foaling refactor.
// Foal materialisation now happens in `foalingService.createFoalFromPregnancy()`
// when the foaling job (B5) fires +7 days after `createFoal` flips the dam
// into the in-foal state.

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
      disciplineScores: horse.disciplineScores || {},
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
      error: process.env.NODE_ENV !== 'production' ? error.message : 'Internal server error',
    });
  }
}

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
 * Get conformation analysis with percentile rankings compared to the horse's breed.
 * Percentile = percentage of same-breed horses scoring LOWER than this horse per region.
 * Breed mean comes from BREED_GENETIC_PROFILES (designed profile mean, not database average).
 *
 * @param {Object} req - Express request object (req.horse attached by middleware)
 * @param {Object} res - Express response object
 */
export async function getConformationAnalysis(req, res) {
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

    // Guard: breedId must be defined for meaningful percentile analysis
    if (!horse.breedId) {
      return res.status(200).json({
        success: true,
        message: 'No breed assigned — percentile analysis unavailable',
        data: null,
      });
    }

    // Equoria-ecph — Per-region percentiles now computed in Postgres via a
    // single aggregate query, not by loading every same-breed horse into
    // Node memory. The previous findMany() + filter loop was O(N) memory
    // and O(N × 8) compute per request; this approach is O(1) memory and
    // O(N × 8) compute on the DB side using JSONB casts and conditional
    // COUNT(*) FILTER aggregates. Verified equivalent to the old
    // empirical-CDF formula (count_below / total * 100, rounded).
    //
    // We compute the per-region "count of horses with score < horse's score"
    // and the total valid-horse count for this breed in ONE query. Then
    // percentile = round(count_below / total * 100). For overall, the
    // schema may store `overallConformation` on the JSONB OR derive it from
    // the regions; we use COALESCE on the persisted value, otherwise fall
    // back to the 8-region average in the SQL itself.
    const overallScore = scores.overallConformation ?? calculateOverallConformation(scores);

    const regionParams = CONFORMATION_REGIONS.map(r => scores[r] ?? 0);
    // CONFORMATION_REGIONS is a fixed compile-time list so embedding region
    // names in the SQL is safe — no user input touches the identifiers. The
    // 9 numeric thresholds (8 regions + overall) are passed as $1..$9, which
    // Prisma's $queryRawUnsafe with positional parameters safely binds.
    const filterClauses = CONFORMATION_REGIONS.map(
      (region, idx) =>
        `COUNT(*) FILTER (WHERE ("conformationScores"->>'${region}')::numeric < $${idx + 1}) AS lt_${region}`,
    ).join(',\n          ');

    // For "overall", prefer the stored overallConformation; if missing,
    // compute the row's overall as the average of the 8 region scores.
    const overallExpr = `
      COALESCE(
        ("conformationScores"->>'overallConformation')::numeric,
        (
          (
            COALESCE(("conformationScores"->>'head')::numeric, 0) +
            COALESCE(("conformationScores"->>'neck')::numeric, 0) +
            COALESCE(("conformationScores"->>'shoulders')::numeric, 0) +
            COALESCE(("conformationScores"->>'back')::numeric, 0) +
            COALESCE(("conformationScores"->>'hindquarters')::numeric, 0) +
            COALESCE(("conformationScores"->>'legs')::numeric, 0) +
            COALESCE(("conformationScores"->>'hooves')::numeric, 0) +
            COALESCE(("conformationScores"->>'topline')::numeric, 0)
          ) / 8.0
        )
      )
    `;

    // $9 = overallScore. Note: when breedId itself is bound, it's $10.
    // Prisma maps model `Horse` -> table `horses` (see @@map in schema.prisma).
    // Column names retain camelCase identifiers without @map, so they need
    // double-quoting in raw SQL to preserve case sensitivity.
    const sql = `
      SELECT
          COUNT(*)::int AS total,
          ${filterClauses},
          COUNT(*) FILTER (WHERE ${overallExpr} < $9)::int AS lt_overall
      FROM "horses"
      WHERE "breedId" = $10
        AND "conformationScores" IS NOT NULL
    `;

    // Prisma raw queries: positional params.
    const aggRows = await prisma.$queryRawUnsafe(sql, ...regionParams, overallScore, horse.breedId);
    const agg = aggRows?.[0] ?? { total: 0 };
    const totalHorsesInBreed = Number(agg.total ?? 0);
    // BigInt → Number coercion: COUNT(*) returns bigint; cast inline above
    // returns int. Defensive Number() in case driver returns BigInt anyway.

    // Resolve breed name from the DB (covers all 309 breeds, not just
    // the 12 legacy CANONICAL_BREEDS entries).
    const breedRecord = await prisma.breed.findUnique({
      where: { id: horse.breedId },
      select: { name: true },
    });
    const breedName = breedRecord?.name ?? 'Unknown';

    // Get breed profile for designed means. Pulls from breedProfiles.json
    // by name so every breed has a profile.
    let breedConformation = null;
    if (breedRecord?.name) {
      try {
        const profile = getBreedProfile(breedRecord.name);
        const rawConformation = profile?.rating_profiles?.conformation ?? null;
        // Require all 8 regions to have finite means before trusting the profile.
        // A missing or non-finite mean would throw (or produce NaN) when accessed
        // later in the per-region loop and the overall mean calculation.
        if (
          rawConformation &&
          CONFORMATION_REGIONS.every(r => Number.isFinite(rawConformation[r]?.mean))
        ) {
          breedConformation = rawConformation;
        } else if (rawConformation) {
          logger.warn(
            `[horseController.getConformationAnalysis] incomplete conformation profile for "${breedRecord.name}" — one or more regions missing finite mean`,
          );
        }
      } catch (err) {
        logger.warn(
          `[horseController.getConformationAnalysis] breedProfiles lookup failed for "${breedRecord.name}": ${err.message}`,
        );
        // breedConformation remains null; response will include breedMeanAvailable: false
        // so the client can distinguish "breed mean is genuinely 50" from "no profile found".
      }
    }
    const breedMeanAvailable = breedConformation !== null;

    // Calculate analysis per region using the SQL aggregates from above.
    // `agg.lt_<region>` is the count of same-breed horses with conformationScores->region < this horse's score.
    const analysis = {};
    for (const region of CONFORMATION_REGIONS) {
      const score = scores[region] ?? 0;
      const breedMean = breedConformation ? breedConformation[region].mean : null;

      // Percentile: count horses scoring lower / total (same formula as
      // pre-Equoria-ecph, just sourced from the SQL aggregate).
      let percentile;
      if (totalHorsesInBreed <= 1) {
        // Only 1 horse of this breed → default to 50th percentile
        percentile = 50;
      } else {
        const lowerCount = Number(agg[`lt_${region}`] ?? 0);
        percentile = Math.round((lowerCount / totalHorsesInBreed) * 100);
      }

      analysis[region] = { score, breedMean, percentile };
    }

    // Overall conformation analysis — overallScore already computed before SQL.
    const overallBreedMean = breedConformation
      ? Math.round(
          CONFORMATION_REGIONS.reduce((sum, r) => sum + breedConformation[r].mean, 0) /
            CONFORMATION_REGIONS.length,
        )
      : null;

    let overallPercentile;
    if (totalHorsesInBreed <= 1) {
      overallPercentile = 50;
    } else {
      const overallLowerCount = Number(agg.lt_overall ?? 0);
      overallPercentile = Math.round((overallLowerCount / totalHorsesInBreed) * 100);
    }

    logger.info(
      `[horseController.getConformationAnalysis] Analysis for horse ${horse.id} (${breedName}): ${totalHorsesInBreed} same-breed horses`,
    );

    res.status(200).json({
      success: true,
      message: 'Conformation analysis retrieved successfully',
      data: {
        horseId: horse.id,
        horseName: horse.name,
        breedId: horse.breedId,
        breedName,
        breedMeanAvailable,
        totalHorsesInBreed,
        analysis,
        overallConformation: {
          score: overallScore,
          breedMean: overallBreedMean,
          percentile: overallPercentile,
        },
      },
    });
  } catch (error) {
    logger.error(
      `[horseController.getConformationAnalysis] Error: ${error.message}\nStack: ${error.stack}`,
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving conformation analysis',
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

    // Legacy horse without gait scores.
    // Equoria-0hqg policy (Option A — null-forever for pre-31C.1 horses):
    // The add-gait-scores-field migration intentionally left gaitScores nullable
    // with no default. Pre-31C.1 horses have gaitScores=null forever and the
    // 200/data:null response IS the final UX (NFR-06 backward compatibility).
    // Backfill (Option B) was rejected because: (1) regenerating scores would
    // alter existing horse balance and surprise players, (2) any future formula
    // re-tune (see Equoria-22li) would require re-running the backfill, and
    // (3) null is a meaningful "this horse predates the gait system" signal.
    // Frontend MUST treat null as "data not generated yet" — not crash.
    if (!gaitScores) {
      return res.status(200).json({
        success: true,
        message: 'No gait scores available for this horse',
        data: null,
      });
    }

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
 * POST /api/v1/horses/:id/reset-last-fed
 * Owner-scoped test/fixture helper that rewinds the horse's lastFedDate by N
 * days (default 1) so the same-day feed gate (alreadyFedToday) no longer
 * blocks a subsequent feed within the same E2E session.
 *
 * Background (Equoria-4sqr): feed-system-phase-b test 2 must feed the
 * pregnant mare to verify pregnancyFeedingsByTier increments, but the mare
 * was already fed in beforeAll to satisfy the critical-health breeding gate
 * (Equoria-2e7e). Without this endpoint there's no way to satisfy both.
 *
 * Why owner-scoped, not admin-only: the E2E global-setup flow creates a
 * regular user without admin role, so an admin-only endpoint cannot be hit
 * from the test session. The operation has no privilege impact — rewinding
 * the user's OWN horse's lastFedDate is functionally equivalent to "skip a
 * real-world day" and grants no advantage over honest play (the user could
 * already just wait 24h).
 *
 * Mounted on authRouter via horseRoutes.mjs with requireOwnership('horse'),
 * so a user cannot reset a horse they don't own. Rate-limited.
 *
 * Body: { days?: number }  — days to subtract from now (default 1, max 30).
 */
export async function resetHorseLastFed(req, res) {
  try {
    // requireOwnership middleware pre-attaches the horse to req.horse and
    // validates that req.user owns it. Defensive guard in case middleware
    // ordering changes in the future.
    if (!req.horse) {
      logger.error(
        '[horseController.resetHorseLastFed] req.horse not set — requireOwnership middleware did not run',
      );
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }

    const days = Number(req.body?.days ?? 1);
    if (!Number.isFinite(days) || days < 0 || days > 30) {
      return res
        .status(400)
        .json({ success: false, message: 'days must be a number between 0 and 30' });
    }

    const newLastFed = new Date();
    newLastFed.setDate(newLastFed.getDate() - days);

    logger.info(
      `[horseController.resetHorseLastFed] horse ${req.horse.id} — rewinding lastFedDate by ${days} day(s) to ${newLastFed.toISOString()}`,
    );

    const updated = await prisma.horse.update({
      where: { id: req.horse.id },
      data: { lastFedDate: newLastFed },
      select: { id: true, name: true, lastFedDate: true },
    });

    return res.status(200).json({
      success: true,
      message: `Horse ${req.horse.id} lastFedDate rewound by ${days} day(s)`,
      // Explicit ISO conversion — some Prisma client builds serialize Date as
      // an empty object via JSON.stringify, so we coerce defensively.
      data: {
        id: updated.id,
        name: updated.name,
        lastFedDate: updated.lastFedDate ? new Date(updated.lastFedDate).toISOString() : null,
      },
    });
  } catch (error) {
    logger.error(
      `[horseController.resetHorseLastFed] Error: ${error.message}\nStack: ${error.stack}`,
    );
    return res.status(500).json({
      success: false,
      message: 'Failed to reset lastFedDate',
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

/**
 * List a stallion at stud (Equoria-q072).
 * POST /api/v1/horses/:id/stud-listing
 * Body: { studFee: number (non-negative integer) }
 */
export async function listHorseAtStud(req, res) {
  try {
    if (!req.horse) {
      logger.error(
        '[horseController.listHorseAtStud] req.horse not set — requireOwnership middleware did not run',
      );
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    if (req.horse.sex !== 'Stallion') {
      return res.status(400).json({
        success: false,
        message: 'Only stallions can be listed at stud',
      });
    }

    const studFee = Number(req.body?.studFee);
    if (!Number.isFinite(studFee) || !Number.isInteger(studFee) || studFee < 0) {
      return res.status(400).json({
        success: false,
        message: 'studFee must be a non-negative integer',
      });
    }

    const updated = await prisma.horse.update({
      where: { id: req.horse.id },
      data: { studStatus: 'At Public Stud', studFee },
      select: { id: true, name: true, sex: true, studStatus: true, studFee: true },
    });

    logger.info(
      `[horseController.listHorseAtStud] horse ${updated.id} listed at stud for fee ${studFee}`,
    );

    return res.status(200).json({
      success: true,
      message: `Horse ${updated.name} listed at stud`,
      data: updated,
    });
  } catch (error) {
    logger.error(
      `[horseController.listHorseAtStud] Error: ${error.message}\nStack: ${error.stack}`,
    );
    return res.status(500).json({ success: false, message: 'Failed to list horse at stud' });
  }
}

/**
 * Unlist a stallion from stud (Equoria-q072).
 * DELETE /api/v1/horses/:id/stud-listing
 */
export async function unlistHorseAtStud(req, res) {
  try {
    if (!req.horse) {
      logger.error(
        '[horseController.unlistHorseAtStud] req.horse not set — requireOwnership middleware did not run',
      );
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    const updated = await prisma.horse.update({
      where: { id: req.horse.id },
      data: { studStatus: 'Not at Stud', studFee: 0 },
      select: { id: true, name: true, sex: true, studStatus: true, studFee: true },
    });

    logger.info(`[horseController.unlistHorseAtStud] horse ${updated.id} unlisted from stud`);

    return res.status(200).json({
      success: true,
      message: `Horse ${updated.name} unlisted from stud`,
      data: updated,
    });
  } catch (error) {
    logger.error(
      `[horseController.unlistHorseAtStud] Error: ${error.message}\nStack: ${error.stack}`,
    );
    return res.status(500).json({ success: false, message: 'Failed to unlist horse from stud' });
  }
}
