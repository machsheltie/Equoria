/**
 * Flag Evaluation Engine
 * Core engine for evaluating and assigning epigenetic flags based on care patterns
 *
 * 🎯 PURPOSE:
 * Runs weekly evaluation between birth and age 3 to determine which epigenetic flags
 * should be assigned based on cumulative care patterns and trigger conditions.
 *
 * 📋 BUSINESS RULES:
 * - Evaluates horses aged 0-3 years only
 * - Maximum 5 flags per horse
 * - Flags are permanent once assigned
 * - Weekly evaluation cycles
 * - Trigger conditions must be met for flag assignment
 * - Flags can stack but cannot be overwritten
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from './logger.mjs';
import {
  EPIGENETIC_FLAG_DEFINITIONS,
  MAX_FLAGS_PER_HORSE,
  FLAG_EVALUATION_AGE_RANGE,
} from '../config/epigeneticFlagDefinitions.mjs';
import {
  analyzeCarePatterns,
  analyzeLoadedCarePatterns,
  careWindowInteractions,
} from './carePatternAnalysis.mjs';
import { getHorseAgeYears } from './horseAge.mjs';
// Equoria-cmw85.38: the per-flag trigger rules and the predisposition bias live in
// flagTriggerRules.mjs (moved verbatim so this file stays under the 600-line cap).
import { flagPredispositionBias, evaluateFlagTriggers } from './flagTriggerRules.mjs';

export { flagPredispositionBias };

// Equoria-wpqr: FLAG_EVALUATION_AGE_RANGE is expressed in canonical
// game-years (1 game-week = 1 game-year = 7 real days). The DB-level
// getEligibleHorses() window needs a real-day delta, so convert the
// game-year bound to real days here rather than the old `* 365.25`
// calendar-year constant. This duplicates DAYS_PER_GAME_YEAR from
// backend/utils/horseAge.mjs (kept module-private there) as a named
// constant rather than widening that module's API for one caller.
const REAL_DAYS_PER_GAME_YEAR = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Derive the foal's predisposed-flag Set from its parents' epigeneticFlags.
 * Loads sire + dam in a single query (filtering nulls). Returns the UNION of
 * both parents' flag arrays as a lowercase Set. A foal with no parents, or
 * parents with no flags, yields an empty Set (regression-safe no-op).
 * @param {number|null} sireId
 * @param {number|null} damId
 * @returns {Promise<Set<string>>}
 */
async function getPredisposedFlags(sireId, damId) {
  const parentIds = [sireId, damId].filter(id => id !== null && id !== undefined);
  if (parentIds.length === 0) {
    return new Set();
  }

  const parents = await prisma.horse.findMany({
    where: { id: { in: parentIds } },
    select: { id: true, epigeneticFlags: true },
  });
  return unionParentFlags(parents);
}

/**
 * The UNION of the given parents' epigeneticFlags as a lowercase Set (missing
 * parents and non-string entries ignored). Shared by the single read above and
 * the weekly batch (Equoria-cmw85.38), which reads every parent once.
 * @param {Array<{epigeneticFlags: unknown}|undefined>} parents
 * @returns {Set<string>}
 */
function unionParentFlags(parents) {
  const predisposed = new Set();
  for (const parent of parents) {
    const flags = Array.isArray(parent?.epigeneticFlags) ? parent.epigeneticFlags : [];
    for (const flag of flags) {
      if (typeof flag === 'string' && flag.length > 0) {
        predisposed.add(flag.toLowerCase());
      }
    }
  }
  return predisposed;
}

/** The horse fields a flag evaluation reads. */
const flagHorseSelect = Object.freeze({
  id: true,
  name: true,
  dateOfBirth: true,
  epigeneticFlags: true,
  bondScore: true,
  stressLevel: true,
  // Equoria-yzqhj.4: parents reachable for live predisposition derivation.
  sireId: true,
  damId: true,
});

