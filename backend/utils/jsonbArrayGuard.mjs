/**
 * jsonbArrayGuard.mjs
 *
 * Defensive normalization helper for JSONB columns that are SUPPOSED to hold
 * an array (e.g. horse.epigeneticFlags) but, per the project JSONB type-guard
 * convention (.claude/rules/CONTRIBUTING.md "Backend Conventions" #1), can
 * arrive as null, undefined, a primitive, or a non-array object on
 * legacy/bare-created rows.
 *
 * Prisma returns JSONB columns as JsonValue. Reading .includes()/.forEach()/
 * .length off a null or non-array value throws at runtime
 * ("Cannot read properties of null (reading 'includes')"). This helper applies
 * the full four-part guard (not null AND not undefined AND is an Array) and
 * returns a safe array — the original array if it is one, otherwise an empty
 * array — so callers can use array methods unconditionally.
 *
 * @param {unknown} value - a JSONB value expected to be an array of strings
 * @returns {Array} the value if it is an array, otherwise []
 */
export function asFlagArray(value) {
  // typeof null === 'object' and typeof [] === 'object', so we cannot rely on
  // a typeof check alone — Array.isArray is the only correct discriminator.
  return Array.isArray(value) ? value : [];
}

export default asFlagArray;
