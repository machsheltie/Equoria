import { describe, it, expect } from '@jest/globals';
import {
  PaginationService,
  SerializationService,
  ResponseCacheService,
  getPerformanceMetrics,
} from '../services/apiResponseOptimizationService.mjs';

// ─── PaginationService ───────────────────────────────────────────────────────

describe('PaginationService.createCursorPagination', () => {
  it('returns data and pagination object', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = PaginationService.createCursorPagination({ data, limit: 5 });
    expect(result.data).toBe(data);
    expect(result.pagination).toBeDefined();
  });

  it('hasNextPage true when data.length === limit', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = PaginationService.createCursorPagination({ data, limit: 2, orderBy: 'id' });
    expect(result.pagination.hasNextPage).toBe(true);
    expect(result.pagination.cursor.next).toBe(2);
  });

  it('hasNextPage false when data.length < limit', () => {
    const data = [{ id: 1 }];
    const result = PaginationService.createCursorPagination({ data, limit: 10, orderBy: 'id' });
    expect(result.pagination.hasNextPage).toBe(false);
    expect(result.pagination.cursor.next).toBeNull();
  });

  it('hasPrevPage true when cursor provided', () => {
    const data = [{ id: 5 }, { id: 6 }];
    const result = PaginationService.createCursorPagination({
      data,
      cursor: 4,
      limit: 5,
      orderBy: 'id',
    });
    expect(result.pagination.hasPrevPage).toBe(true);
    expect(result.pagination.cursor.prev).toBe(5);
  });

  it('hasPrevPage false when no cursor provided', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = PaginationService.createCursorPagination({ data, limit: 5 });
    expect(result.pagination.hasPrevPage).toBe(false);
    expect(result.pagination.cursor.prev).toBeNull();
  });

  it('includes totalCount when provided', () => {
    const data = [{ id: 1 }];
    const result = PaginationService.createCursorPagination({ data, limit: 5, totalCount: 42 });
    expect(result.pagination.totalCount).toBe(42);
  });

  it('totalCount is null when not provided', () => {
    const data = [{ id: 1 }];
    const result = PaginationService.createCursorPagination({ data, limit: 5 });
    expect(result.pagination.totalCount).toBeNull();
  });

  it('returns correct limit in pagination', () => {
    const data = [{ id: 1 }];
    const result = PaginationService.createCursorPagination({ data, limit: 15 });
    expect(result.pagination.limit).toBe(15);
  });

  it('defaults limit to 20', () => {
    const data = [];
    const result = PaginationService.createCursorPagination({ data });
    expect(result.pagination.limit).toBe(20);
  });
});

describe('PaginationService.createOffsetPagination', () => {
  it('returns data and pagination object', () => {
    const data = [{ id: 1 }];
    const result = PaginationService.createOffsetPagination({ data, page: 1, limit: 10, totalCount: 1 });
    expect(result.data).toBe(data);
    expect(result.pagination).toBeDefined();
  });

  it('calculates totalPages correctly', () => {
    const result = PaginationService.createOffsetPagination({
      data: [],
      page: 1,
      limit: 10,
      totalCount: 25,
    });
    expect(result.pagination.totalPages).toBe(3);
  });

  it('hasNextPage true when page < totalPages', () => {
    const result = PaginationService.createOffsetPagination({
      data: [],
      page: 1,
      limit: 10,
      totalCount: 25,
    });
    expect(result.pagination.hasNextPage).toBe(true);
    expect(result.pagination.nextPage).toBe(2);
  });

  it('hasNextPage false on last page', () => {
    const result = PaginationService.createOffsetPagination({
      data: [],
      page: 3,
      limit: 10,
      totalCount: 25,
    });
    expect(result.pagination.hasNextPage).toBe(false);
    expect(result.pagination.nextPage).toBeNull();
  });

  it('hasPrevPage true when page > 1', () => {
    const result = PaginationService.createOffsetPagination({
      data: [],
      page: 2,
      limit: 10,
      totalCount: 25,
    });
    expect(result.pagination.hasPrevPage).toBe(true);
    expect(result.pagination.prevPage).toBe(1);
  });

  it('hasPrevPage false on first page', () => {
    const result = PaginationService.createOffsetPagination({
      data: [],
      page: 1,
      limit: 10,
      totalCount: 25,
    });
    expect(result.pagination.hasPrevPage).toBe(false);
    expect(result.pagination.prevPage).toBeNull();
  });

  it('returns page, limit, totalCount in pagination', () => {
    const result = PaginationService.createOffsetPagination({
      data: [],
      page: 2,
      limit: 5,
      totalCount: 20,
    });
    expect(result.pagination.page).toBe(2);
    expect(result.pagination.limit).toBe(5);
    expect(result.pagination.totalCount).toBe(20);
  });
});

