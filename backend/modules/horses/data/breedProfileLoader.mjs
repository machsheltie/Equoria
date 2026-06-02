/**
 * breedProfileLoader.mjs
 *
 * Source-of-truth precedence for per-breed conformation, gait, temperament,
 * and (post-Equoria-26qjf.3) color genetics:
 *
 *   1. DB cache populated by `preloadBreedProfiles(prisma)` — full 312-breed
 *      roster from `breeds.breedGeneticProfile` JSONB. The DB profile is the
 *      superset: full conformation (all 8 regions incl. topline), gaits,
 *      temperament, AND color genetics (shade_bias, allele_weights, etc.).
 *   2. backend/data/breedProfiles.json — fallback for the conformation /
 *      gait / temperament subset (no color genetics). Serves the backend
 *      test suite, which intentionally does NOT preload the DB cache (see
 *      backend/tests/setup.mjs), and keeps the loader robust against the DB
 *      cache being empty during early-boot / cold-cache paths.
 *
 * The DB became the authoritative source on 2026-05-28 when 312 breed
 * profiles imported via populateBreedsFromSql.mjs landed in production.
 *
 * Equoria-f8qew (2026-06-02): the breed source files now carry all 8
 * conformation regions (topline added), so the DB profile is complete and
 * the loader returns it directly on a cache hit — the transitional per-key
 * merge that grafted topline from the JSON has been removed. The JSON file
 * is RETAINED, not deleted: it still has live consumers (the no-preload
 * test suite via this loader, backend/tests/load/run-bulk-foaling-cron.mjs,
 * backend/scripts/backfill-horse-temperament.mjs, breedProfileSync.test.mjs,
 * and others). Removing it remains a separate follow-up gated on migrating
 * those consumers onto a preloaded DB cache.
 *
 * Contract:
 *   - `breedName` must match the DB row name (or the JSON key) exactly,
 *     case-sensitive.
 *   - Missing breeds are treated as data bugs and throw. No silent
 *     fallback to "generic defaults" — the previous architecture's
 *     "unknown breed → random defaults" pattern was the root cause of
 *     the stats bug corrected in PR #94, and the same instinct produced
 *     the all-Bay starter horses fixed under Equoria-wvdya.
 *
 * Equoria-wpfvl (2026-05-28).
 *
 * @module modules/horses/data/breedProfileLoader
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import logger from '../../../utils/logger.mjs';

// Equoria-f6xgn (2026-05-28): the LEGACY_ID_TO_NAME shim and its
// CANONICAL_BREEDS dependency were removed. The shim only resolved the 12
// hand-authored canonical breed IDs and would silently fail for the other
// ~300 breeds added by Equoria-26qjf.3, which is exactly the kind of
// quiet-degradation pattern the constitution forbids. Callers that have a
// numeric breedId resolve it to a name via Prisma before reaching here.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROFILES_PATH = resolve(__dirname, '../../../data/breedProfiles.json');

// ── JSON fallback (transition mechanism) ──────────────────────────────────────
// Loaded once at module init with readFileSync so the loader is usable in
// purely sync contexts (e.g. controller hot paths). Carries the 312-breed
// gait+temperament+category subset — NO color genetics. When the DB cache is
// populated (preloadBreedProfiles has run), the cache wins; this JSON is the
// safety net for boot-order races and tests that don't preload.
let PROFILES_BY_NAME = {};
let JSON_LOAD_ERROR = null;
try {
  PROFILES_BY_NAME = JSON.parse(readFileSync(PROFILES_PATH, 'utf8'));
} catch (err) {
  JSON_LOAD_ERROR = err;
  logger.error(
    `[breedProfileLoader] Failed to load breedProfiles.json (${PROFILES_PATH}): ${err.message}. ` +
      'Calls to getBreedProfile() will require preloadBreedProfiles(prisma) to have succeeded.',
  );
}

// ── DB cache (authoritative source post-26qjf) ────────────────────────────────
// Map<breedName, profile> populated by preloadBreedProfiles(). null when the
// cache has not been loaded yet (server.mjs boot before the await; bare test
// invocations).
let DB_CACHE = null;

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
 * missing `rating_profiles` are skipped — the loader's contract is that
 * every returned profile has the full conformation/gait/temperament
 * shape, so a malformed DB row is treated as absent rather than served.
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
  const next = new Map();
  for (const r of rows) {
    const p = r.breedGeneticProfile;
    // Four-part JSONB guard (CONTRIBUTING.md "JSONB type guard"): typeof null
    // is 'object' and typeof [] is 'object', so we must exclude both
    // explicitly. Profiles without rating_profiles are useless to consumers.
    if (
      p !== null &&
      p !== undefined &&
      typeof p === 'object' &&
      !Array.isArray(p) &&
      p.rating_profiles
    ) {
      next.set(r.name, p);
    }
  }
  DB_CACHE = next;
  logger.info(`[breedProfileLoader] DB cache preloaded: ${next.size} breed profiles`);
  return next.size;
}

/**
 * Test helper: clear the DB cache.
 * Underscore prefix marks it as a test-only export not part of the
 * production API. Exists so tests can exercise the JSON-fallback path
 * without polluting cache state across test files.
 */
