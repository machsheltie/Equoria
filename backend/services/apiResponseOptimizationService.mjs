/**
 * 🚀 API Response Optimization Service
 *
 * Comprehensive service for optimizing API response performance including:
 * - Response compression and encoding
 * - Advanced pagination with cursor-based navigation
 * - Data serialization optimization
 * - Lazy loading and selective field inclusion
 * - Response caching and ETags
 * - Payload size optimization
 *
 * Features:
 * - Gzip/Brotli compression with intelligent selection
 * - Cursor-based pagination for large datasets
 * - Field selection and data transformation
 * - Response size monitoring and optimization
 * - Cache-friendly response headers
 * - Performance metrics collection
 */

import compression from 'compression';
import { createHash } from 'crypto';
import logger from '../utils/logger.mjs';

// Performance metrics tracking
const performanceMetrics = {
  compressionRatio: new Map(),
  responseSize: new Map(),
  serializationTime: new Map(),
  cacheHits: 0,
  cacheMisses: 0,
};

/**
 * Create compression middleware with intelligent algorithm selection
 */
export function createCompressionMiddleware(options = {}) {
  const defaultOptions = {
    threshold: 1024, // Only compress responses > 1KB
    level: 6, // Balanced compression level
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (!req.headers['accept-encoding']) {
        return false;
      }

      // Don't compress images, videos, or already compressed content
      const contentType = res.getHeader('content-type');
      if (
        contentType &&
        (contentType.includes('image/') ||
          contentType.includes('video/') ||
          contentType.includes('application/zip') ||
          contentType.includes('application/gzip'))
      ) {
        return false;
      }

      return compression.filter(req, res);
    },
    ...options,
  };

  return compression(defaultOptions);
}

/**
 * Advanced pagination service with cursor-based navigation
 */
export class PaginationService {
  /**
   * Create cursor-based pagination for large datasets
   */
  static createCursorPagination(options) {
    const {
      data,
      cursor,
      limit = 20,
      orderBy = 'id',
      _orderDirection = 'asc',
      totalCount,
    } = options;

    const hasNextPage = data.length === limit;
    const hasPrevPage = !!cursor;

    const nextCursor = hasNextPage ? data[data.length - 1][orderBy] : null;
    const prevCursor = hasPrevPage ? data[0][orderBy] : null;

    return {
      data,
      pagination: {
        cursor: {
          next: nextCursor,
          prev: prevCursor,
        },
        hasNextPage,
        hasPrevPage,
        limit,
        totalCount: totalCount || null,
      },
    };
  }

  /**
   * Create offset-based pagination with performance optimizations
   */
  static createOffsetPagination(options) {
    const { data, page = 1, limit = 20, totalCount } = options;

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      data,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
    };
  }

  /**
   * Generate optimized Prisma query for cursor pagination
   */
  static generateCursorQuery(options) {
    const { cursor, limit = 20, orderBy = 'id', orderDirection = 'asc', where = {} } = options;

    const query = {
      where,
      orderBy: { [orderBy]: orderDirection },
      take: limit,
    };

    if (cursor) {
      query.cursor = { [orderBy]: cursor };
      query.skip = 1; // Skip the cursor item
    }

    return query;
  }
}

/**
 * Data serialization optimization service
 */
export class SerializationService {
  /**
   * Optimize data serialization with field selection
   */
  static optimizeResponse(data, options = {}) {
    const startTime = Date.now();

    const { fields, exclude, transform, compress = true } = options;

    let optimizedData = data;

    // Apply field selection
    if (fields && Array.isArray(fields)) {
      optimizedData = this.selectFields(optimizedData, fields);
    }

    // Apply field exclusion
    if (exclude && Array.isArray(exclude)) {
      optimizedData = this.excludeFields(optimizedData, exclude);
    }

    // Apply custom transformations
    if (transform && typeof transform === 'function') {
      optimizedData = transform(optimizedData);
    }

    // Apply data compression optimizations
    if (compress) {
      optimizedData = this.compressDataStructure(optimizedData);
    }

    const serializationTime = Date.now() - startTime;
    performanceMetrics.serializationTime.set(Date.now(), serializationTime);

    return optimizedData;
  }