describe('PaginationService.generateCursorQuery', () => {
  it('returns basic query without cursor', () => {
    const query = PaginationService.generateCursorQuery({ limit: 10, orderBy: 'id' });
    expect(query.take).toBe(10);
    expect(query.orderBy).toEqual({ id: 'asc' });
    expect(query.cursor).toBeUndefined();
    expect(query.skip).toBeUndefined();
  });

  it('adds cursor and skip=1 when cursor provided', () => {
    const query = PaginationService.generateCursorQuery({
      cursor: 5,
      limit: 10,
      orderBy: 'id',
    });
    expect(query.cursor).toEqual({ id: 5 });
    expect(query.skip).toBe(1);
  });

  it('applies where clause', () => {
    const query = PaginationService.generateCursorQuery({
      limit: 10,
      where: { status: 'active' },
    });
    expect(query.where).toEqual({ status: 'active' });
  });

  it('respects orderDirection', () => {
    const query = PaginationService.generateCursorQuery({
      limit: 5,
      orderBy: 'name',
      orderDirection: 'desc',
    });
    expect(query.orderBy).toEqual({ name: 'desc' });
  });

  it('defaults orderDirection to asc', () => {
    const query = PaginationService.generateCursorQuery({ limit: 5, orderBy: 'id' });
    expect(query.orderBy).toEqual({ id: 'asc' });
  });
});

// ─── SerializationService ────────────────────────────────────────────────────

describe('SerializationService.selectFieldsFromObject', () => {
  it('returns only requested fields', () => {
    const obj = { id: 1, name: 'Alice', secret: 'hidden' };
    const result = SerializationService.selectFieldsFromObject(obj, ['id', 'name']);
    expect(result).toEqual({ id: 1, name: 'Alice' });
    expect(result.secret).toBeUndefined();
  });

  it('handles nested field selection with dot notation', () => {
    const obj = { id: 1, address: { city: 'NYC', zip: '10001' } };
    const result = SerializationService.selectFieldsFromObject(obj, ['id', 'address.city']);
    expect(result.id).toBe(1);
    expect(result.address).toEqual({ city: 'NYC' });
  });

  it('returns non-object values as-is', () => {
    expect(SerializationService.selectFieldsFromObject(null, ['id'])).toBeNull();
    expect(SerializationService.selectFieldsFromObject('string', ['id'])).toBe('string');
  });

  it('ignores fields not present in object', () => {
    const obj = { id: 1 };
    const result = SerializationService.selectFieldsFromObject(obj, ['id', 'missing']);
    expect(result).toEqual({ id: 1 });
  });
});

describe('SerializationService.excludeFieldsFromObject', () => {
  it('removes specified fields', () => {
    const obj = { id: 1, name: 'Alice', secret: 'hidden' };
    const result = SerializationService.excludeFieldsFromObject(obj, ['secret']);
    expect(result).toEqual({ id: 1, name: 'Alice' });
  });

  it('handles nested field exclusion with dot notation', () => {
    const obj = { id: 1, address: { city: 'NYC', zip: '10001' } };
    const result = SerializationService.excludeFieldsFromObject(obj, ['address.zip']);
    expect(result.id).toBe(1);
    expect(result.address).toEqual({ city: 'NYC' });
  });

  it('returns non-object values as-is', () => {
    expect(SerializationService.excludeFieldsFromObject(null, ['id'])).toBeNull();
  });

  it('returns unchanged object if excluded field not present', () => {
    const obj = { id: 1, name: 'Alice' };
    const result = SerializationService.excludeFieldsFromObject(obj, ['missing']);
    expect(result).toEqual({ id: 1, name: 'Alice' });
  });
});

