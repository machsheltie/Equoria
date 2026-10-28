/**
 * birthDiscipline.mjs (Equoria-tl5l8)
 *
 * Owner ruling 2026-10-28: every horse is born with a discipline and starts
 * with +5 trained value in it, the same +5 one week of training gives. The
 * value lives where training writes it, Horse.disciplineScores[discipline], so
 * show scoring (disciplineTrainingPoints) and the Progression discipline scores
 * read it with no parallel field.
 *
 * Which discipline:
 *   - Store and starter horses: their breed's default discipline
 *     (breedDefaultDiscipline). A gaited breed's default is always Gaited
 *     (ruling 2026-10-19). A non-gaited breed's default is the discipline named
 *     in breeds.defaultTrait; a non-gaited breed can never default to Gaited,
 *     and a breed whose defaultTrait names no discipline (the seed placeholder
 *     'Trait') has no default yet, so the horse is born without one.
 *   - Bred foals: resolveFoalBirthDiscipline. Owner question q216 is open
 *     (breed default, or a parent's trained discipline); it implements the
 *     2026-10-19/10-21 rulings until she answers.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { DISCIPLINES } from '../../../constants/schema.mjs';
import { asFlagObject } from '../../../utils/jsonbArrayGuard.mjs';

/** The trained value a horse is born with in its birth discipline. */
export const birthDisciplineTrainedValue = 5;

const gaitedDiscipline = DISCIPLINES.GAITED;
const knownDisciplines = new Set(Object.values(DISCIPLINES));

/**
 * @param {unknown} breedGeneticProfile - breeds.breedGeneticProfile (JSONB).
 * @returns {boolean} Whether the breed is gaited (ratingProfiles.isGaitedBreed).
 */
export function isGaitedBreedProfile(breedGeneticProfile) {
  return breedGeneticProfile?.ratingProfiles?.isGaitedBreed === true;
}

/**
 * The discipline a breed's store and starter horses are born with.
 *
 * @param {{ breedGeneticProfile?: unknown, defaultTrait?: string|null }|null|undefined} breed
 * @returns {string|null} A discipline name, or null when the breed has none.
 */
export function breedDefaultDiscipline(breed) {
  if (!breed) {
    return null;
  }
  if (isGaitedBreedProfile(breed.breedGeneticProfile)) {
    return gaitedDiscipline;
  }
  const named = breed.defaultTrait;
  if (typeof named === 'string' && knownDisciplines.has(named) && named !== gaitedDiscipline) {
    return named;
  }
  return null;
}

/**
 * The disciplineScores a horse is born with.
 *
 * @param {string|null} discipline
 * @returns {Record<string, number>|undefined} `{ [discipline]: 5 }`, or
 *   undefined when there is no birth discipline (the column stays unset).
 */
export function birthDisciplineScores(discipline) {
  if (typeof discipline !== 'string' || !knownDisciplines.has(discipline)) {
    return undefined;
  }
  return { [discipline]: birthDisciplineTrainedValue };
}

/**
 * The disciplineScores a store or starter horse of `breed` is born with.
 *
 * @param {{ breedGeneticProfile?: unknown, defaultTrait?: string|null }|null|undefined} breed
 * @returns {Record<string, number>|undefined}
 */
export function breedBirthDisciplineScores(breed) {
  return birthDisciplineScores(breedDefaultDiscipline(breed));
}

/**
 * A parent's own discipline as far as its stored values tell: the highest
 * trained value in disciplineScores (a horse that never trained holds exactly
 * its birth discipline there), ties broken by name. Gaited is skipped when the
 * foal's breed is not gaited.
 *
 * @param {unknown} disciplineScores
 * @param {boolean} allowGaited
 * @returns {string|null}
 */
function parentDiscipline(disciplineScores, allowGaited) {
  let best = null;
  let bestValue = 0;
  for (const [discipline, value] of Object.entries(asFlagObject(disciplineScores))) {
    if (!knownDisciplines.has(discipline) || (!allowGaited && discipline === gaitedDiscipline)) {
      continue;
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      continue;
    }
    if (value > bestValue || (value === bestValue && best !== null && discipline < best)) {
      best = discipline;
      bestValue = value;
    }
  }
  return best;
}