  /**
   * Select specific fields from data
   */
  static selectFields(data, fields) {
    if (Array.isArray(data)) {
      return data.map(item => this.selectFieldsFromObject(item, fields));
    }
    return this.selectFieldsFromObject(data, fields);
  }

  /**
   * Exclude specific fields from data
   */
  static excludeFields(data, excludeFields) {
    if (Array.isArray(data)) {
      return data.map(item => this.excludeFieldsFromObject(item, excludeFields));
    }
    return this.excludeFieldsFromObject(data, excludeFields);
  }

  /**
   * Select fields from a single object
   */
  static selectFieldsFromObject(obj, fields) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result = {};
    for (const field of fields) {
      if (field.includes('.')) {
        // Handle nested field selection
        const [parent, ...nested] = field.split('.');
        if (obj[parent]) {
          result[parent] = this.selectFieldsFromObject(obj[parent], [nested.join('.')]);
        }
      } else if (Object.prototype.hasOwnProperty.call(obj, field)) {
        result[field] = obj[field];
      }
    }
    return result;
  }

  /**
   * Exclude fields from a single object
   */
  static excludeFieldsFromObject(obj, excludeFields) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result = { ...obj };
    for (const field of excludeFields) {
      if (field.includes('.')) {
        // Handle nested field exclusion
        const [parent, ...nested] = field.split('.');
        if (result[parent]) {
          result[parent] = this.excludeFieldsFromObject(result[parent], [nested.join('.')]);
        }
      } else {
        delete result[field];
      }
    }
    return result;
  }

  /**
   * Compress data structure by removing null/undefined values and optimizing arrays
   */
  static compressDataStructure(data) {
    if (Array.isArray(data)) {
      return data
        .map(item => this.compressDataStructure(item))
        .filter(item => item !== null && item !== undefined);
    }

    // Preserve Date objects — they serialize to ISO strings via toJSON().
    //
    // Equoria-oeg8k (2026-09-11): the brand check, NOT `data instanceof Date`.
    // `instanceof` is constructor IDENTITY, so it is false for a Date minted in
    // another JS module realm. Such a Date failed this guard, fell into the
    // object branch below, and — because a Date has no own enumerable
    // properties — came out as `{}`.
    //
    // SCOPE, MEASURED, AND NOT WIDER THAN THIS: the realm split is a property of
    // the Jest `--experimental-vm-modules` harness, NOT of the server.
    //   * Under `backend/jest.config.mjs` a Prisma `DateTime` has
    //     `instanceof Date === false` with brand `[object Date]`, and
    //     `GET /api/v1/auth/email-change/status` put `"expiresAt":{}` on the wire
    //     while its sibling `resendAvailableAt` (built with this realm's
    //     `new Date()`) serialized correctly.
    //   * In a plain `node` process — the production shape — the same code,
    //     database and client give `instanceof Date === true`, and the OLD guard
    //     preserved the value correctly. Backend production code creates no
    //     second realm: no `node:vm`, `worker_threads`, `isolated-vm` or
    //     `new Worker(`. So no player-facing response was ever affected, and
    //     this is not a record of a shipped defect.
    // It is still worth fixing: a guard on constructor identity is wrong on its
    // own terms, and while it was in place every timestamp in every
    // test-visible response was `{}` — which makes them all unassertable and is
    // a false-negative generator for the whole suite.
    //
    // `Object.prototype.toString` tag-checking is realm-independent and is the
    // guard this repository already settled on in
    // `services/jobs/cronJobMonitor.mjs` (`toIsoStringSafe`). Take that file's
    // guard, not its cause story: it attributes the split to `@prisma/client`
    // resolving through a different `node_modules` tree, and a plain-`node` run
    // THROUGH exactly such a junction resolves `instanceof` correctly, so module
    // duplication is not what creates a realm. The trigger is unestablished.
    //
    // No value that serialized correctly before changes: a same-realm Date is
    // still returned as-is. Two inputs do change branch, neither reachable here
    // and neither previously working — a `Proxy`-wrapped Date (was preserved,
    // then threw inside `JSON.stringify`) and an object forging
    // `Symbol.toStringTag === 'Date'` (was compressed; wire-identical either
    // way).
    if (Object.prototype.toString.call(data) === '[object Date]') {
      return data;
    }

    // Convert Prisma `Decimal` to a JSON number.
    //
    // Equoria-6ftvc (2026-09-21): a `Decimal` is `typeof object` and had NO
    // branch here, so the catch-all below rebuilt it with `Object.entries` into
    // a plain object — discarding the prototype that carries `toJSON`. Measured
    // on the wire through `GET /api/v1/grooms/:id/profile`, a `sessionRate` of
    // 17.50 arrived as `{"s":1,"e":1,"d":[17,5000000]}`.
    //
    // UNLIKE the Date case above this needed no realm split to bite: there was
    // simply no branch, so every environment took the catch-all. `compress`
    // defaults to true and `responseOptimization()` is mounted app-wide in
    // app.mjs, so it reached every response carrying any of the schema's seven
    // `Decimal` columns. The player-facing one is `Groom.sessionRate`:
    // GroomList.tsx types it `number` and gates hiring on
    // `(user.money || 0) >= sessionRate * 7`. Object times seven is NaN and
    // every comparison with NaN is false, so no groom could ever be afforded.
    //
    // NUMBER, NOT `Decimal.toJSON()`'S STRING. `toJSON()` yields "17.5", and
    // every frontend consumer declares these `number` and does arithmetic on
    // them — `CompetitionResultsList.tsx` totals prizes with `sum + r.prizeWon`,
    // which CONCATENATES on strings. The backend had already settled this at 16
    // sites in 9 files (resultModelService, groomFreeAgentController,
    // groomMarketplaceController, horseOverviewController, userStatsService,
    // the leaderboards), every one of them `Number(...)`; this makes the
    // controllers that forgot to coerce agree with the ones that did.
    //
    // PRECISION. An IEEE-754 double round-trips any decimal of <= 15 significant
    // digits. The widest `Decimal` column in the schema is `@db.Decimal(10, 2)`
    // (sessionRate, cost, score, prizeWon) — ten — and the others are
    // `Decimal(5, 4)` probabilities, so no column loses information crossing to
    // Number. What a double cannot promise is exact CENT ARITHMETIC over many
    // additions; that is acceptable because every authoritative money mutation
    // happens in the backend against the database inside a Prisma transaction,
    // and the wire value is read for display and affordability comparison only.
    //
    // BRAND CHECK, not `instanceof Prisma.Decimal` — same reasoning as the Date
    // guard above, and it additionally avoids importing the Prisma client into
    // a pure serialization service. `Object.prototype.toString` reads the
    // value's own `Symbol.toStringTag`, which decimal.js sets to 'Decimal'.
    if (Object.prototype.toString.call(data) === '[object Decimal]') {
      return Number(data);
    }

    if (data && typeof data === 'object') {
      const compressed = {};
      for (const [key, value] of Object.entries(data)) {
        // Only remove undefined values, keep null values (null is a valid API response value)
        if (value !== undefined) {
          compressed[key] = this.compressDataStructure(value);
        }
      }
      return compressed;
    }

    return data;
  }
}

