/**
 * foalingService — materialises a foal record from a delayed pregnancy.
 *
 * Phase B (feed-system redesign 2026-04-29): breeding no longer creates a
 * foal Horse row immediately. POST /api/horses/foals only sets the mare's
 * pregnancy state (`inFoalSinceDate`, `pregnancySireId`,
 * `pregnancyFeedingsByTier`). Seven days later the foaling job (B5) calls
 * `createFoalFromPregnancy()` here, which contains the foal-generation
 * pipeline previously inlined in `horseController.createFoal`:
 *
 *   - lineage gathering (3 generations)
 *   - epigenetic-trait roll at birth (mare stress + lineage + feed quality)
 *   - conformation, gait, temperament generation (or inherited)
 *   - the actual `createHorse()` insert
 *   - resetting the dam's pregnancy columns
 *
 * Note: B4 (per-feeding tier counters → epigenetic adjustments) and B5
 * (cron job that fires at +7 days) are pending; this service exposes the
 * function shape so they can call it without further refactoring.
 *
 * @module modules/horses/services/foalingService
 */

import { createHorse, getHorseById } from '../../../models/horseModel.mjs';
import { applyEpigeneticTraitsAtBirth } from '../../../utils/applyEpigeneticTraitsAtBirth.mjs';
import {
  generateConformationScores,
  generateInheritedConformationScores,
  hasValidConformationScores,
} from './conformationService.mjs';
import {
  generateGaitScores,
  generateInheritedGaitScores,
  hasValidGaitScores,
} from './gaitService.mjs';
import { generateTemperament } from './temperamentService.mjs';
import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';
import { calculatePregnancyEpigeneticChances } from '../../../utils/pregnancyBonus.mjs';
import { createNotification } from '../../../utils/notificationService.mjs';

/**
 * Length of an Equoria gestation. Mirrors GESTATION_DAYS in
 * pregnancyBonus.mjs but kept local so the foaling job's date math is
 * self-contained.
 */
const GESTATION_DAYS = 7;
const GESTATION_MS = GESTATION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Pool of bonus epigenetic traits the pregnancy formula can roll on top of
 * the regular at-birth pipeline. The first trait NOT already present is
 * added so duplicates are avoided.
 */
const PREGNANCY_BONUS_POSITIVE_TRAITS = Object.freeze([
  'wellNourished',
  'resilient',
  'vigorous',
  'calm',
]);
const PREGNANCY_BONUS_NEGATIVE_TRAITS = Object.freeze([
  'undernourished',
  'fragile',
  'weakImmunity',
  'lowVigor',
]);

function pickFirstUnused(pool, existing) {
  for (const trait of pool) {
    if (!existing.includes(trait)) {
      return trait;
    }
  }
  return null;
}

/**
 * Map a mare's healthStatus + bondScore to the 0-100 feedQuality metric used
 * by `applyEpigeneticTraitsAtBirth`. Mirrors the implementation that lived
 * inline in `horseController.createFoal` before the B3 refactor.
 */
function assessFeedQualityFromMare(mare) {
  try {
    let feedQuality = 50;
    switch (mare.healthStatus) {
      case 'Excellent':
        feedQuality = 90;
        break;
      case 'Good':
        feedQuality = 75;
        break;
      case 'Fair':
        feedQuality = 55;
        break;
      case 'Poor':
        feedQuality = 30;
        break;
      case 'Critical':
        feedQuality = 15;
        break;
      default:
        feedQuality = 50;
    }
    const bondScore = mare.bondScore || 50;
    if (bondScore >= 80) {
      feedQuality += 10;
    } else if (bondScore >= 60) {
      feedQuality += 5;
    } else if (bondScore <= 30) {
      feedQuality -= 10;
    }
    return Math.max(0, Math.min(100, feedQuality));
  } catch (error) {
    logger.error(`[foalingService.assessFeedQualityFromMare] ${error.message}`);
    return 50;
  }
}

/**
 * Walk the sire/dam ancestry up to `generations` generations and return a
 * flattened array of ancestor records keyed by id (cycle-guarded). The
 * returned shape matches the legacy controller output so trait roll logic
 * keeps its existing behavior.
 */