/**
 * Evaluate flags for a specific horse
 * @param {number} horseId - ID of the horse to evaluate
 * @param {Date} evaluationDate - Date of evaluation (default: now)
 * @returns {Object} Evaluation results with newly assigned flags
 */
export async function evaluateHorseFlags(horseId, evaluationDate = new Date()) {
  logger.info(`[flagEvaluationEngine] Starting flag evaluation for horse ${horseId}`);

  // Get horse with current flags
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: flagHorseSelect,
  });

  if (!horse) {
    throw new Error(`Horse with ID ${horseId} not found`);
  }

  // Equoria-yzqhj.4: derive the foal's predisposed-flag set LIVE from its
  // parents' epigeneticFlags (union of sire + dam). No schema column, no
  // birth-time snapshot — a single inheritance path applied at the canonical
  // 0-3yr flag evaluation. Empty set for parentless foals → no bias.
  const predisposedFlags = await getPredisposedFlags(horse.sireId, horse.damId);

  return evaluateLoadedHorseFlags(horse, predisposedFlags, evaluationDate, {
    loadCareAnalysis: () => analyzeCarePatterns(horseId, evaluationDate),
    writeFlags: flags =>
      prisma.horse.update({ where: { id: horseId }, data: { epigeneticFlags: flags } }),
  });
}

/**
 * The flag rules for one horse already read (Equoria-cmw85.38). The care
 * analysis and the flag write are supplied by the caller, so the single-horse
 * path and the weekly batch run the same rules in the same order: age window,
 * flag cap, care analysis (read only when both pass), triggers, one write.
 *
 * @param {Object} horse - flagHorseSelect fields
 * @param {Set<string>} predisposedFlags
 * @param {Date} evaluationDate
 * @param {{ loadCareAnalysis: Function, writeFlags: Function }} io
 * @returns {Promise<Object>} Evaluation results with newly assigned flags
 */