/**
 * Lazy loading service for related data
 */
export class LazyLoadingService {
  /**
   * Create lazy loading configuration for Prisma queries
   */
  static createLazyConfig(baseQuery, lazyFields = []) {
    const config = { ...baseQuery };

    // Remove expensive includes by default
    if (config.include) {
      const optimizedInclude = {};
      for (const [key, value] of Object.entries(config.include)) {
        if (!lazyFields.includes(key)) {
          optimizedInclude[key] = value;
        }
      }
      config.include = optimizedInclude;
    }

    return config;
  }

  /**
   * Load related data on demand.
   *
   * Equoria-rfr90 — fail-closed: a failure in ANY relation fetch (DB
   * outage, FK violation, permission error) now rejects the whole call.
   * Previously this loop silently swapped failed relations for null,
   * leaving callers unable to distinguish missing-row from
   * broken-subsystem and producing the exact fail-open behaviour
   * EDGE_CASE_FIX_DISCIPLINE §3 forbids.
   *
   * The fetches now run in parallel via Promise.all — delivering the
   * optimization this service advertises. Promise.all rejects on the
   * first failure, so the function's surface contract is now: fully
   * populated object on success, thrown error on any sub-failure.
   * Callers MUST try/catch (or .catch) and decide what to surface.
   *
   * @throws {Error} when any relation fetch throws — caller responsible
   *   for translating into the user-facing response.
   */
  static async loadRelatedData(model, id, relations, prisma) {
    const settled = await Promise.allSettled(
      relations.map(relation => this.loadSingleRelation(model, id, relation, prisma)),
    );

    const failures = [];
    const relatedData = {};
    for (let i = 0; i < relations.length; i += 1) {
      const result = settled[i];
      const relation = relations[i];
      if (result.status === 'fulfilled') {
        relatedData[relation] = result.value;
      } else {
        failures.push({ relation, error: result.reason });
      }
    }

    if (failures.length > 0) {
      // Log every failure (not just the first) so operations can see the
      // full blast-radius of a subsystem outage in one log line.
      for (const { relation, error } of failures) {
        logger.error(
          `[LazyLoading] Failed to load relation ${relation} for ${model}/${id}: ${error?.message ?? error}`,
        );
      }
      // Surface a single error that names every failed relation. Caller
      // decides how to translate into HTTP. Includes the first cause for
      // stack-trace fidelity.
      const failedNames = failures.map(f => f.relation).join(', ');
      const aggregate = new Error(`Failed to load related data for ${model}/${id}: ${failedNames}`);
      aggregate.cause = failures[0].error;
      aggregate.failedRelations = failures.map(f => f.relation);
      throw aggregate;
    }

    return relatedData;
  }