export function _clearBreedProfileCache() {
  DB_CACHE = null;
}

/**
 * Fetch a breed's full profile by display name (or legacy numeric ID).
 *
 * Resolution order:
 *   1. DB cache (if populated) — authoritative full profile.
 *   2. breedProfiles.json — fallback for gait/temperament subset only.
 *
 * Throws if neither source has the breed, or if the loader was given a
 * malformed identifier.
 *
 * @param {string|number} breedIdentifier
 * @returns {object} the profile object (full when DB cache hit; gait/temp
 *   subset when JSON fallback)
 * @throws {Error} when both sources are empty / unable to resolve
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

  // Resolve from each source independently, then merge.
  const fromDb = DB_CACHE ? (DB_CACHE.get(breedName) ?? null) : null;
  const fromJson = PROFILES_BY_NAME[breedName] ?? null;

  if (!fromDb && !fromJson) {
    // Surface a different error message depending on which subsystem(s)
    // are actually broken so the operator can act precisely.
    if (DB_CACHE && JSON_LOAD_ERROR) {
      throw new Error(
        `No DB row for breed "${breedName}" AND breedProfiles.json failed to load — ` +
          `${JSON_LOAD_ERROR.message}`,
        { cause: JSON_LOAD_ERROR },
      );
    }
    if (DB_CACHE) {
      throw new Error(
        `No profile for breed "${breedName}" — absent from both the DB cache ` +
          `(${DB_CACHE.size} breeds loaded) and breedProfiles.json. ` +
          'Run `npm run seed:breeds` from backend/ to re-import, ' +
          'or confirm the breed name spelling.',
      );
    }
    if (JSON_LOAD_ERROR) {
      throw new Error(
        `breedProfiles.json failed to load AND DB cache is empty — ${JSON_LOAD_ERROR.message}`,
        { cause: JSON_LOAD_ERROR },
      );
    }
    throw new Error(
      `No breedProfiles.json entry for breed "${breedName}". ` +
        'Every breed must have a profile — check that the DB breed name matches the JSON key ' +
        'exactly, or call preloadBreedProfiles(prisma) at startup so the DB is consulted.',
    );
  }

  // Single-source paths.
  if (!fromDb) {
    // Cache absent (no preload) or this breed not in the cache — serve the
    // JSON profile. This is the path the whole backend test suite uses, since
    // tests intentionally do not preload the DB cache (see backend/tests/
    // setup.mjs). It is also the production boot-order safety net.
    return fromJson;
  }

  // DB cache hit. Post-Equoria-f8qew the DB profile is COMPLETE: the breed
  // source files (backend/data/breeds/*.txt) now carry all 8 conformation
  // regions — including `topline` — so the DB row imported via
  // populateBreedsFromSql.mjs is a strict superset of the JSON profile
  // (DB additionally carries color genetics: shade_bias, allele_weights,
  // marking_bias, etc.). The transitional per-key deep-merge that previously
  // grafted `topline` from the JSON onto topline-less DB rows (Equoria-wpfvl)
  // is therefore a no-op and has been removed: when the DB has the breed, the
  // DB profile is returned directly, regardless of whether the JSON also has it.
  return fromDb;
}

/**
 * Number of breeds available via the loader. Prefers the DB cache count
 * when populated; falls back to the JSON entry count.
 *
 * @returns {number}
 */
export function countLoadedBreedProfiles() {
  if (DB_CACHE) {
    return DB_CACHE.size;
  }
  return Object.keys(PROFILES_BY_NAME).length;
}
