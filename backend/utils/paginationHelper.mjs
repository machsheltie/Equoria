/**
 * 📄 Pagination Helper Utilities
 *
 * Standardized pagination utilities for all list endpoints
 * Features:
 * - Parse and validate pagination query parameters
 * - Build paginated responses with metadata
 * - Enforce maximum limits to prevent over-fetching
 * - Calculate pagination metadata (total pages, has next/prev, etc.)
 *
 * Usage in controllers:
 * ```javascript
 * import { parsePaginationParams, buildPaginatedResponse } from '../utils/paginationHelper.mjs';
 *
 * const { page, limit, skip } = parsePaginationParams(req, { maxLimit: 100 });
 * const [horses, total] = await Promise.all([
 *   prisma.horse.findMany({ skip, take: limit }),
 *   prisma.horse.count()
 * ]);
 * return buildPaginatedResponse(res, horses, { page, limit, total });
 * ```
 */

import logger from './logger.mjs';

/**
 * Default pagination configuration
 */
export const PAGINATION_DEFAULTS = {
  defaultPage: 1,
  defaultLimit: 20,
  maxLimit: 100,
  minLimit: 1,
};

/**
 * Parse pagination parameters from request query
 *
 * @param {Object} req - Express request object
 * @param {Object} options - Pagination options
 * @param {number} options.defaultPage - Default page number (default: 1)
 * @param {number} options.defaultLimit - Default page size (default: 20)
 * @param {number} options.maxLimit - Maximum page size (default: 100)
 * @param {number} options.minLimit - Minimum page size (default: 1)
 * @returns {Object} Parsed pagination params { page, limit, skip, offset }
 *
 * @example
 * // Request: GET /api/horses?page=2&limit=50
 * const { page, limit, skip } = parsePaginationParams(req);
 * // Returns: { page: 2, limit: 50, skip: 50, offset: 50 }
 */
export function parsePaginationParams(req, options = {}) {
  const {
    defaultPage = PAGINATION_DEFAULTS.defaultPage,
    defaultLimit = PAGINATION_DEFAULTS.defaultLimit,
    maxLimit = PAGINATION_DEFAULTS.maxLimit,
    minLimit = PAGINATION_DEFAULTS.minLimit,
  } = options;

  // Parse page parameter
  let page = parseInt(req.query.page, 10);
  if (isNaN(page) || page < 1) {
    page = defaultPage;
    if (req.query.page) {
      logger.debug(
        `[paginationHelper] Invalid page parameter "${req.query.page}", using default: ${defaultPage}`,
      );
    }
  }

  // Parse limit parameter
  let limit = parseInt(req.query.limit, 10);
  if (isNaN(limit) || limit < minLimit) {
    limit = defaultLimit;
    if (req.query.limit) {
      logger.debug(
        `[paginationHelper] Invalid limit parameter "${req.query.limit}", using default: ${defaultLimit}`,
      );
    }
  }

  // Enforce maximum limit to prevent over-fetching
  if (limit > maxLimit) {
    logger.debug(
      `[paginationHelper] Limit ${limit} exceeds maximum ${maxLimit}, capping to ${maxLimit}`,
    );
    limit = maxLimit;
  }

  // Calculate skip/offset
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    offset: skip, // Alias for skip
  };
}

/**
 * Build pagination metadata
 *
 * @param {number} page - Current page number
 * @param {number} limit - Page size
 * @param {number} total - Total number of records
 * @returns {Object} Pagination metadata
 */
export function buildPaginationMetadata(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    currentPage: page,
    pageSize: limit,
    totalRecords: total,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null,
    startRecord: total > 0 ? (page - 1) * limit + 1 : 0,
    endRecord: Math.min(page * limit, total),
  };
}

