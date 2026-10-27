/**
 * Query-parameter parsing for the marketplace horse search (Equoria-q4uem.9.1).
 *
 * Every refusal throws BadQuery; the controller answers it with a 400 and the
 * standard body (`badQueryResponse`). Nothing here reaches Prisma, so values
 * Prisma would reject (beyond int4, invalid dates, arrays) never become a 500.
 */

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
