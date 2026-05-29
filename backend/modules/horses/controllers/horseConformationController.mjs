/**
 * Horse Conformation Controller
 *
 * Equoria-xod8b (child A of Equoria-mh937): extracted from horseController.mjs.
 * Owns conformation + conformation-analysis + gait endpoints.
 * No behavior changes — functions moved verbatim.
 */
import {
  CONFORMATION_REGIONS,
  calculateOverallConformation,
} from '../services/conformationService.mjs';
import { getBreedProfile } from '../data/breedProfileLoader.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
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
