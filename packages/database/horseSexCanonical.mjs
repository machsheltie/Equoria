/**
 * Canonical horse-sex form.
 *
 * The DB stores `horse.sex` as a free String column. Without canonicalization,
 * different write paths drift: foaling/auth use Title Case ('Mare', 'Stallion',
 * 'Filly', 'Colt', 'Rig'); the marketplace store endpoint historically
 * accepted 'mare'/'stallion' lowercase; tests and seeds used both. Result on
 * the frontend: horse cards show mixed casing.
 *
 * Single source of truth — every other module (constants/schema.mjs, the
 * Prisma `$extends` interceptor in prismaClient.mjs, controllers, the backfill
 * migration's allow-list) imports from here.
 */

export const CANONICAL_HORSE_SEX_VALUES = Object.freeze([
  'Stallion',
  'Mare',
  'Colt',
  'Filly',
  'Rig',
]);

const LOWER_TO_CANONICAL = new Map(CANONICAL_HORSE_SEX_VALUES.map((v) => [v.toLowerCase(), v]));

/**
 * Canonicalize a sex string to its Title Case canonical form.
 *
 * Accepts any casing of any allowed value ('mare', 'MARE', 'Mare',
 * 'stallion', 'STALLION') and returns the canonical Title Case form
 * ('Mare', 'Stallion'). Trims surrounding whitespace and collapses runs
 * of internal whitespace to a single space.
 *
 * @throws {TypeError} if input is not a string
 * @throws {RangeError} if input does not match a known canonical value
 */
export function canonicalizeHorseSex(input) {
  if (typeof input !== 'string') {
    throw new TypeError(`canonicalizeHorseSex: expected string, got ${typeof input}`);
  }
  const normalized = input.trim().replace(/\s+/g, ' ').toLowerCase();
  const canonical = LOWER_TO_CANONICAL.get(normalized);
  if (!canonical) {
    throw new RangeError(
      `canonicalizeHorseSex: ${JSON.stringify(input)} is not a recognized horse sex (expected one of ${CANONICAL_HORSE_SEX_VALUES.join(', ')})`
    );
  }
  return canonical;
}

/**
 * Canonicalize, but return null for null/undefined/empty-string input
 * (instead of throwing). Useful for optional update payloads where omitting
 * `sex` should leave the field unchanged.
 */
export function canonicalizeHorseSexOrNull(input) {
  if (input === null || input === undefined || input === '') {
    return null;
  }
  return canonicalizeHorseSex(input);
}

/**
 * Browse/search sex groups (Equoria-di2n5, user ruling 2026-08-19).
 *
 * 'Filly' and 'Colt' are not separate sexes — they are mares and stallions
 * under three years old. A buyer filtering a marketplace browse by 'Mare'
 * means "female horse" and expects fillies in the results; the AGE filter,
 * not the sex filter, is what excludes young horses. Filtering on the exact
 * stored string silently omitted every for-sale filly and colt.
 *
 * Any canonical value not listed here groups to itself.
 */
const SEX_FILTER_GROUPS = Object.freeze({
  Mare: Object.freeze(['Mare', 'Filly']),
  Stallion: Object.freeze(['Stallion', 'Colt']),
});

/**
 * Expand a user-supplied sex filter into the canonical stored values it
 * should match. Accepts any casing of any canonical value.
 *
 * @param {string} input — e.g. 'mare'
 * @returns {string[]} canonical values to match, e.g. ['Mare', 'Filly']
 * @throws {TypeError|RangeError} same contract as canonicalizeHorseSex
 */
export function horseSexFilterValues(input) {
  const canonical = canonicalizeHorseSex(input);
  return [...(SEX_FILTER_GROUPS[canonical] ?? [canonical])];
}