async function evaluateLoadedHorseFlags(horse, predisposedFlags, evaluationDate, io) {
  const horseId = horse.id;

  // Equoria-wpqr: canonical game-years (1 game-week = 1 game-year,
  // floor(ageDays / 7), date-only, Eastern game clock) via the single-source-of-truth
  // helper, NOT raw calendar `/ 365.25` math. The calendar reading made
  // the FLAG_EVALUATION_AGE_RANGE gate below effectively never reject
  // real game-aged horses: a 35-real-day-old horse is 5 game-years
  // (canonically OUT of the 0-3 range) but the old math computed
  // ageInYears ≈ 0.10 and wrongly treated it as in-range. Mirrors
  // Equoria-z183 (carePatternAnalysis) / Equoria-8qu4 / Equoria-rkld.
  const ageInYears = getHorseAgeYears(horse.dateOfBirth, evaluationDate);

  if (ageInYears < FLAG_EVALUATION_AGE_RANGE.MIN || ageInYears >= FLAG_EVALUATION_AGE_RANGE.MAX) {
    return {
      success: false,
      reason: `Horse age ${ageInYears} game-years is outside evaluation range (${FLAG_EVALUATION_AGE_RANGE.MIN}-${FLAG_EVALUATION_AGE_RANGE.MAX} game-years)`,
      horseId,
      horseName: horse.name,
      currentFlags: horse.epigeneticFlags || [],
      newFlags: [],
    };
  }

  // Check flag limit
  const currentFlags = horse.epigeneticFlags || [];
  if (currentFlags.length >= MAX_FLAGS_PER_HORSE) {
    return {
      success: false,
      reason: `Horse already has maximum number of flags (${MAX_FLAGS_PER_HORSE})`,
      horseId,
      horseName: horse.name,
      currentFlags,
      newFlags: [],
    };
  }

  // Analyze care patterns
  const careAnalysis = await io.loadCareAnalysis();

  if (!careAnalysis.eligible) {
    return {
      success: false,
      reason: careAnalysis.reason,
      horseId,
      horseName: horse.name,
      currentFlags,
      newFlags: [],
    };
  }

  // Evaluate each flag definition against care patterns
  const flagEvaluations = [];
  const newFlags = [];

  for (const [_flagKey, flagDef] of Object.entries(EPIGENETIC_FLAG_DEFINITIONS)) {
    // Skip if horse already has this flag
    if (currentFlags.includes(flagDef.name)) {
      continue;
    }

    // Evaluate trigger conditions. Equoria-yzqhj.4: pass whether the foal is
    // predisposed to THIS specific flag (parent inheritance) so the per-flag
    // trigger fns relax only that flag's numeric thresholds.
    const predisposed = predisposedFlags.has(flagDef.name.toLowerCase());
    const evaluation = evaluateFlagTriggers(flagDef, careAnalysis.patterns, predisposed);
    flagEvaluations.push({
      flagName: flagDef.name,
      flagType: flagDef.type,
      triggered: evaluation.triggered,
      score: evaluation.score,
      conditions: evaluation.conditions,
      // Equoria-yzqhj.4: surface whether parent predisposition was in effect.
      predisposed,
    });

    // If triggered and we haven't reached the limit, assign the flag
    if (evaluation.triggered && currentFlags.length + newFlags.length < MAX_FLAGS_PER_HORSE) {
      newFlags.push(flagDef.name);
      logger.info(`[flagEvaluationEngine] Flag '${flagDef.name}' triggered for horse ${horseId}`);
    }
  }

  // Update horse with new flags if any were assigned
  if (newFlags.length > 0) {
    const updatedFlags = [...currentFlags, ...newFlags];
    await io.writeFlags(updatedFlags);

    logger.info(
      `[flagEvaluationEngine] Assigned ${newFlags.length} new flags to horse ${horseId}: ${newFlags.join(', ')}`,
    );
  }

  return {
    success: true,
    horseId,
    horseName: horse.name,
    // Equoria-wpqr: integer canonical game-years (was .toFixed(2) on the
    // old fractional calendar value — now an integer from getHorseAgeYears).
    ageInYears,
    currentFlags,
    newFlags,
    totalFlags: currentFlags.length + newFlags.length,
    careAnalysis,
    flagEvaluations,
    evaluationDate,
  };
}

/**
 * Horses read per batch by batchEvaluateFlags (Equoria-cmw85.38). Bounds the
 * id list and the interaction rows held in memory at once.
 */
export const flagBatchSize = 200;

/**
 * Read one batch for the weekly evaluation: the horses with their care-window
 * interactions (one findMany) and every parent they name (one findMany).
 * Parents are read once at the start of the batch; a parent cannot change
 * during it, because a horse in the 0-3 window is too young to be a parent.
 */
async function loadFlagBatch(client, horseIds, evaluationDate) {
  const horses = await client.horse.findMany({
    where: { id: { in: horseIds } },
    select: { ...flagHorseSelect, groomInteractions: careWindowInteractions(evaluationDate) },
  });
  const parentIds = [
    ...new Set(
      horses.flatMap(h => [h.sireId, h.damId]).filter(id => id !== null && id !== undefined),
    ),
  ];
  const parents =
    parentIds.length > 0
      ? await client.horse.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, epigeneticFlags: true },
        })
      : [];
  return {
    horsesById: new Map(horses.map(h => [h.id, h])),
    parentsById: new Map(parents.map(p => [p.id, p])),
  };
}

/**
 * Batch evaluate flags for multiple horses.
 *
 * Equoria-cmw85.38 (decision 2026-10-23, option B): set-based READS, SERIAL
 * writes. Each batch of flagBatchSize ids costs two reads (horses with their
 * interactions, then parents) instead of ~4 statements per horse, and uses no
 * extra connection: the writes are one update per horse that gains flags, in
 * input order, exactly as before. Results are unchanged: same entries, same
 * order, an error entry for a missing horse or a failed evaluation.
 *
 * @param {Array} horseIds - Array of horse IDs to evaluate
 * @param {Date} evaluationDate - Date of evaluation (default: now)
 * @param {{ client?: Object }} [options] - Prisma client (default: the shared one)
 * @returns {Array} Array of evaluation results
 */
