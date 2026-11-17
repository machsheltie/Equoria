/**
 * breedProfileLoader.mjs
 *
 * The single reader of per-breed conformation, gait, temperament and
 * color-genetics data. Equoria has exactly one breed data set: the seed files
 * (backend/data/breeds/*.txt) and the `breeds.breedGeneticProfile` JSONB rows
 * they load. This loader serves those rows from an in-memory cache
 * (breedProfileCache.mjs) filled by `preloadBreedProfiles(prisma)`.
 *
 *   - server.mjs awaits preloadBreedProfiles(prisma) before it binds the
 *     listener and refuses to start if it fails.
 *   - Scripts that run outside the server (backfills, load drivers) call it
 *     once at startup.
 *   - The backend test setup (backend/tests/setup.mjs) installs the same rows
 *     for every test file (Equoria-ctop1).
 *
 * There is no second copy. backend/data/breedProfiles.json, which used to back
 * this loader when the cache was empty, was deleted (Equoria-fbnw8, finishing
 * Equoria-f8qew AC4): a parallel breed source is how the "12 canonical breeds"
 * copy drifted, and the owner ruled that breed data must match everywhere.
 *
 * Contract:
 *   - `breedName` must match the DB row name exactly, case-sensitive.
 *   - A breed with no profile is a data bug and throws. No silent fallback to
 *     "generic defaults" — the previous architecture's "unknown breed ->
 *     random defaults" pattern was the root cause of the stats bug corrected
 *     in PR #94, and the same instinct produced the all-Bay starter horses
 *     fixed under Equoria-wvdya.
 *   - A cache nobody installed is a server fault, not a fault of the breed. It
 *     throws an error that carries a `cause`; a genuine absence carries none.
 *     Callers (createHorseService, breedingPairRules, breedPhysique, the
 *     foaling controller) branch on that to answer 500 versus 422/400.
 *
 * Equoria-wpfvl (2026-05-28).
 *
 * @module modules/horses/data/breedProfileLoader
 */

import logger from '../../../utils/logger.mjs';
import {
  clearBreedProfileCache,
  getBreedProfileCache,
  installBreedProfileRows,
} from './breedProfileCache.mjs';

// Equoria-f6xgn (2026-05-28): the LEGACY_ID_TO_NAME shim was removed. It
// only resolved the 12 breed IDs of a hand-authored table (itself deleted
// 2026-10-21: there were never canonical breeds) and would silently fail for the other
// ~300 breeds added by Equoria-26qjf.3, which is exactly the kind of
// quiet-degradation pattern the constitution forbids. Callers that have a
// numeric breedId resolve it to a name via Prisma before reaching here.

// ── DB cache ──────────────────────────────────────────────────────────────────
// Map<breedName, profile> kept by breedProfileCache.mjs (on globalThis, so every
// instance of this module in a process or test file shares it). null until
// preloadBreedProfiles() has run (server.mjs boot before the await) or after
// _clearBreedProfileCache(). backend/tests/setup.mjs installs it for each test
// file from the rows the test environment read once (Equoria-ctop1).

/**
 * Populate the in-memory cache from `breeds.breedGeneticProfile`.
 *
 * MUST be awaited by the application during startup (server.mjs) BEFORE
 * Express binds the listener — every controller / service hot path that
 * calls getBreedProfile reads from this cache. Calling it again replaces
 * the cache with a fresh DB read (e.g. after re-running `seed:breeds` in
 * a long-lived dev process).
 *
 * Rows whose `breedGeneticProfile` is null, a primitive, an array, or
 * missing `ratingProfiles` are skipped (installBreedProfileRows) — the
 * loader's contract is that every returned profile has the full
 * conformation/gait/temperament shape, so a malformed DB row is treated as
 * absent rather than served.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<number>} count of breeds loaded into the cache
 * @throws {Error} when `prisma` is missing or lacks `breed.findMany`
 */
export async function preloadBreedProfiles(prisma) {
  if (!prisma || typeof prisma.breed?.findMany !== 'function') {
    throw new Error('preloadBreedProfiles requires a Prisma client');
  }
  const rows = await prisma.breed.findMany({
    select: { name: true, breedGeneticProfile: true },
  });
  const size = installBreedProfileRows(rows);
  logger.info(`[breedProfileLoader] DB cache preloaded: ${size} breed profiles`);
  return size;
}

/**
 * Test helper: clear the DB cache.
 * Underscore prefix marks it as a test-only export not part of the
 * production API. Exists so tests can exercise the cache-not-installed path. The
 * cache lives on the test file's own global, so clearing it never reaches
 * another test file.
 */
export function _clearBreedProfileCache() {
  clearBreedProfileCache();
}

/**
 * Fetch a breed's full profile by display name (or legacy numeric ID).
 *
 * Throws when the breed has no profile in the cache (no `cause`), when no
 * cache is installed (with a `cause`), or when given a malformed identifier.
 *
 * @param {string} breedName
 * @returns {object} the full profile: conformation, gaits, temperament and
 *   color genetics
 * @throws {Error}
 */
export function getBreedProfile(breedName) {
  // Equoria-f6xgn (2026-05-28): the LEGACY_ID_TO_NAME shim was removed.
  // Numeric breedId is no longer accepted — callers must resolve to a name
  // (e.g. via prisma.breed.findUnique({where:{id},select:{name:true}})).
  if (typeof breedName === 'number') {
    throw new Error(
      `getBreedProfile no longer accepts a numeric breedId (got ${breedName}). ` +
        'Resolve to a breed name first via ' +
        '`prisma.breed.findUnique({ where: { id }, select: { name: true } })`. ' +
        'See Equoria-f6xgn for the rationale.',
    );
  }
  if (!breedName || typeof breedName !== 'string') {
    throw new Error(
      `getBreedProfile requires a non-empty breed display name string (got: ${JSON.stringify(breedName)}).`,
    );
  }

  const dbCache = getBreedProfileCache();
  if (!dbCache) {
    // Nothing installed a cache: preloadBreedProfiles(prisma) never ran or
    // failed. Every breed would fail, so this is a server fault, not a missing
    // breed; the `cause` lets callers tell the two apart.
    throw new Error(
      `Breed profiles are not loaded, so "${breedName}" cannot be resolved. ` +
        'Call preloadBreedProfiles(prisma) at startup.',
      { cause: new Error('breed profile cache has not been installed') },
    );
  }
  const profile = dbCache.get(breedName);
  if (!profile) {
    throw new Error(
      `No profile for breed "${breedName}" in the DB cache (${dbCache.size} breeds loaded). ` +
        'Run `npm run seed:breeds` from backend/ to re-import, ' +
        'or confirm the breed name spelling.',
    );
  }
  return profile;
}

/**
 * Number of breeds available via the loader: the DB cache count, 0 when no
 * cache is installed.
 *
 * @returns {number}
 */
export function countLoadedBreedProfiles() {
  return getBreedProfileCache()?.size ?? 0;
}