describe('SerializationService.selectFields', () => {
  it('applies field selection to an array of objects', () => {
    const data = [
      { id: 1, name: 'A', x: 9 },
      { id: 2, name: 'B', x: 8 },
    ];
    const result = SerializationService.selectFields(data, ['id', 'name']);
    expect(result).toEqual([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);
  });

  it('applies field selection to a single object', () => {
    const result = SerializationService.selectFields({ id: 1, name: 'A', x: 9 }, ['id']);
    expect(result).toEqual({ id: 1 });
  });
});

describe('SerializationService.excludeFields', () => {
  it('applies exclusion to an array of objects', () => {
    const data = [
      { id: 1, name: 'A', secret: 'x' },
      { id: 2, name: 'B', secret: 'y' },
    ];
    const result = SerializationService.excludeFields(data, ['secret']);
    expect(result).toEqual([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);
  });

  it('applies exclusion to a single object', () => {
    const result = SerializationService.excludeFields({ id: 1, secret: 'x' }, ['secret']);
    expect(result).toEqual({ id: 1 });
  });
});

describe('SerializationService.compressDataStructure', () => {
  it('removes undefined values from object', () => {
    const result = SerializationService.compressDataStructure({ a: 1, b: undefined, c: 3 });
    expect(result).toEqual({ a: 1, c: 3 });
    expect(Object.keys(result)).not.toContain('b');
  });

  it('preserves null values', () => {
    const result = SerializationService.compressDataStructure({ a: 1, b: null });
    expect(result.b).toBeNull();
  });

  it('preserves Date objects', () => {
    const d = new Date('2025-01-01');
    const result = SerializationService.compressDataStructure({ created: d });
    expect(result.created).toBe(d);
  });

  it('removes null and undefined items from arrays', () => {
    const result = SerializationService.compressDataStructure([1, undefined, 3, null]);
    // both null and undefined are filtered from arrays
    expect(result).not.toContain(undefined);
    expect(result).not.toContain(null);
    expect(result).toContain(1);
    expect(result).toContain(3);
    expect(result).toHaveLength(2);
  });

  it('recursively processes nested objects', () => {
    const result = SerializationService.compressDataStructure({
      outer: { inner: undefined, keep: 'yes' },
    });
    expect(result.outer).toEqual({ keep: 'yes' });
  });

  it('returns primitives as-is', () => {
    expect(SerializationService.compressDataStructure(42)).toBe(42);
    expect(SerializationService.compressDataStructure('hello')).toBe('hello');
    expect(SerializationService.compressDataStructure(true)).toBe(true);
  });

  it('handles empty object', () => {
    expect(SerializationService.compressDataStructure({})).toEqual({});
  });
});

describe('SerializationService.optimizeResponse', () => {
  it('returns data unchanged when no options specified (compress on by default)', () => {
    const data = { a: 1, b: 2 };
    const result = SerializationService.optimizeResponse(data, { compress: false });
    expect(result).toEqual(data);
  });

  it('applies field selection', () => {
    const data = { id: 1, name: 'Alice', secret: 'x' };
    const result = SerializationService.optimizeResponse(data, {
      fields: ['id', 'name'],
      compress: false,
    });
    expect(result).toEqual({ id: 1, name: 'Alice' });
  });

  it('applies field exclusion', () => {
    const data = { id: 1, name: 'Alice', secret: 'x' };
    const result = SerializationService.optimizeResponse(data, {
      exclude: ['secret'],
      compress: false,
    });
    expect(result).toEqual({ id: 1, name: 'Alice' });
  });

  it('applies transform function', () => {
    const data = { id: 1, name: 'alice' };
    const result = SerializationService.optimizeResponse(data, {
      transform: d => ({ ...d, name: d.name.toUpperCase() }),
      compress: false,
    });
    expect(result.name).toBe('ALICE');
  });

  it('applies compression (removes undefined) by default', () => {
    const data = { a: 1, b: undefined };
    const result = SerializationService.optimizeResponse(data);
    expect(Object.keys(result)).not.toContain('b');
  });
});

// ─── ResponseCacheService ────────────────────────────────────────────────────

describe('ResponseCacheService.generateETag', () => {
  it('returns a quoted hex string', () => {
    const etag = ResponseCacheService.generateETag({ id: 1, name: 'test' });
    expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
  });

  it('produces same ETag for identical data', () => {
    const data = { id: 1, name: 'test' };
    expect(ResponseCacheService.generateETag(data)).toBe(ResponseCacheService.generateETag(data));
  });

  it('produces different ETags for different data', () => {
    const a = ResponseCacheService.generateETag({ id: 1 });
    const b = ResponseCacheService.generateETag({ id: 2 });
    expect(a).not.toBe(b);
  });
});

describe('ResponseCacheService.shouldCache', () => {
  function makeReq(method = 'GET') {
    return { method };
  }

  function makeRes({ statusCode = 200, cacheControl = null } = {}) {
    return {
      statusCode,
      getHeader: name => {
        if (name === 'Cache-Control') {
          return cacheControl;
        }
        return null;
      },
    };
  }

  it('returns true for GET with 200 and no Cache-Control', () => {
    expect(ResponseCacheService.shouldCache(makeReq('GET'), makeRes())).toBe(true);
  });

  it('returns true for HEAD with 200 and no Cache-Control', () => {
    expect(ResponseCacheService.shouldCache(makeReq('HEAD'), makeRes())).toBe(true);
  });

  it('returns false for POST requests', () => {
    expect(ResponseCacheService.shouldCache(makeReq('POST'), makeRes())).toBe(false);
  });

  it('returns false for PUT requests', () => {
    expect(ResponseCacheService.shouldCache(makeReq('PUT'), makeRes())).toBe(false);
  });

  it('returns false for DELETE requests', () => {
    expect(ResponseCacheService.shouldCache(makeReq('DELETE'), makeRes())).toBe(false);
  });

  it('returns false for 4xx responses', () => {
    expect(ResponseCacheService.shouldCache(makeReq('GET'), makeRes({ statusCode: 404 }))).toBe(false);
  });

  it('returns false for 5xx responses', () => {
    expect(ResponseCacheService.shouldCache(makeReq('GET'), makeRes({ statusCode: 500 }))).toBe(false);
  });

  it('returns false when Cache-Control header already set', () => {
    expect(ResponseCacheService.shouldCache(makeReq('GET'), makeRes({ cacheControl: 'no-store' }))).toBe(false);
  });
});

describe('ResponseCacheService.setCacheHeaders', () => {
  it('sets Cache-Control header with defaults', () => {
    const headers = {};
    const res = {
      setHeader: (name, value) => {
        headers[name] = value;
      },
    };
    ResponseCacheService.setCacheHeaders(res);
    expect(headers['Cache-Control']).toContain('public');
    expect(headers['Cache-Control']).toContain('max-age=300');
    expect(headers['Cache-Control']).toContain('stale-while-revalidate=60');
  });

  it('uses custom maxAge and staleWhileRevalidate', () => {
    const headers = {};
    const res = {
      setHeader: (name, value) => {
        headers[name] = value;
      },
    };
    ResponseCacheService.setCacheHeaders(res, { maxAge: 600, staleWhileRevalidate: 120 });
    expect(headers['Cache-Control']).toContain('max-age=600');
    expect(headers['Cache-Control']).toContain('stale-while-revalidate=120');
  });

  it('sets ETag header when provided', () => {
    const headers = {};
    const res = {
      setHeader: (name, value) => {
        headers[name] = value;
      },
    };
    ResponseCacheService.setCacheHeaders(res, { etag: '"abc123"' });
    expect(headers['ETag']).toBe('"abc123"');
  });

  it('does not set ETag header when not provided', () => {
    const headers = {};
    const res = {
      setHeader: (name, value) => {
        headers[name] = value;
      },
    };
    ResponseCacheService.setCacheHeaders(res);
    expect(headers['ETag']).toBeUndefined();
  });
});

// ─── getPerformanceMetrics ───────────────────────────────────────────────────

describe('getPerformanceMetrics', () => {
  it('returns an object with expected shape', () => {
    const metrics = getPerformanceMetrics();
    expect(metrics).toHaveProperty('compressionRatio');
    expect(metrics).toHaveProperty('responseSize');
    expect(metrics).toHaveProperty('serializationTime');
    expect(metrics).toHaveProperty('cacheHitRate');
    expect(metrics).toHaveProperty('totalRequests');
  });

  it('cacheHitRate is a number between 0 and 1', () => {
    const metrics = getPerformanceMetrics();
    expect(typeof metrics.cacheHitRate).toBe('number');
    expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
    expect(metrics.cacheHitRate).toBeLessThanOrEqual(1);
  });

  it('totalRequests is a non-negative number', () => {
    const metrics = getPerformanceMetrics();
    expect(typeof metrics.totalRequests).toBe('number');
    expect(metrics.totalRequests).toBeGreaterThanOrEqual(0);
  });

  it('compressionRatio is a plain object (not a Map)', () => {
    const metrics = getPerformanceMetrics();
    expect(metrics.compressionRatio).not.toBeInstanceOf(Map);
    expect(typeof metrics.compressionRatio).toBe('object');
  });
});