async function gatherLineage(sireId, damId, generations) {
  try {
    const ancestors = [];
    const toProcess = [
      { id: sireId, generation: 0 },
      { id: damId, generation: 0 },
    ];
    const processed = new Set();

    while (toProcess.length > 0) {
      const { id, generation } = toProcess.shift();
      if (processed.has(id) || generation >= generations) {
        continue;
      }
      processed.add(id);

      const horse = await prisma.horse.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          sireId: true,
          damId: true,
          disciplineScores: true,
          trait: true,
          temperament: true,
        },
      });
      if (!horse) {
        continue;
      }

      let primaryDiscipline = null;
      if (horse.disciplineScores && typeof horse.disciplineScores === 'object') {
        let maxScore = 0;
        Object.entries(horse.disciplineScores).forEach(([discipline, score]) => {
          if (typeof score === 'number' && score > maxScore) {
            maxScore = score;
            primaryDiscipline = discipline;
          }
        });
      }

      ancestors.push({
        id: horse.id,
        name: horse.name,
        discipline: primaryDiscipline,
        disciplineScores: horse.disciplineScores,
        generation,
        trait: horse.trait,
        temperament: horse.temperament,
      });

      if (horse.sireId && generation + 1 < generations) {
        toProcess.push({ id: horse.sireId, generation: generation + 1 });
      }
      if (horse.damId && generation + 1 < generations) {
        toProcess.push({ id: horse.damId, generation: generation + 1 });
      }
    }
    return ancestors;
  } catch (error) {
    logger.error(`[foalingService.gatherLineage] Error: ${error.message}`);
    return [];
  }
}

/**
 * Materialise a foal from a mare's pregnancy state.
 *
 * Reads the dam's `inFoalSinceDate` / `pregnancySireId` /
 * `pregnancyFeedingsByTier`, generates the foal exactly as the legacy
 * `createFoal` controller did, inserts the Horse row, and clears the dam's
 * pregnancy columns. The B5 foaling job is the expected caller.
 *
 * @param {object} params
 * @param {number} params.damId - id of the in-foal mare
 * @param {object} [params.options] - { name?, breedId?, sex?, ownerId?,
 *   userId?, playerId?, stableId?, healthStatus?, positiveTraitChance?,
 *   negativeTraitChance?, rng?, skipDamReset?, damSnapshot?, sireSnapshot? }.
 *   The bonus chance fields are produced by
 *   `calculatePregnancyEpigeneticChances()` and applied as independent rolls
 *   on top of `applyEpigeneticTraitsAtBirth`. `rng` is a () => number
 *   returning [0,1); defaults to Math.random. `damSnapshot` (and optional
 *   `sireSnapshot`) lets the foaling job pass a pre-claim snapshot when the
 *   dam's pregnancy columns were already cleared atomically — the function
 *   then skips the in-foal validation and bypasses the trailing dam reset
 *   (forced via `skipDamReset=true`).
 * @returns {Promise<object>} the created foal Horse row + applied traits
 */
