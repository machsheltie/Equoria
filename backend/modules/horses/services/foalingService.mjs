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
 *   - clearing the dam's pregnancy, in the same transaction as the insert
 *
 * Note: B4 (per-feeding tier counters) and B5 (`runFoalingJob`) both landed here.
 *
 * @module modules/horses/services/foalingService
 */

import { createHorse, getHorseById } from './horseModelService.mjs';
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
import { generateGenotype } from './genotypeGenerationService.mjs';
import { calculatePhenotype } from './phenotypeCalculationService.mjs';
import { inheritColorGenotype } from './breedingColorInheritanceService.mjs';
import { generateMarkings, inheritMarkings } from './markingGenerationService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { calculatePregnancyEpigeneticChances } from '../../../utils/pregnancyBonus.mjs';
import { normalizeEpigeneticModifiers } from '../../../utils/epigeneticTraitKeyMap.mjs';
import {
  createNotificationTx,
  finalizeNotificationAfterCommit,
} from '../../../utils/notificationService.mjs';
import { UNNAMED_HORSE_NAME } from './horseNamePolicy.mjs';

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
 *
 * Equoria-9o3n7.4: repointed at APPROVED, effect-backed traits only. The
 * former pool had wellNourished/vigorous (positive) and undernourished/
 * weakImmunity/lowVigor (negative) — none had a traitEffects entry OR a
 * TRAIT_DEFINITIONS entry, so a premium-feed roll produced a trait that did
 * NOTHING in competition/training. Every trait below resolves in
 * traitEffects.mjs (so the bonus is mechanically real) and is a canonical
 * roster member per the 9o3n7 spec §B. The feed-tier mechanic is unchanged —
 * premium feed still raises positive_chance and biases toward these traits.
 */
// §B4 (9o3n7.4): repointed at approved, effect-backed canonical traits. The
// previous pool (wellNourished/vigorous/undernourished/weakImmunity/lowVigor)
// had NO traitEffects entry and NO definition — those rolls produced dead
// traits with zero gameplay effect. Premium feed during pregnancy now biases
// toward genuinely beneficial constitution traits; poor feed toward genuinely
// detrimental ones, all of which have real effects in traitEffects.mjs.
const PREGNANCY_BONUS_POSITIVE_TRAITS = Object.freeze([
  'resilient',
  'athletic',
  'calm',
  'peopleTrusting',
]);
const PREGNANCY_BONUS_NEGATIVE_TRAITS = Object.freeze([
  'fragile',
  'lowImmunity',
  'nervous',
  'reactive',
]);

/**
 * Collect the union of a horse's epigenetic traits (positive ∪ negative ∪
 * hidden), normalized to canonical camelCase keys, for §A inheritance input.
 * Tolerates null / primitive / array-shaped epigeneticModifiers (legacy rows).
 */
function collectEpigeneticTraits(modifiers) {
  const norm = normalizeEpigeneticModifiers(modifiers);
  return [...new Set([...norm.positive, ...norm.negative, ...norm.hidden])];
}

/** Error code thrown when the guarded pregnancy claim matches no row. */
export const PREGNANCY_NOT_CLAIMABLE = 'PREGNANCY_NOT_CLAIMABLE';

function foalBornPayload(foal, dam, sire) {
  return { foalName: foal.name, foalId: foal.id, damName: dam.name, sireName: sire.name };
}

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
    const bondScore = mare.bondScore;
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
 * `createFoal` controller did, then in ONE transaction clears the dam's
 * pregnancy (guarded), inserts the foal and its foal_born notification.
 * Callers: the foaling job and POST /:id/foal-now.
 *
 * @param {object} params
 * @param {number} params.damId - id of the in-foal mare
 * @param {object} [params.options] - { name?, breedId?, sex?, ownerId?,
 *   userId?, playerId?, stableId?, healthStatus?, positiveTraitChance?,
 *   negativeTraitChance?, rng?, damSnapshot?, sireSnapshot?, dueBy? }.
 *   The bonus chance fields are produced by
 *   `calculatePregnancyEpigeneticChances()` and applied as independent rolls
 *   on top of `applyEpigeneticTraitsAtBirth`. `rng` is a () => number
 *   returning [0,1); defaults to Math.random. `damSnapshot` (and optional
 *   `sireSnapshot`) lets the foaling job skip re-reading the dam; `dueBy`
 *   limits the claim to a pregnancy that began on or before that Date.
 * @returns {Promise<object>} the created foal Horse row + applied traits
 * @throws {Error} with `code === PREGNANCY_NOT_CLAIMABLE` when the mare is no
 *   longer in foal at claim time (another caller foaled her first).
 */
