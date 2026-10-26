/**
 * Query-parameter parsing shared by the marketplace browse endpoints: the stud
 * search (Equoria-q4uem.9 slice 5) and the sale browse (Equoria-dnpe4).
 *
 * Every refusal throws BadQuery; the controller answers it with a 400 and the
 * standard body (`badQueryResponse`). Nothing here reaches Prisma, so values
 * Prisma would reject (beyond int4, invalid dates, arrays) never become a 500.
 */

export const INT4_MAX = 2147483647;
const INT4_MIN = -2147483648;
/** Game-year age bound that keeps birthDateForAge a valid date. */
export const MAX_AGE_YEARS = 1000;

export class BadQuery extends Error {}

function bad(message) {
  return new BadQuery(message);
}

/** A repeated query parameter arrives as an array: refuse it rather than guess. */
export function single(query, key) {
  const value = query[key];
  if (Array.isArray(value) || (value !== undefined && typeof value !== 'string')) {
    throw bad(`${key} must be given once`);
  }
  return value;
}

/** A non-negative whole number within `max`, or undefined when absent (strict). */
export function boundedInt(query, key, max) {
  const value = single(query, key);
  if (value === undefined || value === '') {
    return undefined;
  }
  if (!/^\d+$/.test(value) || Number(value) > max) {
    throw bad(`${key} must be a whole number from 0 to ${max}`);
  }
  return Number(value);
}

/**
 * parseInt semantics (a decimal or signed number input still parses as
 * before), refusing only what Prisma cannot take: a value outside
 * [-limit, limit] (default int4). Returns undefined when absent and NaN when
 * not a number, so the caller keeps its own rule for non-numbers.
 */
export function lenientInt(query, key, limit = INT4_MAX) {
  const value = single(query, key);
  if (value === undefined) {
    return undefined;
  }
  const n = parseInt(value, 10);
  const low = limit === INT4_MAX ? INT4_MIN : -limit;
  if (n < low || n > limit) {
    throw bad(`${key} must be a whole number from ${low} to ${limit}`);
  }
  return n;
}

/** lenientInt that also refuses a non-number. */
export function requiredLenientInt(query, key, limit = INT4_MAX) {
  const n = lenientInt(query, key, limit);
  if (Number.isNaN(n)) {
    throw bad(`${key} must be a whole number`);
  }
  return n;
}

/** Own-key lookup so `__proto__` / `constructor` are rejected, never resolved. */
export function ownValue(table, key, label) {
  if (!Object.hasOwn(table, key)) {
    // No list of the accepted keys: they are stored names, not words for players
    // (Equoria-bdpvw).
    throw bad(`That ${label} is not one the market offers`);
  }
  return table[key];
}

/** Run `parse(query)`; a BadQuery becomes a 400 with the standard body. */
export function parseOr400(res, parse, query) {
  try {
    return { params: parse(query) };
  } catch (error) {
    if (error instanceof BadQuery) {
      res.status(400).json({ success: false, message: error.message });
      return { sent: true };
    }
    throw error;
  }
}

// Every order ends on `id` so tied prices/ages page deterministically (Equoria-dnpe4).
// The keyset spec (Equoria-cmw85.21) carries each column's cursor type; the three
// sort columns are nullable on Horse, and Postgres puts NULLs last ascending and first
// descending, which is what keysetWhere assumes without a `nulls` override.
const idAsc = { key: 'id', dir: 'asc', type: 'int' };
const SALE_SORT = Object.freeze({
  price_asc: [{ key: 'salePrice', dir: 'asc', type: 'int', nullable: true }, idAsc],
  price_desc: [{ key: 'salePrice', dir: 'desc', type: 'int', nullable: true }, idAsc],
  youngest: [{ key: 'age', dir: 'asc', type: 'int', nullable: true }, idAsc],
  newest: [{ key: 'createdAt', dir: 'desc', type: 'date', nullable: true }, idAsc],
});

/**
 * The sale browse query, validated up front (Equoria-dnpe4): a repeated param,
 * an unknown sort, a value beyond int4 or an age that breaks birthDateForAge is
 * a 400. Numbers keep parseInt semantics; a non-numeric breedId is ignored.
 */
export function parseSaleQuery(query) {
  const breedId = lenientInt(query, 'breedId');
  return {
    name: single(query, 'name'),
    breed: single(query, 'breed'),
    breedId: Number.isNaN(breedId) ? undefined : breedId,
    sex: single(query, 'sex'),
    minAge: requiredLenientInt(query, 'minAge', MAX_AGE_YEARS),
    maxAge: requiredLenientInt(query, 'maxAge', MAX_AGE_YEARS),
    minPrice: requiredLenientInt(query, 'minPrice'),
    maxPrice: requiredLenientInt(query, 'maxPrice'),
    page: lenientInt(query, 'page'),
    limit: parseInt(single(query, 'limit'), 10),
    cursor: single(query, 'cursor'),
    sort: ownValue(SALE_SORT, single(query, 'sort') ?? 'newest', 'sort'),
  };
}
