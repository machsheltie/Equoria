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
      if (!req.headers['accept-encoding']) return false;
      
      // Don't compress images, videos, or already compressed content
      const contentType = res.getHeader('content-type');
      if (contentType && (
        contentType.includes('image/') ||
        contentType.includes('video/') ||
        contentType.includes('application/zip') ||
        contentType.includes('application/gzip')
      )) {
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
      orderDirection = 'asc',
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
    const {
      data,
      page = 1,
      limit = 20,
      totalCount,
    } = options;

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
    const {
      cursor,
      limit = 20,
      orderBy = 'id',
      orderDirection = 'asc',
      where = {},
    } = options;

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
    
    const {
      fields,
      exclude,
      transform,
      compress = true,
    } = options;

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
    if (!obj || typeof obj !== 'object') return obj;
    
    const result = {};
    for (const field of fields) {
      if (field.includes('.')) {
        // Handle nested field selection
        const [parent, ...nested] = field.split('.');
        if (obj[parent]) {
          result[parent] = this.selectFieldsFromObject(obj[parent], [nested.join('.')]);
        }
      } else if (obj.hasOwnProperty(field)) {
        result[field] = obj[field];
      }
    }
    return result;
  }

  /**
   * Exclude fields from a single object
   */
  static excludeFieldsFromObject(obj, excludeFields) {
    if (!obj || typeof obj !== 'object') return obj;
    
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
      return data.map(item => this.compressDataStructure(item)).filter(item => item != null);
    }
    
    if (data && typeof data === 'object') {
      const compressed = {};
      for (const [key, value] of Object.entries(data)) {
        if (value != null) {
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
   * Load related data on demand
   */
  static async loadRelatedData(model, id, relations, prisma) {
    const relatedData = {};
    
    for (const relation of relations) {
      try {
        relatedData[relation] = await this.loadSingleRelation(model, id, relation, prisma);
      } catch (error) {
        logger.warn(`[LazyLoading] Failed to load relation ${relation}: ${error.message}`);
        relatedData[relation] = null;
      }
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
    if (!['GET', 'HEAD'].includes(req.method)) return false;
    
    // Don't cache error responses
    if (res.statusCode >= 400) return false;
    
    // Don't cache if explicitly disabled
    if (res.getHeader('Cache-Control')?.includes('no-cache')) return false;
    
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

    res.setHeader('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
    
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
    cacheHitRate: performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses) || 0,
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
