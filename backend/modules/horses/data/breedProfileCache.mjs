/**
 * breedProfileCache.mjs — the in-memory DB breed profile cache (Equoria-ctop1).
 *
 * Holds Map<breedName, profile> built from `breeds.breedGeneticProfile` rows.
 * breedProfileLoader.mjs fills it (preloadBreedProfiles) and reads it
 * (getBreedProfile); see that module for the source-of-truth precedence.
 *
 * The cache lives on globalThis, not in module scope, for the reason
 * packages/database/prismaClient.mjs keeps its client there. A server process
 * evaluates this module once, so the two are the same thing in production.
 * Under Jest (resetModules: true) the module registry is reset before every
 * test, and a module-scoped cache would be empty in any loader instance a
 * test imports after the reset (for example a route handler that awaits
 * import() of its controller). On globalThis the cache belongs to the test
 * file's sandbox global: every loader instance in the file sees it, and it is
 * dropped with the file's sandbox.
 *
 * No imports, on purpose: backend/tests/setup.mjs fills this cache for each
 * test file before the file loads, and whatever this module imported would be
 * evaluated in that file's module registry ahead of the file's own globals and
 * mocks.
 *
 * @module modules/horses/data/breedProfileCache
 */

const cacheKey = '__equoriaBreedProfileCache';

/**
 * Replace the cache with the profiles in `rows` ({ name, breedGeneticProfile }).
 *
 * Rows whose `breedGeneticProfile` is null, a primitive, an array, or missing
 * `ratingProfiles` are skipped: every cached profile must have the full
 * conformation/gait/temperament shape, so a malformed DB row is treated as
 * absent rather than served.
 *
 * @param {Array<{ name: string, breedGeneticProfile: unknown }>} rows
 * @returns {number} count of breeds in the cache
 * @throws {TypeError} when `rows` is not an array
 */
export function installBreedProfileRows(rows) {
  if (!Array.isArray(rows)) {
    throw new TypeError('installBreedProfileRows requires an array of breed rows');
  }
  const next = new Map();
  for (const r of rows) {
    const p = r.breedGeneticProfile;
    // Four-part JSONB guard (CONTRIBUTING.md "JSONB type guard"): typeof null
    // is 'object' and typeof [] is 'object', so we must exclude both
    // explicitly. Profiles without ratingProfiles are useless to consumers.
    if (
      p !== null &&
      p !== undefined &&
      typeof p === 'object' &&
      !Array.isArray(p) &&
      p.ratingProfiles
    ) {
      next.set(r.name, p);
    }
  }
  globalThis[cacheKey] = next;
  return next.size;
}

/** The cached Map, or null when nothing has been installed (or it was cleared). */
export function getBreedProfileCache() {
  return globalThis[cacheKey] ?? null;
}

/** Drop the cache; getBreedProfile falls back to breedProfiles.json. */
export function clearBreedProfileCache() {
  globalThis[cacheKey] = null;
}