export async function createFoalFromPregnancy({ damId, options = {} } = {}) {
  if (!damId) {
    throw new Error('createFoalFromPregnancy: damId is required');
  }

  // The foaling job passes the row it selected as options.damSnapshot, which
  // skips the re-read. Either way the pregnancy is claimed only inside the
  // transaction below, so a stale snapshot cannot foal twice.
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
    stressLevel: dam.stressLevel,
    bondScore: dam.bondScore,
    healthStatus: dam.healthStatus || 'Good',
  };
  const lineage = await gatherLineage(sireId, damId, 3);
  const feedQuality = assessFeedQualityFromMare(mareStats);
  const { stressLevel } = mareStats;

  // §A inheritance: pass the union of each parent's epigenetic traits
  // (positive ∪ negative ∪ hidden) so the staged pipeline can inherit them.
  // Optional `epigeneticSeed` makes the Stage-0 + §D visibility rolls
  // deterministic (used by tests).
  const damTraits = collectEpigeneticTraits(dam.epigeneticModifiers);
  const sireTraits = collectEpigeneticTraits(sire.epigeneticModifiers);
  const epigeneticTraits = applyEpigeneticTraitsAtBirth({
    mare: mareStats,
    lineage,
    feedQuality,
    stressLevel,
    sireTraits,
    damTraits,
    seed: options.epigeneticSeed,
  });
  // §D: the pipeline now also returns hidden[]; carry it through to persistence.
  const hiddenTraits = [...(epigeneticTraits.hidden || [])];

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

  // Resolve breed: caller option > pendingFoalBreedId on dam > dam's own breed.
  const requestedBreedId =
    options.breedId !== undefined
      ? Number.parseInt(options.breedId, 10)
      : (dam.pendingFoalBreedId ?? dam.breedId);
  if (!Number.isInteger(requestedBreedId) || requestedBreedId <= 0) {
    throw new Error(`createFoalFromPregnancy: invalid breedId ${requestedBreedId}`);
  }
  // Raw SQL is used for breedGeneticProfile because the Prisma DMMF may not
  // include the JSONB column on every code path; mirrors horseRoutes.mjs.
  const breedRows = await prisma.$queryRaw`
    SELECT name, "breedGeneticProfile"
    FROM breeds
    WHERE id = ${requestedBreedId}
  `;
  const breedRecord = breedRows[0];
  if (!breedRecord?.name) {
    throw new Error(`createFoalFromPregnancy: breed ${requestedBreedId} not found`);
  }
  const breedName = breedRecord.name;
  const breedGeneticProfile = breedRecord.breedGeneticProfile ?? null;

  const sireConformation = sire.conformationScores;
  const damConformation = dam.conformationScores;
  // Equoria-84pu (31F-3 deferred integration): consume the conformation-show
  // breeding-value boost (Horse.breedingValueBoost, 0.0-0.15 per FR-41). Average
  // the sire's and dam's boosts so the combined value stays inside the FR-41
  // 0-0.15 envelope (see generateInheritedConformationScores docs for rationale).
  // Missing/non-finite parent boosts contribute 0. Only the inherited path
  // receives the boost: the breed-only fallback has no parent achievement to
  // reward, so applying a boost there would be unfounded.
  const sireBoost = Number.isFinite(sire.breedingValueBoost) ? sire.breedingValueBoost : 0;
  const damBoost = Number.isFinite(dam.breedingValueBoost) ? dam.breedingValueBoost : 0;
  const combinedBreedingValueBoost = (sireBoost + damBoost) / 2;
  const conformationScores =
    hasValidConformationScores(sireConformation) && hasValidConformationScores(damConformation)
      ? generateInheritedConformationScores(
          breedName,
          sireConformation,
          damConformation,
          combinedBreedingValueBoost,
        )
      : generateConformationScores(breedName);

  const sireGaitScores = sire.gaitScores;
  const damGaitScores = dam.gaitScores;
  const gaitScores =
    hasValidGaitScores(sireGaitScores) && hasValidGaitScores(damGaitScores)
      ? generateInheritedGaitScores(breedName, sireGaitScores, damGaitScores, conformationScores)
      : generateGaitScores(breedName, conformationScores);

  const temperament = generateTemperament(breedName);

  // Color genetics (31E-1a / 31E-2 / 31E-3) — wire color inheritance into
  // pregnancy-based foaling. The runFoalingJob snapshot select only fetches a
  // subset of columns, so we resolve colorGenotype + phenotype directly from
  // the dam/sire records when missing. The service layer falls back gracefully
  // (logs + random generation) when either parent's genotype is null.
  let damColorGenotype = dam.colorGenotype ?? null;
  let damPhenotype = dam.phenotype ?? null;
  if (damColorGenotype === null || damPhenotype === null) {
    const damColorRow = await prisma.horse.findUnique({
      where: { id: damId },
      select: { colorGenotype: true, phenotype: true },
    });
    damColorGenotype = damColorGenotype ?? damColorRow?.colorGenotype ?? null;
    damPhenotype = damPhenotype ?? damColorRow?.phenotype ?? null;
  }
  let sireColorGenotype = sire.colorGenotype ?? null;
  let sirePhenotype = sire.phenotype ?? null;
  if (sireColorGenotype === null || sirePhenotype === null) {
    const sireColorRow = await prisma.horse.findUnique({
      where: { id: sireId },
      select: { colorGenotype: true, phenotype: true },
    });
    sireColorGenotype = sireColorGenotype ?? sireColorRow?.colorGenotype ?? null;
    sirePhenotype = sirePhenotype ?? sireColorRow?.phenotype ?? null;
  }

  // When both parents have a genotype → Mendelian inheritance (31E-2).
  // Otherwise → breed-weighted random generation (31E-1a fallback).
  const colorGenotype =
    sireColorGenotype && damColorGenotype
      ? inheritColorGenotype(sireColorGenotype, damColorGenotype, breedGeneticProfile, rng)
      : generateGenotype(breedGeneticProfile, rng);

  // Phenotype: base color + markings (31E-1b / 31E-3).
  const baseColor = calculatePhenotype(colorGenotype, breedGeneticProfile?.shade_bias ?? null);
  const markings =
    sirePhenotype && damPhenotype
      ? inheritMarkings(sirePhenotype, damPhenotype, breedGeneticProfile, baseColor.colorName, rng)
      : generateMarkings(breedGeneticProfile, baseColor.colorName, rng);
  const phenotype = { ...baseColor, ...markings };

  // Sex: callers (e.g. the breed controller for direct calls) may supply
  // options.sex; the foaling job does not, so randomize 50/50 using rng.
  const resolvedSex = options.sex ? options.sex : rng() < 0.5 ? 'Filly' : 'Colt';

  const horseData = {
    // Equoria-4fnro (ruling 2026-09-14): unnamed at birth — see horseNamePolicy.
    name: options.name || dam.pendingFoalName || UNNAMED_HORSE_NAME,
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
    colorGenotype,
    phenotype,
    epigeneticModifiers: {
      positive: positiveTraits,
      negative: negativeTraits,
      hidden: hiddenTraits, // §D: hidden traits persist for later discovery
    },
    _epigeneticTraitsApplied: true,
  };

  // Equoria-bvddn.20: the pregnancy claim, the foal insert and the foal_born
  // notification row commit as ONE transaction. They used to be separate
  // autocommit writes with a compensating restore on failure, so a crash (or a
  // rejected restore) between the claim and the insert lost the pregnancy with
  // no foal. Now a failure anywhere rolls the claim back with it.
  //
  // The claim is a guarded conditional update (Equoria-wgw5k): it clears the
  // pregnancy only if it is STILL set for this sire, so of N overlapping
  // callers (foaling-job runs or foal-now requests) exactly one matches
  // (count=1); the others match 0 and throw PREGNANCY_NOT_CLAIMABLE ("not in
  // foal", which foal-now maps to 400 and the job treats as already foaled).
  // `options.dueBy` is the foaling job's gestation cutoff. All fallible
  // generation above ran before the transaction, so it stays short.
  //
  // Lock order: the tx write-locks only this mare's row, then inserts the foal
  // and the notification (FK checks take KEY SHARE on the user/sire rows). It
  // never write-locks a User row, so it cannot invert User -> Horse.
  const notifUserId = options.userId || dam.userId;
  const newFoal = await prisma.$transaction(async tx => {
    const claim = await tx.horse.updateMany({
      where: {
        id: damId,
        inFoalSinceDate: options.dueBy ? { lte: options.dueBy } : { not: null },
        pregnancySireId: sireId,
      },
      data: {
        inFoalSinceDate: null,
        pregnancySireId: null,
        pregnancyFeedingsByTier: {},
        pendingFoalName: null,
        pendingFoalBreedId: null,
      },
    });
    if (claim.count === 0) {
      const lost = new Error(`createFoalFromPregnancy: mare ${damId} is not in foal`);
      lost.code = PREGNANCY_NOT_CLAIMABLE;
      throw lost;
    }
    const foal = await createHorse(horseData, tx);
    if (notifUserId) {
      await createNotificationTx(tx, notifUserId, 'foal_born', foalBornPayload(foal, dam, sire));
    }
    return foal;
  });

  // Post-commit only: the real-time nudge and retention prune (never throws).
  if (notifUserId) {
    finalizeNotificationAfterCommit(notifUserId, 'foal_born', foalBornPayload(newFoal, dam, sire));
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
 * abort the run. Idempotent: the guarded in-transaction claim in
 * `createFoalFromPregnancy` guards against duplicate foaling when two job
 * runners overlap or a single run is invoked twice.
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
      colorGenotype: true,
      phenotype: true,
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

    // Equoria-bvddn.20: createFoalFromPregnancy claims the pregnancy (guarded
    // on it still being due) and inserts the foal in one transaction. A
    // failure rolls the claim back, so the mare stays pregnant and is retried
    // next run; a parallel runner that foaled her first makes the claim match
    // nothing, which is a skip, not an error.
    try {
      const { positive_chance: positiveChance, negative_chance: negativeChance } =
        calculatePregnancyEpigeneticChances(snapshot.pregnancyFeedingsByTier);

      await createFoalFromPregnancy({
        damId,
        options: {
          damSnapshot: snapshot,
          dueBy: cutoff,
          positiveTraitChance: positiveChance,
          negativeTraitChance: negativeChance,
          rng,
          userId: snapshot.userId,
          name: snapshot.pendingFoalName ?? undefined,
          breedId: snapshot.pendingFoalBreedId ?? undefined,
        },
      });
      foalsBorn += 1;
    } catch (err) {
      if (err.code === PREGNANCY_NOT_CLAIMABLE) {
        logger.info(`[foalingService.runFoalingJob] Dam ${damId} already foaled; skipping`);
        continue;
      }
      logger.error(
        `[foalingService.runFoalingJob] Foal creation failed for dam ${damId}: ${err.message}`,
      );
      errors.push({ damId, error: err.message });
    }
  }

  logger.info(
    `[foalingService.runFoalingJob] Completed: ${foalsBorn} foal(s) born, ${errors.length} error(s)`,
  );
  return { foalsBorn, errors };
}

export default { createFoalFromPregnancy, runFoalingJob };