export async function createFoalFromPregnancy({ damId, options = {} } = {}) {
  if (!damId) {
    throw new Error('createFoalFromPregnancy: damId is required');
  }

  // The foaling job atomically claims the mare (clears pregnancy columns)
  // BEFORE invoking this function and passes the pre-claim snapshot via
  // options.damSnapshot. In that mode we skip the in-foal validation since
  // the snapshot already verified it. Direct callers pass no snapshot and
  // get the read-and-validate behavior.
  let dam;
  let sireId;
  if (options.damSnapshot) {
    dam = options.damSnapshot;
    sireId = options.sireSnapshot?.id ?? dam.pregnancySireId;
    if (!sireId) {
      throw new Error(`createFoalFromPregnancy: damSnapshot for ${damId} missing pregnancySireId`);
    }
  } else {
    dam = await prisma.horse.findUnique({ where: { id: damId } });
    if (!dam) {
      throw new Error(`createFoalFromPregnancy: dam ${damId} not found`);
    }
    if (!dam.inFoalSinceDate || !dam.pregnancySireId) {
      throw new Error(`createFoalFromPregnancy: mare ${damId} is not in foal`);
    }
    sireId = dam.pregnancySireId;
  }

  const sire = options.sireSnapshot ?? (await getHorseById(sireId));
  if (!sire) {
    throw new Error(`createFoalFromPregnancy: pregnancy sire ${sireId} not found`);
  }

  const mareStats = {
    id: dam.id,
    name: dam.name,
    stressLevel: dam.stressLevel || 50,
    bondScore: dam.bondScore || 50,
    healthStatus: dam.healthStatus || 'Good',
  };
  const lineage = await gatherLineage(sireId, damId, 3);
  const feedQuality = assessFeedQualityFromMare(mareStats);
  const { stressLevel } = mareStats;

  const epigeneticTraits = applyEpigeneticTraitsAtBirth({
    mare: mareStats,
    lineage,
    feedQuality,
    stressLevel,
  });

  // B5: per-feeding pregnancy bonus rolls. The foaling job passes
  // positiveTraitChance / negativeTraitChance (0..100 percent points)
  // computed by calculatePregnancyEpigeneticChances(); independent rolls.
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const positiveChance = Number(options.positiveTraitChance) || 0;
  const negativeChance = Number(options.negativeTraitChance) || 0;
  const positiveTraits = [...(epigeneticTraits.positive || [])];
  const negativeTraits = [...(epigeneticTraits.negative || [])];

  if (positiveChance > 0 && rng() * 100 < positiveChance) {
    const bonus = pickFirstUnused(PREGNANCY_BONUS_POSITIVE_TRAITS, positiveTraits);
    if (bonus) {
      positiveTraits.push(bonus);
      logger.info(
        `[foalingService] Bonus positive epigenetic trait '${bonus}' rolled (chance=${positiveChance}%)`,
      );
    }
  }
  if (negativeChance > 0 && rng() * 100 < negativeChance) {
    const bonus = pickFirstUnused(PREGNANCY_BONUS_NEGATIVE_TRAITS, negativeTraits);
    if (bonus) {
      negativeTraits.push(bonus);
      logger.info(
        `[foalingService] Bonus negative epigenetic trait '${bonus}' rolled (chance=${negativeChance}%)`,
      );
    }
  }

  // Resolve breed name. B3 uses the dam's breed by default; B5 can pass a
  // different breed via options when the original breed payload is stored.
  const requestedBreedId =
    options.breedId !== undefined ? Number.parseInt(options.breedId, 10) : dam.breedId;
  if (!Number.isInteger(requestedBreedId) || requestedBreedId <= 0) {
    throw new Error(`createFoalFromPregnancy: invalid breedId ${requestedBreedId}`);
  }
  const breedRecord = await prisma.breed.findUnique({
    where: { id: requestedBreedId },
    select: { name: true },
  });
  if (!breedRecord?.name) {
    throw new Error(`createFoalFromPregnancy: breed ${requestedBreedId} not found`);
  }
  const breedName = breedRecord.name;

  const sireConformation = sire.conformationScores;
  const damConformation = dam.conformationScores;
  const conformationScores =
    hasValidConformationScores(sireConformation) && hasValidConformationScores(damConformation)
      ? generateInheritedConformationScores(breedName, sireConformation, damConformation)
      : generateConformationScores(breedName);

  const sireGaitScores = sire.gaitScores;
  const damGaitScores = dam.gaitScores;
  const gaitScores =
    hasValidGaitScores(sireGaitScores) && hasValidGaitScores(damGaitScores)
      ? generateInheritedGaitScores(breedName, sireGaitScores, damGaitScores, conformationScores)
      : generateGaitScores(breedName, conformationScores);

  const temperament = generateTemperament(breedName);

  // Sex: callers (e.g. the breed controller for direct calls) may supply
  // options.sex; the foaling job does not, so randomize 50/50 using rng.
  const resolvedSex = options.sex ? options.sex : rng() < 0.5 ? 'Filly' : 'Colt';

  const horseData = {
    name: options.name || `${dam.name} Foal`,
    age: 0,
    breedId: requestedBreedId,
    sireId,
    damId,
    sex: resolvedSex,
    ownerId: options.ownerId,
    userId: options.userId || dam.userId,
    playerId: options.playerId,
    stableId: options.stableId,
    healthStatus: options.healthStatus || 'Excellent',
    dateOfBirth: new Date().toISOString(),
    conformationScores,
    gaitScores,
    temperament,
    epigeneticModifiers: {
      positive: positiveTraits,
      negative: negativeTraits,
      hidden: [],
    },
    _epigeneticTraitsApplied: true,
  };

  const newFoal = await createHorse(horseData);

  const notifUserId = options.userId || dam.userId;
  if (notifUserId) {
    await createNotification(notifUserId, 'foal_born', {
      foalName: newFoal.name,
      foalId: newFoal.id,
      damName: dam.name,
      sireName: sire.name,
    });
  }

  // Clear the mare's pregnancy state. The foaling job already cleared it as
  // part of the atomic per-mare claim (skipDamReset=true) so we don't
  // re-write the same nulls here.
  if (!options.skipDamReset) {
    await prisma.horse.update({
      where: { id: damId },
      data: {
        inFoalSinceDate: null,
        pregnancySireId: null,
        pregnancyFeedingsByTier: {},
      },
    });
  }

  logger.info(
    `[foalingService.createFoalFromPregnancy] Foaled ${newFoal.name} (id=${newFoal.id}) from dam ${damId}/sire ${sireId}`,
  );

  return {
    foal: newFoal,
    appliedTraits: { positive: positiveTraits, negative: negativeTraits },
    breedingAnalysis: {
      mareStress: stressLevel,
      feedQuality,
      lineageCount: lineage.length,
      pregnancyBonus: { positiveChance, negativeChance },
      sire: { id: sire.id, name: sire.name },
      dam: { id: dam.id, name: dam.name },
    },
  };
}

