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
      logger.debug(`[paginationHelper] Invalid page parameter "${req.query.page}", using default: ${defaultPage}`);
    }
  }

  // Parse limit parameter
  let limit = parseInt(req.query.limit, 10);
  if (isNaN(limit) || limit < minLimit) {
    limit = defaultLimit;
    if (req.query.limit) {
      logger.debug(`[paginationHelper] Invalid limit parameter "${req.query.limit}", using default: ${defaultLimit}`);
    }
  }

  // Enforce maximum limit to prevent over-fetching
  if (limit > maxLimit) {
    logger.debug(`[paginationHelper] Limit ${limit} exceeds maximum ${maxLimit}, capping to ${maxLimit}`);
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
 * @returns {Object} Express response
 *
 * @example
 * return buildPaginatedResponse(res, horses, {
 *   page: 1,
 *   limit: 20,
 *   total: 500
 * }, { cached: true });
 */
export function buildPaginatedResponse(res, data, params, additionalMeta = {}) {
  const { page, limit, total } = params;

  const pagination = buildPaginationMetadata(page, limit, total);

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
 * Validate pagination parameters and throw error if invalid
 *
 * @param {number} page - Page number
 * @param {number} limit - Page size
 * @param {Object} options - Validation options
 * @throws {Error} If validation fails
 */
export function validatePaginationParams(page, limit, options = {}) {
  const {
    maxLimit = PAGINATION_DEFAULTS.maxLimit,
    minLimit = PAGINATION_DEFAULTS.minLimit,
  } = options;

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
  if (total === 0) { return 0; }
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
export function buildCursorPaginatedResponse(res, data, limit, cursorField = 'id', additionalMeta = {}) {
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
      logger.debug(`[paginationMiddleware] Parsed pagination: page=${req.pagination.page}, limit=${req.pagination.limit}`);
    }
    next();
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
};
