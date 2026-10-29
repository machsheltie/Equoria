/**
 * createTestHorse.mjs (Equoria-dm1i)
 *
 * Canonical real-DB test-fixture helper for inserting a horse row.
 *
 * WHY THIS EXISTS — the structural defect class behind Equoria-lfj5 / g9sa:
 *   ~209 backend *.test.mjs files create fixture horses via raw
 *   `prisma.horse.create()`. The `createHorse()` model fn (Equoria-ennm)
 *   auto-generates colorGenotype + phenotype; a raw create does NOT, so the
 *   row is born with NULL phenotype. While each suite's scoped/cascade
 *   cleanup currently works (so the canonical `horseColorNullSentinel`
 *   stays green), ANY suite whose afterAll cleanup ever fails (silent
 *   `.catch(() => {})`, missing cascade, timeout) leaks a NULL-phenotype
 *   row and trips the sentinel — exactly the Equoria-lfj5 16-NULL
 *   regression.
 *
 *   This helper closes the class at the point of creation:
 *     1. It spreads the SAME CI-proven `fixtureColor()` generator the
 *        g9sa fix uses, so every fixture horse satisfies the
 *        phenotype-not-null invariant even transiently.
 *     2. It records the created id in a caller-supplied collector so
 *        cleanup is scoped to *exactly* the rows this suite made — never
 *        a broad `deleteMany()` (CLAUDE.md §2 forbids that against the
 *        canonical DB).
 *
 * It deliberately does NOT route through the full `createHorse()` pipeline
 * (breedId requirement, genotype/trait generation, conformation + gait
 * validation) — that changes test semantics. It reuses only the color
 * generator, mirroring `fixtureColor()`'s rationale.
 *
 * Equoria-576c0.5: it also gives every fixture a breed (the default breed when
 * the caller names none) plus a temperament and gait scores rolled from that
 * breed, so no fixture horse is born with a NULL temperament or gaitScores.
 * `testHorseData()` returns the same completed data for a raw create.
 *
 * Convention (.claude/rules/CONTRIBUTING.md, test section): NEW backend
 * tests MUST use this helper (or spread `...fixtureColor()` into a raw
 * create) instead of a bare `prisma.horse.create()` with no color fields.
 *
 * Usage:
 *   import prisma from '../../../packages/database/prismaClient.mjs';
 *   import { createTestHorse, cleanupTestHorses } from '../helpers/createTestHorse.mjs';
 *
 *   const created = [];
 *   const horse = await createTestHorse(prisma, {
 *     name: `TestFixture-foo-${randHex()}`,
 *     sex: 'Mare',
 *     dateOfBirth: new Date(),
 *     userId: user.id,
 *   }, created);
 *   // ... assertions ...
 *   afterAll(() => cleanupTestHorses(prisma, created));
 */

import { fixtureColor } from '../../tests/helpers/fixtureColor.mjs';
import { generateGaitScores } from '../../modules/horses/services/gaitService.mjs';
import { getBreedProfile } from '../../modules/horses/data/breedProfileLoader.mjs';
import { seededRng } from './seededRng.mjs';
import { birthDateForAge } from '../../utils/horseAge.mjs';

/** The default breed (Thoroughbred, as temperamentService's default) for a fixture that names none. */
const defaultFixtureBreed = 'Thoroughbred';

/** Fixed seed: a fixture's gait scores are the same on every run. */
const fixtureGaitSeed = 5760;

/**
 * The breed's most likely temperament (its highest temperamentWeights entry).
 * Fixtures use it instead of a weighted roll so a test never flakes on the
 * roll; a test that needs a particular temperament passes one.
 */
