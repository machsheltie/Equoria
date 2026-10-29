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
 *   - epigenetic-trait roll at birth (lineage + feed quality + mare health)
 *   - conformation, gait, temperament generation (or inherited)
 *   - stats: the parents' average +/-10% per stat, plus the lineage stat bonus
 *     (Equoria-fq9ob; owner rulings q204, q247)
 *   - the actual `createHorse()` insert
 *   - clearing the dam's pregnancy, in the same transaction as the insert, and
 *     releasing a retired (21+) dam's staff there too (Equoria-6p398.14)
 *
 * @module modules/horses/services/foalingService
 */

import { createHorse } from './horseCreation.mjs';
import { birthDisciplineScores, resolveFoalBirthDiscipline } from './birthDiscipline.mjs';
import { getHorseById } from './horseRouteQueries.mjs';
import { gatherLineage } from './foalLineage.mjs';
import { resolveFoalBirthStats } from './foalBirthStats.mjs';
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
import { calculateBreedPhenotype } from './phenotypeCalculationService.mjs';
import { inheritColorGenotype } from './breedingColorInheritanceService.mjs';
import { generateMarkings, inheritMarkings } from './markingGenerationService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { calculatePregnancyEpigeneticChances } from '../../../utils/pregnancyBonus.mjs';
import {
  normalizeEpigeneticModifiers,
  normalizeTraitKey,
} from '../../../utils/epigeneticTraitKeyMap.mjs';
import {
  createNotificationTx,
  finalizeNotificationAfterCommit,
} from '../../../utils/notificationService.mjs';
import { UNNAMED_HORSE_NAME } from './horseNamePolicy.mjs';
import { releaseStaffIfRetiredTx } from './horseRetirementStaff.mjs';
import { foalBornPayload, linkBreedingRecordToFoalTx } from './foalBirthRecords.mjs';
import { horseHealthGrade, negativeTraitChanceMultiplier } from '../../../utils/horseHealth.mjs';
import { gameCalendarDate, gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';

// Gestation length; mirrors pregnancyBonus.mjs GESTATION_DAYS, kept local for the job's date math.
const GESTATION_DAYS = 7;

/**
 * Pool of bonus epigenetic traits the pregnancy formula can roll on top of
 * the regular at-birth pipeline. The first trait NOT already present is
 * added so duplicates are avoided.
 *
 * Equoria-9o3n7.4: repointed at APPROVED, effect-backed traits only (the
 * former wellNourished/vigorous/undernourished/weakImmunity/lowVigor pool had
 * no traitEffects entry and no definition, so its rolls did nothing).
 */
// Owner ruling 2026-10-27 (q117, Equoria-2d55z): only roster traits are ever
// generated, so athletic, calm, lowImmunity, nervous and reactive (no longer
// traits) left both pools. Order is unchanged for the names that remain.
const PREGNANCY_BONUS_POSITIVE_TRAITS = Object.freeze(['resilient', 'peopleTrusting']);
const PREGNANCY_BONUS_NEGATIVE_TRAITS = Object.freeze(['fragile']);

/**
 * Collect the union of a horse's carried epigenetic traits (positive ∪ negative
 * ∪ hidden ∪ dormant), normalized to canonical camelCase keys, for §A
 * inheritance input. A dormant trait (revealed, switched off; Equoria-nrto5) is
 * still carried and inheritable (owner ruling 2026-10-22 on Equoria-q4uem.17).
 * Tolerates null / primitive / array-shaped epigeneticModifiers (legacy rows).
 */
function collectEpigeneticTraits(modifiers) {
  const norm = normalizeEpigeneticModifiers(modifiers);
  const dormant = Array.isArray(modifiers?.dormant) ? modifiers.dormant.map(normalizeTraitKey) : [];
  return [...new Set([...norm.positive, ...norm.negative, ...norm.hidden, ...dormant])];
}

/** A horse's active, revealed traits (positive ∪ negative): the only ones a foal can be born with active. */
function collectActiveTraits(modifiers) {
  const norm = normalizeEpigeneticModifiers(modifiers);
  return [...new Set([...norm.positive, ...norm.negative])];
}

/** Error code thrown when the guarded pregnancy claim matches no row. */
export const PREGNANCY_NOT_CLAIMABLE = 'PREGNANCY_NOT_CLAIMABLE';

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
 * Materialise a foal from a mare's pregnancy state.
 *
 * Reads the dam's `inFoalSinceDate` / `pregnancySireId` /
 * `pregnancyFeedingsByTier`, generates the foal exactly as the legacy
 * `createFoal` controller did, then in ONE transaction clears the dam's
 * pregnancy (guarded), inserts the foal and its foalBorn notification.
 * Callers: the foaling job. (A POST /:id/foal-now route that skipped gestation
 * was deleted by Equoria-6nl3j; tests call this service directly.)
 *
 * @param {object} params
 * @param {number} params.damId - id of the in-foal mare
 * @param {object} [params.options] - { name?, sex?, ownerId?,
 *   userId?, playerId?, stableId?, healthStatus?, positiveTraitChance?,
 *   negativeTraitChance?, rng?, statRng?, damSnapshot?, sireSnapshot?, dueBy? }.
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

  // A foal is born with its mare's health and hunger (owner ruling 2026-10-23,
  // Equoria-w4ivy). A caller's snapshot may not carry the care clocks; read them.
  if (dam.lastVettedDate === undefined || dam.lastFedDate === undefined) {
    const careRow = await prisma.horse.findUnique({
      where: { id: damId },
      select: { lastVettedDate: true, lastFedDate: true, hungerSince: true },
    });
    dam = { ...dam, ...careRow };
  }

  const sire = options.sireSnapshot ?? (await getHorseById(sireId));
  if (!sire) {
    throw new Error(`createFoalFromPregnancy: pregnancy sire ${sireId} not found`);
  }

  const mareStats = {
    id: dam.id,
    name: dam.name,
    bondScore: dam.bondScore,
    healthStatus: dam.healthStatus || 'Good',
  };
  const lineage = await gatherLineage(sireId, damId, 3);
  const feedQuality = assessFeedQualityFromMare(mareStats);

  // §A inheritance: each parent's carried traits (positive ∪ negative ∪ hidden). Tests make
  // the rolls deterministic with `epigeneticSeed` or `traitRng` (a () => number in [0,1)).
  const damTraits = collectEpigeneticTraits(dam.epigeneticModifiers);
  const sireTraits = collectEpigeneticTraits(sire.epigeneticModifiers);
  // Owner ruling 2026-10-26 (q98, Equoria-2d55z): a foal's traits are born
  // hidden unless a parent had the trait active and revealed.
  const parentActiveTraits = [
    ...new Set([
      ...collectActiveTraits(dam.epigeneticModifiers),
      ...collectActiveTraits(sire.epigeneticModifiers),
    ]),
  ];
  // A Fair mare multiplies EVERY negative foal-trait roll by 1.25, a Bad mare by 1.5
  // (owner rulings 2026-10-23 Equoria-w4ivy and 2026-10-26 Equoria-pw7cm).
  const damHealthGrade = horseHealthGrade(dam);
  const negativeRollMultiplier = negativeTraitChanceMultiplier(damHealthGrade);
  const epigeneticTraits = applyEpigeneticTraitsAtBirth({
    mare: mareStats,
    lineage,
    feedQuality,
    negativeRollMultiplier,
    sireTraits,
    damTraits,
    parentActiveTraits,
    seed: options.epigeneticSeed,
    rng: typeof options.traitRng === 'function' ? options.traitRng : undefined,
  });
  // §D: the pipeline now also returns hidden[]; carry it through to persistence.
  const hiddenTraits = [...(epigeneticTraits.hidden || [])];

  // B5: per-feeding pregnancy bonus rolls. The foaling job passes
  // positiveTraitChance / negativeTraitChance (0..100 percent points)
  // computed by calculatePregnancyEpigeneticChances(); independent rolls.
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const positiveChance = Number(options.positiveTraitChance) || 0;
  // A Fair mare raises the CURRENT negative-trait chance by 25%, a Bad mare by
  // 50% (owner ruling 2026-10-23, Equoria-w4ivy); no other odds move.
  const negativeChance = Math.min(
    100,
    (Number(options.negativeTraitChance) || 0) * negativeRollMultiplier,
  );
  const positiveTraits = [...(epigeneticTraits.positive || [])];
  const negativeTraits = [...(epigeneticTraits.negative || [])];

  // A bonus trait is carried like any other: hidden unless a parent had it
  // active and revealed (q98).
  const carriedTraits = () => [...positiveTraits, ...negativeTraits, ...hiddenTraits];
  const bornAs = (trait, activeList) =>
    parentActiveTraits.includes(trait) ? activeList : hiddenTraits;
  if (positiveChance > 0 && rng() * 100 < positiveChance) {
    const bonus = pickFirstUnused(PREGNANCY_BONUS_POSITIVE_TRAITS, carriedTraits());
    if (bonus) {
      bornAs(bonus, positiveTraits).push(bonus);
      logger.info(
        `[foalingService] Bonus positive epigenetic trait '${bonus}' rolled (chance=${positiveChance}%)`,
      );
    }
  }
  if (negativeChance > 0 && rng() * 100 < negativeChance) {
    const bonus = pickFirstUnused(PREGNANCY_BONUS_NEGATIVE_TRAITS, carriedTraits());
    if (bonus) {
      bornAs(bonus, negativeTraits).push(bonus);
      logger.info(
        `[foalingService] Bonus negative epigenetic trait '${bonus}' rolled (chance=${negativeChance}%)`,
      );
    }
  }

  // The foal is its parents' breed; nobody chooses it (Equoria-5nwwf). A pre-ruling
  // pregnancy with a sire of another breed still foals, as the dam's (a throw strands her).
  const requestedBreedId = dam.breedId;
  if (!Number.isInteger(requestedBreedId) || requestedBreedId <= 0) {
    throw new Error(`createFoalFromPregnancy: invalid breedId ${requestedBreedId}`);
  }
  if (sire.breedId !== requestedBreedId) {
    logger.warn(`[foalingService] dam ${damId} and sire ${sireId} differ in breed`);
  }
  // Raw SQL: the Prisma DMMF may lack the JSONB column on some paths (mirrors horseRoutes.mjs).
  const breedRows = await prisma.$queryRaw`
    SELECT name, "breedGeneticProfile", "defaultTrait"
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
  // Gaits: parents' gaits and the breed's gait ranges only; conformation never
  // nudges them (owner ruling 2026-10-28, q210).
  const gaitScores =
    hasValidGaitScores(sireGaitScores) && hasValidGaitScores(damGaitScores)
      ? generateInheritedGaitScores(breedName, sireGaitScores, damGaitScores)
      : generateGaitScores(breedName);

  const temperament = generateTemperament(breedName);

  // Color genetics (31E-1a / 31E-2 / 31E-3): read a parent's colorGenotype + phenotype
  // when the snapshot lacks them; a null genotype falls back to random generation.
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
  const baseColor = calculateBreedPhenotype(colorGenotype, breedGeneticProfile);
  const markingArgs = [breedGeneticProfile, baseColor.colorName, rng, colorGenotype];
  const markings =
    sirePhenotype && damPhenotype
      ? inheritMarkings(sirePhenotype, damPhenotype, ...markingArgs)
      : generateMarkings(...markingArgs);
  const phenotype = { ...baseColor, ...markings };

  // Sex: direct callers may pass options.sex; the foaling job does not (50/50 via rng).
  const resolvedSex = options.sex ? options.sex : rng() < 0.5 ? 'Filly' : 'Colt';

  // Equoria-tl5l8: birth discipline at +5; drawn last so seeded colour/sex rolls are unchanged.
  const birthDiscipline = await resolveFoalBirthDiscipline({
    sireId,
    damId,
    foalBreed: breedRecord,
    rng,
  });

  // Equoria-fq9ob (q247): parents' average +/-10% per stat, plus the lineage bonus.
  // Drawn last so seeded colour/sex/discipline rolls are unchanged; statRng is a test seam.
  const statRng = typeof options.statRng === 'function' ? options.statRng : rng;
  const birthStats = await resolveFoalBirthStats({ sireId, damId, lineage, rng: statRng });

  const horseData = {
    // Equoria-4fnro (ruling 2026-09-14): unnamed at birth — see horseNamePolicy.
    name: options.name || dam.pendingFoalName || UNNAMED_HORSE_NAME,
    age: 0,
    breedId: requestedBreedId,
    sireId,
    damId,
    sex: resolvedSex,
    ownerId: options.ownerId,
    playerId: options.playerId,
    stableId: options.stableId,
    healthStatus: options.healthStatus || 'Excellent',
    lastVettedDate: dam.lastVettedDate ?? undefined,
    lastFedDate: dam.lastFedDate ?? undefined,
    hungerSince: dam.hungerSince ?? undefined,
    dateOfBirth: gameCalendarDate().toISOString(), // born today, Eastern
    conformationScores,
    gaitScores,
    temperament,
    disciplineScores: birthDisciplineScores(birthDiscipline),
    ...birthStats,
    colorGenotype,
    phenotype,
    epigeneticModifiers: {
      positive: positiveTraits,
      negative: negativeTraits,
      hidden: hiddenTraits, // §D: hidden traits persist for later discovery
    },
    _epigeneticTraitsApplied: true,
  };

  // Equoria-bvddn.20: the pregnancy claim, the foal insert and the foalBorn notification row
  // commit as ONE transaction. They used to be separate autocommit writes with a compensating
  // restore on failure, so a crash (or a rejected restore) between the claim and the insert lost
  // the pregnancy with no foal. Now a failure anywhere rolls the claim back with it. The claim is a
  // guarded conditional update (Equoria-wgw5k): it clears the pregnancy only if it is STILL set for
  // this sire, so of N overlapping callers (foaling-job runs or foal-now requests) exactly one
  // matches (count=1); the others match 0 and throw PREGNANCY_NOT_CLAIMABLE ("not in foal", which
  // foal-now maps to 400 and the job treats as already foaled). `options.dueBy` is the foaling
  // job's gestation cutoff. All fallible generation above ran before the transaction, so it stays
  // short. Lock order: the tx write-locks only this mare's row, then inserts the foal and the
  // notification (FK checks take KEY SHARE on the user/sire rows). It never write-locks a User row,
  // so it cannot invert User -> Horse.
  const { foal: newFoal, ownerId: notifUserId } = await prisma.$transaction(async tx => {
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
      },
    });
    if (claim.count === 0) {
      const lost = new Error(`createFoalFromPregnancy: mare ${damId} is not in foal`);
      lost.code = PREGNANCY_NOT_CLAIMABLE;
      throw lost;
    }
    // The foal is the mare's owner's at birth (q253, Equoria-x1t7q): read on the row the
    // claim just locked, so a sale before the birth is seen and one after it waits.
    const mareNow = await tx.horse.findUnique({ where: { id: damId }, select: { userId: true } });
    const ownerId = options.userId || mareNow?.userId || null;
    // A mare who turned 21 in foal kept her staff until now (owner ruling 2026-10-23).
    await releaseStaffIfRetiredTx(tx, damId);
    const foal = await createHorse({ ...horseData, userId: ownerId }, tx);
    await linkBreedingRecordToFoalTx(tx, { damId, sireId, foalId: foal.id });
    if (ownerId) {
      await createNotificationTx(tx, ownerId, 'foalBorn', foalBornPayload(foal, dam, sire));
    }
    return { foal, ownerId };
  });

  // Post-commit only: the real-time nudge and retention prune (never throws).
  if (notifUserId) {
    finalizeNotificationAfterCommit(notifUserId, 'foalBorn', foalBornPayload(newFoal, dam, sire));
  }

  logger.info(
    `[foalingService.createFoalFromPregnancy] Foaled ${newFoal.name} (id=${newFoal.id}) from dam ${damId}/sire ${sireId}`,
  );

  return {
    foal: newFoal,
    appliedTraits: { positive: positiveTraits, negative: negativeTraits },
    breedingAnalysis: {
      feedQuality,
      lineageCount: lineage.length,
      pregnancyBonus: { positiveChance, negativeChance },
      damHealthGrade,
      sire: { id: sire.id, name: sire.name },
      dam: { id: dam.id, name: dam.name },
    },
  };
}

/**
 * Foaling job — delivers every mare bred 7+ Eastern calendar days ago (owner
 * ruling 2026-10-12: bred on day D, foals on day D+7). Per-mare isolation: a
 * failure on one mare does not abort the run. Idempotent: the guarded claim in
 * `createFoalFromPregnancy` prevents duplicate foaling across overlapping runs.
 *
 * @param {object} [opts]
 * @param {Date}     [opts.now] - test seam; defaults to new Date().
 * @param {Function} [opts.rng] - test seam for the bonus rolls; defaults to
 *   Math.random. Each mare uses the same rng instance.
 * @param {Function} [opts.traitRng] - test seam for the birth trait rolls (options.traitRng).
 * @returns {Promise<{foalsBorn:number, errors:Array<{damId:number,error:string}>}>}
 */
export async function runFoalingJob({ now = new Date(), rng = Math.random, traitRng } = {}) {
  // Bred before 00:00 Eastern on (today - 6) means bred on day <= today - 7.
  const cutoff = startOfGameDayIndex(gameDayIndex(now) - GESTATION_DAYS + 1);
  logger.info(
    `[foalingService.runFoalingJob] Searching for mares due as of ${cutoff.toISOString()}`,
  );

  const candidates = await prisma.horse.findMany({
    where: {
      inFoalSinceDate: { lt: cutoff },
      pregnancySireId: { not: null },
    },
    select: {
      id: true,
      name: true,
      userId: true,
      breedId: true,
      bondScore: true,
      healthStatus: true,
      lastVettedDate: true,
      lastFedDate: true,
      hungerSince: true,
      conformationScores: true,
      gaitScores: true,
      colorGenotype: true,
      phenotype: true,
      epigeneticModifiers: true, // the dam passes on her traits (Equoria-3ab0k)
      inFoalSinceDate: true,
      pregnancySireId: true,
      pregnancyFeedingsByTier: true,
      pendingFoalName: true,
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
      const chances = calculatePregnancyEpigeneticChances(snapshot.pregnancyFeedingsByTier);
      const { positiveChance, negativeChance } = chances;

      await createFoalFromPregnancy({
        damId,
        options: {
          damSnapshot: snapshot,
          dueBy: cutoff,
          positiveTraitChance: positiveChance,
          negativeTraitChance: negativeChance,
          rng,
          traitRng,
          name: snapshot.pendingFoalName ?? undefined,
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
