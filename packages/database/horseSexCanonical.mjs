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
  'Gelding',
  'Colt',
  'Filly',
  'Rig',
  'Spayed Mare',
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