/**
 * Pick a foal's birth discipline from its parents (rulings 2026-10-19/10-21).
 * Pure: every input is passed in.
 *
 *   1. Disciplines either parent trained in (at least one training session),
 *      weighted by sessions summed over both parents.
 *   2. If neither parent ever trained: the sire's or the dam's own discipline,
 *      50/50 (one parent's when only one has one).
 *   3. Else the foal breed's default.
 * A non-gaited foal breed never gets Gaited.
 *
 * @param {object} input
 * @param {Record<string, number>} input.sessionsByDiscipline - training sessions per discipline, both parents summed.
 * @param {unknown} input.sireDisciplineScores
 * @param {unknown} input.damDisciplineScores
 * @param {{ breedGeneticProfile?: unknown, defaultTrait?: string|null }} input.foalBreed
 * @param {() => number} [input.rng] - returns [0, 1).
 * @returns {string|null}
 */
export function pickFoalBirthDisciplineFromParents({
  sessionsByDiscipline,
  sireDisciplineScores,
  damDisciplineScores,
  foalBreed,
  rng = Math.random,
}) {
  const allowGaited = isGaitedBreedProfile(foalBreed?.breedGeneticProfile);

  const weighted = Object.entries(sessionsByDiscipline ?? {})
    .filter(
      ([discipline, sessions]) =>
        knownDisciplines.has(discipline) &&
        (allowGaited || discipline !== gaitedDiscipline) &&
        Number.isInteger(sessions) &&
        sessions > 0,
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const totalSessions = weighted.reduce((sum, [, sessions]) => sum + sessions, 0);
  if (totalSessions > 0) {
    let roll = rng() * totalSessions;
    for (const [discipline, sessions] of weighted) {
      roll -= sessions;
      if (roll < 0) {
        return discipline;
      }
    }
    return weighted[weighted.length - 1][0];
  }

  const sireOwn = parentDiscipline(sireDisciplineScores, allowGaited);
  const damOwn = parentDiscipline(damDisciplineScores, allowGaited);
  if (sireOwn && damOwn) {
    return rng() < 0.5 ? sireOwn : damOwn;
  }
  if (sireOwn || damOwn) {
    return sireOwn ?? damOwn;
  }

  return breedDefaultDiscipline(foalBreed);
}

/**
 * A bred foal's birth discipline. OPEN owner question q216: whether a foal
 * takes its breed's default or a parent's trained discipline. Until she
 * answers this follows the 2026-10-19 ruling (a parent's trained discipline);
 * if she rules for the breed default, this function's body becomes
 * `return breedDefaultDiscipline(foalBreed);`.
 *
 * @param {object} input
 * @param {number} input.sireId
 * @param {number} input.damId
 * @param {{ breedGeneticProfile?: unknown, defaultTrait?: string|null }} input.foalBreed
 * @param {() => number} [input.rng]
 * @param {object} [client] - Prisma client or transaction.
 * @returns {Promise<string|null>}
 */
export async function resolveFoalBirthDiscipline(
  { sireId, damId, foalBreed, rng },
  client = prisma,
) {
  const [sessionRows, parents] = await Promise.all([
    client.trainingLog.groupBy({
      by: ['discipline'],
      where: { horseId: { in: [sireId, damId] } },
      _count: { _all: true },
    }),
    client.horse.findMany({
      where: { id: { in: [sireId, damId] } },
      select: { id: true, disciplineScores: true },
    }),
  ]);
  const sessionsByDiscipline = Object.fromEntries(
    sessionRows.map(row => [row.discipline, row._count._all]),
  );
  const scoresOf = id => parents.find(parent => parent.id === id)?.disciplineScores ?? null;
  return pickFoalBirthDisciplineFromParents({
    sessionsByDiscipline,
    sireDisciplineScores: scoresOf(sireId),
    damDisciplineScores: scoresOf(damId),
    foalBreed,
    rng,
  });
}