/**
 * Build paginated API response
 *
 * @param {Object} res - Express response object
 * @param {Array} data - Array of records for current page
 * @param {Object} params - Pagination parameters
 * @param {number} params.page - Current page number
 * @param {number} params.limit - Page size
 * @param {number} params.total - Total number of records
 * @param {Object} additionalMeta - Additional metadata to include in response
 * @param {Object} topLevel - Further top-level keys for the body (e.g. the keyset `pageInfo`)
 * @returns {Object} Express response
 *
 * @example
 * return buildPaginatedResponse(res, horses, {
 *   page: 1,
 *   limit: 20,
 *   total: 500
 * }, { cached: true });
 */
export function buildPaginatedResponse(res, data, params, additionalMeta = {}, topLevel = {}) {
  const { page, limit, total } = params;

  const pagination = buildPaginationMetadata(page, limit, total);

  return res.status(200).json({
    success: true,
    data,
    pagination,
    ...topLevel,
    meta: {
      ...additionalMeta,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Validate pagination parameters and throw error if invalid
 *
 * @param {number} page - Page number
 * @param {number} limit - Page size
 * @param {Object} options - Validation options
 * @throws {Error} If validation fails
 */
export function validatePaginationParams(page, limit, options = {}) {
  const { maxLimit = PAGINATION_DEFAULTS.maxLimit, minLimit = PAGINATION_DEFAULTS.minLimit } =
    options;

  if (!Number.isInteger(page) || page < 1) {
    throw new Error(`Invalid page number: ${page}. Must be a positive integer.`);
  }

  if (!Number.isInteger(limit) || limit < minLimit) {
    throw new Error(`Invalid limit: ${limit}. Must be >= ${minLimit}.`);
  }

  if (limit > maxLimit) {
    throw new Error(`Invalid limit: ${limit}. Must be <= ${maxLimit}.`);
  }
}

/**
 * Calculate total pages from total records and page size
 *
 * @param {number} total - Total number of records
 * @param {number} limit - Page size
 * @returns {number} Total number of pages
 */
export function calculateTotalPages(total, limit) {
  if (total === 0) {
    return 0;
  }
  return Math.ceil(total / limit);
}

/**
 * Get cursor-based pagination parameters (for infinite scroll)
 *
 * @param {Object} req - Express request object
 * @param {Object} options - Cursor pagination options
 * @param {number} options.defaultLimit - Default page size
 * @param {number} options.maxLimit - Maximum page size
 * @param {string} options.cursorField - Field to use for cursor (default: 'id')
 * @returns {Object} Cursor pagination params { cursor, limit, direction }
 *
 * @example
 * // Request: GET /api/horses?cursor=123&limit=20&direction=next
 * const { cursor, limit, direction } = getCursorPaginationParams(req);
 */
export function getCursorPaginationParams(req, options = {}) {
  const {
    defaultLimit = PAGINATION_DEFAULTS.defaultLimit,
    maxLimit = PAGINATION_DEFAULTS.maxLimit,
    cursorField = 'id',
  } = options;

  // Parse limit
  let limit = parseInt(req.query.limit, 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  }
  if (limit > maxLimit) {
    limit = maxLimit;
  }

  // Parse cursor
  const cursor = req.query.cursor || null;

  // Parse direction (next or prev)
  const direction = req.query.direction === 'prev' ? 'prev' : 'next';

  return {
    cursor,
    limit,
    direction,
    cursorField,
  };
}

/**
 * Build cursor-based pagination metadata
 *
 * @param {Array} data - Current page data
 * @param {number} limit - Page size
 * @param {string} cursorField - Field used for cursor
 * @returns {Object} Cursor pagination metadata
 */
export function buildCursorPaginationMetadata(data, limit, cursorField = 'id') {
  const hasNextPage = data.length === limit;
  const hasPrevPage = data.length > 0; // Simplified, may need more logic

  const nextCursor = hasNextPage ? data[data.length - 1][cursorField] : null;
  const prevCursor = hasPrevPage && data.length > 0 ? data[0][cursorField] : null;

  return {
    pageSize: limit,
    recordCount: data.length,
    hasNextPage,
    hasPrevPage,
    nextCursor,
    prevCursor,
    cursorField,
  };
}

/**
 * Build cursor-based paginated response
 *
 * @param {Object} res - Express response object
 * @param {Array} data - Array of records
 * @param {number} limit - Page size
 * @param {string} cursorField - Field used for cursor
 * @param {Object} additionalMeta - Additional metadata
 * @returns {Object} Express response
 */
export function buildCursorPaginatedResponse(
  res,
  data,
  limit,
  cursorField = 'id',
  additionalMeta = {},
) {
  const pagination = buildCursorPaginationMetadata(data, limit, cursorField);

  return res.status(200).json({
    success: true,
    data,
    pagination,
    meta: {
      ...additionalMeta,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Prisma pagination helper - generate Prisma query params
 *
 * @param {Object} paginationParams - Parsed pagination params
 * @returns {Object} Prisma query params { skip, take }
 *
 * @example
 * const { page, limit, skip } = parsePaginationParams(req);
 * const prismaParams = getPrismaQueryParams({ page, limit, skip });
 * const horses = await prisma.horse.findMany({
 *   where: { forSale: true },
 *   ...prismaParams
 * });
 */
export function getPrismaQueryParams(paginationParams) {
  const { skip, limit } = paginationParams;

  return {
    skip,
    take: limit,
  };
}

/**
 * Middleware to automatically parse pagination params and attach to req
 *
 * Usage: app.use(paginationMiddleware());
 *
 * @param {Object} options - Pagination options
 * @returns {Function} Express middleware
 */
export function paginationMiddleware(options = {}) {
  return (req, res, next) => {
    // Only parse pagination for GET requests
    if (req.method === 'GET') {
      req.pagination = parsePaginationParams(req, options);
      logger.debug(
        `[paginationMiddleware] Parsed pagination: page=${req.pagination.page}, limit=${req.pagination.limit}`,
      );
    }
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyset (cursor) pagination: THE convention for list endpoints (Equoria-cmw85.19)
//
// The offset helpers above skip or repeat rows when rows are written between page
// fetches and degrade with depth; most of them also order by a non-unique column,
// so two rows tied on it can swap places between requests. New and migrated list
// endpoints use the contract below. (The older cursor helpers further up -
// getCursorPaginationParams and friends - are unused and are removed by
// Equoria-cmw85.34.) The design note this implements was retired with docs/design;
// this comment is now its home.
//
//  1. ORDERING. Every paginated orderBy ends in the row's unique id:
//     [...domainSort, { id: dir }]. Ties on the domain sort are then broken the same
//     way on every request.
//  2. CURSOR. Opaque to clients: "c1:" + base64url(JSON array of the last row's
//     sort values, id last). Dates travel as ISO strings, BigInts as strings; the
//     sort spec says how to read each back. An undecodable cursor is a 400
//     (InvalidCursorError), never a silently restarted list.
//  3. QUERY. A keyset predicate (the OR-ladder of keysetWhere, which handles mixed
//     directions) and `take: limit + 1` to learn hasMore without a count.
//  4. PARAMS. ?cursor and ?limit; limit defaults to 20 and is capped at 100 by ONE
//     clamp, clampLimit. The older ?page / ?offset keep working during migration;
//     a cursor wins when both are sent.
//  5. ENVELOPE. { items, pageInfo: { nextCursor, hasMore } }. A total is optional
//     and separate: only numbered-page screens (leaderboards, marketplace, forum)
//     need it, and it belongs behind a cache. Endpoints migrated before the
//     envelope is wanted by their clients keep their existing keys and add `pageInfo`.
//  6. EXCEPTION. groupBy aggregate leaderboards cannot use a row cursor; they keep
//     skip/take but must order with a unique tiebreak, sit behind a cache, and use
//     bounded counts.
//
// Endpoints still on offset pagination are listed on Equoria-cmw85.19.
// ─────────────────────────────────────────────────────────────────────────────

export const cursorPrefix = 'c1:';

/** Thrown for a cursor that cannot be decoded; the message is safe to show a client. */
export class InvalidCursorError extends Error {
  constructor(message = 'Invalid cursor') {
    super(message);
    this.name = 'InvalidCursorError';
    this.status = 400;
  }
}

/**
 * The one page-size clamp (default 20, max 100): a missing, non-numeric or
 * non-positive limit becomes the default, a large one the maximum.
 *
 * @param {unknown} raw
 * @param {{ def?: number, max?: number }} [options]
 * @returns {number}
 */
export function clampLimit(raw, { def = 20, max = 100 } = {}) {
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) {
    return def;
  }
  return Math.min(n, max);
}

const cursorValueReaders = {
  bool: v => (typeof v === 'boolean' ? v : undefined),
  int: v => (Number.isSafeInteger(v) ? v : undefined),
  bigint: v => (typeof v === 'string' && /^-?\d+$/.test(v) ? BigInt(v) : undefined),
  string: v => (typeof v === 'string' ? v : undefined),
  date: v => {
    const d = typeof v === 'string' ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : undefined;
  },
};

/** One sort value in cursor form: Date -> ISO string, BigInt -> string. */
function toCursorValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === 'bigint' ? value.toString() : value;
}

/**
 * @param {Array<Date|number|bigint|string>} values - the last row's sort values, id last
 * @returns {string}
 */
export function encodeCursor(values) {
  return (
    cursorPrefix + Buffer.from(JSON.stringify(values.map(toCursorValue))).toString('base64url')
  );
}

/**
 * @param {unknown} cursor
 * @param {Array<'bool'|'int'|'bigint'|'string'|'date'|'int?'|'bigint?'|'string?'|'date?'>} types - the type of each sort value, id last ('?' = the column may be null)
 * @returns {Array<Date|number|bigint|string>}
 * @throws {InvalidCursorError} on a wrong prefix, bad encoding, wrong length or wrong value type
 */
export function decodeCursor(cursor, types) {
  if (typeof cursor !== 'string' || !cursor.startsWith(cursorPrefix)) {
    throw new InvalidCursorError();
  }
  let parsed;
  try {
    parsed = JSON.parse(
      Buffer.from(cursor.slice(cursorPrefix.length), 'base64url').toString('utf8'),
    );
  } catch {
    throw new InvalidCursorError();
  }
  if (!Array.isArray(parsed) || parsed.length !== types.length) {
    throw new InvalidCursorError();
  }
  return parsed.map((value, i) => {
    // A trailing '?' marks a nullable sort column: null is a legal value there.
    const nullable = types[i].endsWith('?');
    const read =
      nullable && value === null ? null : cursorValueReaders[types[i].replace(/\?$/, '')]?.(value);
    if (read === undefined) {
      throw new InvalidCursorError();
    }
    return read;
  });
}

/**
 * The condition "after `value`" on one sort key, or null when no row can follow it.
 * NULLs sort as Postgres puts them (last ascending, first descending) unless the entry
 * says `nulls: 'first' | 'last'`. Booleans have no lt/gt filter in Prisma: equality.
 */
function afterOnKey({ key, dir, nullable, nulls }, value) {
  const desc = dir === 'desc';
  const nullsFirst = nulls ? nulls === 'first' : desc;
  if (value === null) {
    return nullsFirst ? { [key]: { not: null } } : null;
  }
  if (typeof value === 'boolean') {
    return desc === value ? { [key]: !value } : null;
  }
  const beyond = { [key]: { [desc ? 'lt' : 'gt']: value } };
  return nullable && !nullsFirst ? { OR: [beyond, { [key]: null }] } : beyond;
}

/**
 * The Prisma `where` fragment selecting the rows AFTER `values` in the sort
 * order (an OR-ladder: a later key only decides among rows equal on the earlier
 * ones), correct for mixed directions, nullable columns (`nullable: true` on the
 * sort entry, plus `nulls` when the query overrides where NULLs go) and boolean keys.
 *
 * @param {Array<{ key: string, dir: 'asc'|'desc', nullable?: boolean, nulls?: 'first'|'last' }>} sort
 * @param {Array<Date|number|bigint|string|boolean|null>} values - one per sort entry
 */
export function keysetWhere(sort, values) {
  const branches = [];
  sort.forEach((entry, i) => {
    const after = afterOnKey(entry, values[i]);
    if (after) {
      branches.push({
        ...Object.fromEntries(sort.slice(0, i).map((prev, j) => [prev.key, values[j]])),
        ...after,
      });
    }
  });
  return { OR: branches };
}

/**
 * The keyset parameters of a list request: `?limit` through the one clamp, `?cursor`
 * as sent (empty means none; a malformed one fails in the page query), and the legacy
 * offset (`?offset`, else `?page`) that applies only when no cursor is sent.
 * Returns `{ limit, cursor, skip }` for `req.query` and `{ def, max }` limits.
 */
export function readKeysetParams(query, limits = {}) {
  const limit = clampLimit(query.limit, limits);
  const offset = Number.parseInt(String(query.offset), 10);
  const page = Number.parseInt(String(query.page), 10);
  let skip = 0;
  if (Number.isSafeInteger(offset) && offset > 0) {
    skip = offset;
  } else if (Number.isSafeInteger(page) && page > 1) {
    skip = (page - 1) * limit;
  }
  return { limit, cursor: query.cursor === '' ? null : (query.cursor ?? null), skip };
}

/**
 * One keyset page. `sort` lists the order, id LAST (the unique tiebreak the
 * contract requires): `[{ key: 'createdAt', dir: 'desc', type: 'date' },
 * { key: 'id', dir: 'desc', type: 'int' }]`.
 *
 * `cursor` (when given) wins over `skip` (the legacy offset, kept while
 * endpoints migrate). Returns `{ items, pageInfo: { nextCursor, hasMore } }`.
 *
 * @param {(args: object) => Promise<object[]>} findMany - e.g. `args => prisma.horse.findMany(args)`
 * @param {{ where?: object, sort: Array<{key:string,dir:'asc'|'desc',type:string,nullable?:boolean,nulls?:'first'|'last'}>, limit: number, cursor?: string|null, skip?: number, extra?: object }} spec
 *   `extra` is spread into the findMany call (select / include).
 * @throws {InvalidCursorError}
 */
export async function findKeysetPage(
  findMany,
  { where = {}, sort, limit, cursor, skip = 0, extra = {} },
) {
  if (sort.at(-1)?.key !== 'id') {
    throw new Error('findKeysetPage: the sort must end with the unique id');
  }
  const after = cursor
    ? keysetWhere(
        sort,
        decodeCursor(
          cursor,
          sort.map(s => (s.nullable ? `${s.type}?` : s.type)),
        ),
      )
    : null;
  const rows = await findMany({
    ...extra,
    where: after ? { AND: [where, after] } : where,
    orderBy: sort.map(({ key, dir, nulls }) => ({ [key]: nulls ? { sort: dir, nulls } : dir })),
    take: limit + 1,
    ...(after || skip === 0 ? {} : { skip }),
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    pageInfo: {
      nextCursor: hasMore && last ? encodeCursor(sort.map(({ key }) => last[key])) : null,
      hasMore,
    },
  };
}

// Default export
export default {
  PAGINATION_DEFAULTS,
  parsePaginationParams,
  buildPaginationMetadata,
  buildPaginatedResponse,
  validatePaginationParams,
  calculateTotalPages,
  getCursorPaginationParams,
  buildCursorPaginationMetadata,
  buildCursorPaginatedResponse,
  getPrismaQueryParams,
  paginationMiddleware,
  clampLimit,
  readKeysetParams,
  encodeCursor,
  decodeCursor,
  keysetWhere,
  findKeysetPage,
  InvalidCursorError,
};
