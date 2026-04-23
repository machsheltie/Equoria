/**
 * Shared loader for backend/data/breedProfiles.json.
 *
 * The JSON is the single source of truth for per-breed conformation,
 * gait, and temperament profiles. Every breed in breedStarterStats.json
 * has a matching entry here (309 breeds). Loaded once at module import
 * and exposed via `getBreedProfile(name)`.
 *
 * Contract:
 *   - `breedName` must match a JSON key exactly (case-sensitive).
 *   - Missing breeds are treated as data bugs and throw. There is no
 *     silent fallback — the previous architecture's "unknown breed ->
 *     random defaults" pattern was the root cause of the stats bug
 *     corrected in PR #94 (store horses), and the same mistake in
 *     conformation/gait/temperament services motivated this refactor.
 *
 * @module modules/horses/data/breedProfileLoader
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import logger from '../../../utils/logger.mjs';
import { CANONICAL_BREEDS } from './breedGeneticProfiles.mjs';

// Legacy numeric-ID → breed name map. Used ONLY when a caller (typically
// a test fixture) passes a numeric breedId instead of the breed display
// name. The authoritative identifier is the name; this is a shim for
// backward compatibility with older call sites and can be removed once
// those sites migrate to `await prisma.breed.findUnique({...}).name`.
const LEGACY_ID_TO_NAME = Object.fromEntries(CANONICAL_BREEDS.map(b => [b.id, b.name]));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROFILES_PATH = resolve(__dirname, '../../../data/breedProfiles.json');

let PROFILES_BY_NAME = {};
let LOAD_ERROR = null;
try {
  PROFILES_BY_NAME = JSON.parse(readFileSync(PROFILES_PATH, 'utf8'));
} catch (err) {
  LOAD_ERROR = err;
  logger.error(
    `[breedProfileLoader] FATAL: Failed to load breedProfiles.json (${PROFILES_PATH}): ${err.message}. Every conformation/gait/temperament generation will throw until this file is readable.`,
  );
}

/**
 * Fetch a breed's rating_profiles + temperament_weights by display name or legacy numeric id.
 *
 * @param {string|number} breedIdentifier - Breed display name (must match JSON key) or legacy canonical-12 numeric id.
 * @returns {{
 *   category: string,
 *   rating_profiles: {
 *     conformation: Record<string, {mean: number, std_dev: number}>,
 *     gaits: Record<string, {mean: number, std_dev: number}|null>,
 *     is_gaited_breed: boolean,
 *     gaited_gait_registry: string[]|null,
 *   },
 *   temperament_weights: Record<string, number>,
 * }}
 * @throws {Error} if the breed is missing from breedProfiles.json.
 */
export function getBreedProfile(breedIdentifier) {
  if (LOAD_ERROR) {
    throw new Error(`breedProfiles.json failed to load — ${LOAD_ERROR.message}`, {
      cause: LOAD_ERROR,
    });
  }
  // Resolve legacy numeric breedId to display name via the canonical-12 map.
  // New callers should pass the name string directly.
  let breedName = breedIdentifier;
  if (typeof breedIdentifier === 'number' && Number.isFinite(breedIdentifier)) {
    breedName = LEGACY_ID_TO_NAME[breedIdentifier];
    if (!breedName) {
      throw new Error(
        `No canonical-12 breed for numeric breedId ${breedIdentifier}. ` +
          'New callers should pass a breed display name string — fetch it via ' +
          '`prisma.breed.findUnique({ where: { id }, select: { name: true } })`.',
      );
    }
  }
  if (!breedName || typeof breedName !== 'string') {
    throw new Error(
      `getBreedProfile requires a non-empty breed display name string or a numeric breedId in the canonical-12 range (got: ${JSON.stringify(breedIdentifier)}).`,
    );
  }
  const profile = PROFILES_BY_NAME[breedName];
  if (!profile) {
    throw new Error(
      `No breedProfiles.json entry for breed "${breedName}". ` +
        'Every breed must have a profile — check that the DB breed name matches the JSON key ' +
        'exactly, and/or rerun backend/scripts/generateBreedProfiles.mjs if breedStarterStats.json ' +
        'was extended.',
    );
  }
  return profile;
}

/** Number of breeds loaded. For diagnostics/tests. */
export function countLoadedBreedProfiles() {
  return Object.keys(PROFILES_BY_NAME).length;
}