function fixtureTemperament(breedName) {
  const weights = getBreedProfile(breedName).temperamentWeights;
  if (!weights || typeof weights !== 'object' || Object.keys(weights).length === 0) {
    throw new Error(`breed profile for "${breedName}" has no temperamentWeights`);
  }
  return Object.entries(weights).reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

/**
 * Equoria-576c0.5 (owner ruling 2026-10-19, O5 option A): every horse has a
 * temperament and gait scores, from its breed. Returns `data` with whichever
 * of the two the caller left out filled from the fixture's breed (scalar
 * `breedId` or `breed: { connect: { id } }`): the breed's most likely
 * temperament and gait scores drawn from its profile with a fixed seed, so the
 * values are breed-true and identical on every run. A caller-supplied value is kept, and so is an explicit
 * `null` (a test planting a pre-ruling legacy row, e.g. for the backfill script).
 * A breedless fixture, or a test-made breed with no profile, rolls from the
 * default breed's profile (Thoroughbred), so no fixture horse is born NULL.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} data Prisma `horse.create` data
 * @returns {Promise<object>}
 */
export async function withBreedTemperamentAndGaits(prisma, data) {
  const needsTemperament = data.temperament === undefined;
  const needsGaits = data.gaitScores === undefined;
  if (!needsTemperament && !needsGaits) {
    return data;
  }
  const breedId = data.breedId ?? data.breed?.connect?.id;
  const breed =
    breedId === undefined || breedId === null
      ? null
      : await prisma.breed.findUnique({ where: { id: breedId }, select: { name: true } });
  const roll = breedName => ({
    ...(needsTemperament ? { temperament: fixtureTemperament(breedName) } : {}),
    ...(needsGaits
      ? { gaitScores: generateGaitScores(breedName, { random: seededRng(fixtureGaitSeed) }) }
      : {}),
  });
  let rolled;
  try {
    rolled = roll(breed?.name ?? defaultFixtureBreed);
  } catch (err) {
    // A profile source that failed to load is an infrastructure fault: rethrow it.
    if (err?.cause || !breed) {
      throw err;
    }
    // A test-made breed with no profile: roll from the default breed's profile.
    rolled = roll(defaultFixtureBreed);
  }
  return { ...data, ...rolled };
}

let defaultBreedIdPromise = null;

/**
 * Id of the default fixture breed (Thoroughbred, the canonical default breed),
 * looked up once per test file. The breed is seeded reference data; a missing
 * row is an environment fault, so this throws rather than inventing a breed.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<number>}
 */
export function defaultTestBreedId(prisma) {
  if (!defaultBreedIdPromise) {
    defaultBreedIdPromise = prisma.breed
      .findFirst({ where: { name: defaultFixtureBreed }, select: { id: true } })
      .then(row => {
        if (!row) {
          defaultBreedIdPromise = null;
          throw new Error(
            `defaultTestBreedId: no "${defaultFixtureBreed}" breed row; seed the reference breeds`,
          );
        }
        return row.id;
      });
  }
  return defaultBreedIdPromise;
}

const relationWriteKeys = ['connect', 'create', 'connectOrCreate'];

/** True when `data` uses Prisma's relation (checked) input style, e.g. `user: { connect }`. */
function usesRelationInput(data) {
  return Object.values(data).some(
    v =>
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      !(v instanceof Date) &&
      relationWriteKeys.some(k => Object.prototype.hasOwnProperty.call(v, k)),
  );
}

/**
 * Complete `horse.create` data for a fixture horse (Equoria-576c0.5): a valid
 * colorGenotype + phenotype unless the caller supplied either, the default
 * breed when the caller named none (neither `breedId` nor `breed` set; pass
 * `breedId: null` to plant a breedless horse), a dateOfBirth matching `age`
 * (default 5) in Eastern game years when none is given, and temperament +
 * gaitScores rolled from the breed unless supplied. Use it for a raw create that needs
 * `include`/`select` or a transaction client:
 *
 *   await prisma.horse.create({ data: await testHorseData(prisma, { name, ... }) });
 *
 * @param {import('@prisma/client').PrismaClient} prisma Prisma client or tx.
 * @param {object} data Prisma `horse.create` data.
 * @param {object|null} [breedGeneticProfile] forwarded to `fixtureColor()`.
 * @returns {Promise<object>}
 */
export async function testHorseData(prisma, data, breedGeneticProfile = null) {
  if (!data || typeof data !== 'object') {
    throw new TypeError('testHorseData: second arg must be a horse data object');
  }
  const callerSuppliedColor =
    Object.prototype.hasOwnProperty.call(data, 'colorGenotype') ||
    Object.prototype.hasOwnProperty.call(data, 'phenotype');
  const withColor = callerSuppliedColor
    ? { ...data }
    : { ...fixtureColor(breedGeneticProfile), ...data };

  // Equoria-0jztg: a fixture's birth date matches the age it intends (game years,
  // Eastern calendar), so live-age gates such as retirement read that age.
  if (withColor.dateOfBirth === undefined) {
    withColor.dateOfBirth = birthDateForAge(typeof data.age === 'number' ? data.age : 5);
  }

  // An undefined value names nothing (Prisma ignores it); an explicit null plants a breedless horse.
  const namesBreed = data.breedId !== undefined || data.breed !== undefined;
  if (!namesBreed) {
    const id = await defaultTestBreedId(prisma);
    if (usesRelationInput(data)) {
      withColor.breed = { connect: { id } };
    } else {
      withColor.breedId = id;
    }
  }
  return withBreedTemperamentAndGaits(prisma, withColor);
}

/**
 * Insert a horse row with a valid colorGenotype + phenotype auto-generated.
 *
 * Caller-supplied `data` is passed straight through to
 * `prisma.horse.create()`. The color fields are injected ONLY when the
 * caller did not already supply them, so a suite that intentionally tests
 * a specific genotype/phenotype keeps full control.
 *
 * @param {import('@prisma/client').PrismaClient} prisma Active Prisma client.
 * @param {object} data Prisma `horse.create` data. `name`, `sex`,
 *   `dateOfBirth` are required by the schema; everything else is optional.
 * @param {number[]} [collector] Optional array; the created horse id is
 *   pushed onto it for later scoped cleanup via `cleanupTestHorses`.
 * @param {object|null} [breedGeneticProfile] Optional breed genetic
 *   profile forwarded to `fixtureColor()` (defaults to the generic/null
 *   profile — same as the backfill script).
 * @returns {Promise<object>} The created horse row (includes `id`).
 */
export async function createTestHorse(prisma, data, collector, breedGeneticProfile = null) {
  if (!prisma || typeof prisma.horse?.create !== 'function') {
    throw new TypeError('createTestHorse: first arg must be a Prisma client');
  }
  if (!data || typeof data !== 'object') {
    throw new TypeError('createTestHorse: second arg must be a horse data object');
  }

  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, data, breedGeneticProfile),
  });

  if (Array.isArray(collector)) {
    collector.push(horse.id);
  }

  return horse;
}

/**
 * Scoped cleanup for ids collected by `createTestHorse`.
 *
 * Deletes ONLY the ids this suite created (`where: { id: { in: ids } }`) —
 * never a broad `deleteMany()`. Safe to call in afterAll even if some ids
 * were already cascade-deleted (the delete is a no-op for missing rows).
 *
 * @param {import('@prisma/client').PrismaClient} prisma Active Prisma client.
 * @param {number[]} collector The array populated by `createTestHorse`.
 * @returns {Promise<number>} Count of rows deleted.
 */
export async function cleanupTestHorses(prisma, collector) {
  if (!Array.isArray(collector) || collector.length === 0) {
    return 0;
  }
  const { count } = await prisma.horse.deleteMany({
    where: { id: { in: collector } },
  });
  // Empty the collector so a second afterAll call is idempotent.
  collector.length = 0;
  return count;
}

export default createTestHorse;