  /**
   * Load a single relation
   */
  static async loadSingleRelation(model, id, relation, prisma) {
    const query = {
      where: { id },
      select: { [relation]: true },
    };

    const result = await prisma[model].findUnique(query);
    return result?.[relation] || null;
  }
}

/**
 * Response caching service with ETag support
 */
export class ResponseCacheService {
  /**
   * Generate ETag for response data
   */
  static generateETag(data) {
    const hash = createHash('md5');
    hash.update(JSON.stringify(data));
    return `"${hash.digest('hex')}"`;
  }

  /**
   * Check if response should be cached
   */
  static shouldCache(req, res) {
    // Don't cache POST, PUT, DELETE requests
    if (!['GET', 'HEAD'].includes(req.method)) {
      return false;
    }

    // Don't cache error responses
    if (res.statusCode >= 400) {
      return false;
    }

    // If the handler has already set a Cache-Control policy, respect it.
    // Previously this only checked for 'no-cache' and silently overrode
    // handler-set 'no-store' or 'private' policies — a ZAP rule 10049
    // root cause ("Storable but Non-Cacheable Content" on /health, /ready,
    // and the SPA HTML).
    if (res.getHeader('Cache-Control')) {
      return false;
    }

    return true;
  }

  /**
   * Set cache headers for response
   */
  static setCacheHeaders(res, options = {}) {
    const {
      maxAge = 300, // 5 minutes default
      staleWhileRevalidate = 60, // 1 minute
      etag,
    } = options;

    res.setHeader(
      'Cache-Control',
      `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    );

    if (etag) {
      res.setHeader('ETag', etag);
    }
  }
}

/**
 * Get performance metrics
 */
export function getPerformanceMetrics() {
  return {
    compressionRatio: Object.fromEntries(performanceMetrics.compressionRatio),
    responseSize: Object.fromEntries(performanceMetrics.responseSize),
    serializationTime: Object.fromEntries(performanceMetrics.serializationTime),
    cacheHitRate:
      performanceMetrics.cacheHits /
        (performanceMetrics.cacheHits + performanceMetrics.cacheMisses) || 0,
    totalRequests: performanceMetrics.cacheHits + performanceMetrics.cacheMisses,
  };
}

export default {
  createCompressionMiddleware,
  PaginationService,
  SerializationService,
  LazyLoadingService,
  ResponseCacheService,
  getPerformanceMetrics,
};