/**
 * Foaling job — finds every mare whose gestation has elapsed (>= 7 days) and
 * delivers each foal. Per-mare isolation: a failure on one mare does not
 * abort the run. Idempotent: an atomic "claim" via `updateMany()` guards
 * against duplicate foaling when two job runners overlap or a single run is
 * invoked twice.
 *
 * @param {object} [opts]
 * @param {Date}     [opts.now] - test seam; defaults to new Date().
 * @param {Function} [opts.rng] - test seam for the bonus rolls; defaults to
 *   Math.random. Each mare uses the same rng instance.
 * @returns {Promise<{foalsBorn:number, errors:Array<{damId:number,error:string}>}>}
 */
export async function runFoalingJob({ now = new Date(), rng = Math.random } = {}) {
  const cutoff = new Date(now.getTime() - GESTATION_MS);
  logger.info(
    `[foalingService.runFoalingJob] Searching for mares due as of ${cutoff.toISOString()}`,
  );

  const candidates = await prisma.horse.findMany({
    where: {
      inFoalSinceDate: { lte: cutoff },
      pregnancySireId: { not: null },
    },
    select: {
      id: true,
      name: true,
      userId: true,
      breedId: true,
      stressLevel: true,
      bondScore: true,
      healthStatus: true,
      conformationScores: true,
      gaitScores: true,
      inFoalSinceDate: true,
      pregnancySireId: true,
      pregnancyFeedingsByTier: true,
      pendingFoalName: true,
      pendingFoalBreedId: true,
    },
  });

  let foalsBorn = 0;
  const errors = [];

  for (const candidate of candidates) {
    const damId = candidate.id;
    const snapshot = { ...candidate };

    // Atomic claim: clear pregnancy state if (and only if) it's still set.
    // Two parallel runners can each call findMany() and see the same dam,
    // but only ONE updateMany() will match (count=1); the other gets count=0
    // and skips. This is the idempotency guarantee.
    let claimed = 0;
    try {
      const claim = await prisma.horse.updateMany({
        where: {
          id: damId,
          inFoalSinceDate: { lte: cutoff },
          pregnancySireId: { not: null },
        },
        data: {
          inFoalSinceDate: null,
          pregnancySireId: null,
          pregnancyFeedingsByTier: {},
          pendingFoalName: null,
          pendingFoalBreedId: null,
        },
      });
      claimed = claim.count;
    } catch (err) {
      logger.error(`[foalingService.runFoalingJob] Claim failed for dam ${damId}: ${err.message}`);
      errors.push({ damId, error: err.message });
      continue;
    }

    if (claimed === 0) {
      logger.info(`[foalingService.runFoalingJob] Dam ${damId} already claimed; skipping`);
      continue;
    }

    try {
      const { positive_chance: positiveChance, negative_chance: negativeChance } =
        calculatePregnancyEpigeneticChances(snapshot.pregnancyFeedingsByTier);

      await createFoalFromPregnancy({
        damId,
        options: {
          damSnapshot: snapshot,
          positiveTraitChance: positiveChance,
          negativeTraitChance: negativeChance,
          rng,
          skipDamReset: true,
          userId: snapshot.userId,
          name: snapshot.pendingFoalName ?? undefined,
          breedId: snapshot.pendingFoalBreedId ?? undefined,
        },
      });
      foalsBorn += 1;
    } catch (err) {
      logger.error(
        `[foalingService.runFoalingJob] Foal creation failed for dam ${damId}: ${err.message}`,
      );
      errors.push({ damId, error: err.message });

      // Compensation: restore the dam's pregnancy state so it gets retried
      // on the next run rather than silently consumed.
      try {
        await prisma.horse.update({
          where: { id: damId },
          data: {
            inFoalSinceDate: snapshot.inFoalSinceDate,
            pregnancySireId: snapshot.pregnancySireId,
            pregnancyFeedingsByTier: snapshot.pregnancyFeedingsByTier ?? {},
            pendingFoalName: snapshot.pendingFoalName ?? null,
            pendingFoalBreedId: snapshot.pendingFoalBreedId ?? null,
          },
        });
      } catch (rollbackErr) {
        logger.error(
          `[foalingService.runFoalingJob] Compensation rollback failed for dam ${damId}: ${rollbackErr.message}`,
        );
      }
    }
  }

  logger.info(
    `[foalingService.runFoalingJob] Completed: ${foalsBorn} foal(s) born, ${errors.length} error(s)`,
  );
  return { foalsBorn, errors };
}

export default { createFoalFromPregnancy, runFoalingJob };