export async function batchEvaluateFlags(
  horseIds,
  evaluationDate = new Date(),
  { client = prisma } = {},
) {
  const results = [];

  for (let start = 0; start < horseIds.length; start += flagBatchSize) {
    const batchIds = horseIds.slice(start, start + flagBatchSize);
    let batch;
    try {
      batch = await loadFlagBatch(client, batchIds, evaluationDate);
    } catch (error) {
      batch = { error };
    }

    for (const horseId of batchIds) {
      try {
        if (batch.error) {
          throw batch.error;
        }
        logger.info(`[flagEvaluationEngine] Starting flag evaluation for horse ${horseId}`);
        const horse = batch.horsesById.get(horseId);
        if (!horse) {
          throw new Error(`Horse with ID ${horseId} not found`);
        }
        const predisposedFlags = unionParentFlags([
          batch.parentsById.get(horse.sireId),
          batch.parentsById.get(horse.damId),
        ]);
        const result = await evaluateLoadedHorseFlags(horse, predisposedFlags, evaluationDate, {
          loadCareAnalysis: () => analyzeLoadedCarePatterns(horse, evaluationDate),
          writeFlags: async flags => {
            await client.horse.update({ where: { id: horseId }, data: { epigeneticFlags: flags } });
            // A repeated id later in the list sees the flags just written, as a re-read would.
            horse.epigeneticFlags = flags;
          },
        });
        results.push(result);
      } catch (error) {
        logger.error(
          `[flagEvaluationEngine] Error in batch evaluation for horse ${horseId}: ${error.message}`,
        );
        results.push({
          success: false,
          horseId,
          error: error.message,
        });
      }
    }
  }

  return results;
}

/**
 * Get horses eligible for flag evaluation
 * @param {Date} evaluationDate - Date of evaluation (default: now)
 * @returns {Array} Array of eligible horse IDs
 */
export async function getEligibleHorses(evaluationDate = new Date()) {
  // Equoria-wpqr: derive the birthdate window from canonical game-years,
  // not calendar `* 365.25` years. MAX game-years maps to
  // MAX * 7 real days; a horse born more than that many real days ago is
  // past the developmental window. MIN game-years (0) maps to "born now
  // or earlier". Without this conversion a 35-real-day-old horse
  // (5 game-years, out of range) fell inside a ~3-calendar-year window
  // and was wrongly returned as eligible. This is a coarse DB pre-filter;
  // evaluateHorseFlags re-checks each horse with the authoritative
  // getHorseAgeYears gate.
  const minBirthDate = new Date(
    evaluationDate.getTime() - FLAG_EVALUATION_AGE_RANGE.MAX * REAL_DAYS_PER_GAME_YEAR * MS_PER_DAY,
  );
  const maxBirthDate = new Date(
    evaluationDate.getTime() - FLAG_EVALUATION_AGE_RANGE.MIN * REAL_DAYS_PER_GAME_YEAR * MS_PER_DAY,
  );

  const eligibleHorses = await prisma.horse.findMany({
    where: {
      dateOfBirth: {
        gte: minBirthDate,
        lte: maxBirthDate,
      },
    },
    select: {
      id: true,
      name: true,
      dateOfBirth: true,
      epigeneticFlags: true,
    },
  });

  // Filter horses with less than max flags in JavaScript
  const filteredHorses = eligibleHorses.filter(
    horse => (horse.epigeneticFlags || []).length < MAX_FLAGS_PER_HORSE,
  );

  return filteredHorses.map(horse => horse.id);
}

export default {
  evaluateHorseFlags,
  batchEvaluateFlags,
  getEligibleHorses,
  evaluateFlagTriggers,
};
