/**
 * paginationHelper — unit tests (Equoria-rr7)
 *
 * Pure function tests: no DB, no mocks of application code.
 */

import { describe, it, expect } from '@jest/globals';
import {
  PAGINATION_DEFAULTS,
  parsePaginationParams,
  buildPaginationMetadata,
  validatePaginationParams,
  calculateTotalPages,
  getCursorPaginationParams,
  buildCursorPaginationMetadata,
  getPrismaQueryParams,
  paginationMiddleware,
  buildPaginatedResponse,
  buildCursorPaginatedResponse,
} from '../utils/paginationHelper.mjs';

// Minimal fake req builder
const makeReq = (query = {}) => ({ method: 'GET', query });

// ---------------------------------------------------------------------------
// PAGINATION_DEFAULTS
// ---------------------------------------------------------------------------
describe('PAGINATION_DEFAULTS', () => {
  it('exports expected default values', () => {
    expect(PAGINATION_DEFAULTS.defaultPage).toBe(1);
    expect(PAGINATION_DEFAULTS.defaultLimit).toBe(20);
    expect(PAGINATION_DEFAULTS.maxLimit).toBe(100);
    expect(PAGINATION_DEFAULTS.minLimit).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// parsePaginationParams
// ---------------------------------------------------------------------------
describe('parsePaginationParams', () => {
  it('returns defaults when no query params', () => {
    const result = parsePaginationParams(makeReq());
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.skip).toBe(0);
    expect(result.offset).toBe(0);
  });

  it('parses valid page and limit', () => {
    const result = parsePaginationParams(makeReq({ page: '3', limit: '50' }));
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
    expect(result.skip).toBe(100);
  });

  it('falls back to default on invalid page string', () => {
    const result = parsePaginationParams(makeReq({ page: 'abc' }));
    expect(result.page).toBe(1);
  });

  it('falls back to default on page < 1', () => {
    const result = parsePaginationParams(makeReq({ page: '0' }));
    expect(result.page).toBe(1);
  });

  it('falls back to default on invalid limit string', () => {
    const result = parsePaginationParams(makeReq({ limit: 'bad' }));
    expect(result.limit).toBe(20);
  });

  it('caps limit at maxLimit', () => {
    const result = parsePaginationParams(makeReq({ limit: '500' }));
    expect(result.limit).toBe(100);
  });

  it('respects custom maxLimit option', () => {
    const result = parsePaginationParams(makeReq({ limit: '200' }), { maxLimit: 150 });
    expect(result.limit).toBe(150);
  });

  it('respects custom defaultLimit option', () => {
    const result = parsePaginationParams(makeReq(), { defaultLimit: 50 });
    expect(result.limit).toBe(50);
  });

  it('calculates skip correctly for page 2', () => {
    const result = parsePaginationParams(makeReq({ page: '2', limit: '25' }));
    expect(result.skip).toBe(25);
    expect(result.offset).toBe(25);
  });

  it('offset is alias for skip', () => {
    const result = parsePaginationParams(makeReq({ page: '4', limit: '10' }));
    expect(result.skip).toBe(result.offset);
  });
});

// ---------------------------------------------------------------------------
// buildPaginationMetadata
// ---------------------------------------------------------------------------
describe('buildPaginationMetadata', () => {
  it('builds correct metadata for first page', () => {
    const meta = buildPaginationMetadata(1, 20, 100);
    expect(meta.currentPage).toBe(1);
    expect(meta.pageSize).toBe(20);
    expect(meta.totalRecords).toBe(100);
    expect(meta.totalPages).toBe(5);
    expect(meta.hasNextPage).toBe(true);
    expect(meta.hasPrevPage).toBe(false);
    expect(meta.nextPage).toBe(2);
    expect(meta.prevPage).toBeNull();
    expect(meta.startRecord).toBe(1);
    expect(meta.endRecord).toBe(20);
  });

  it('builds correct metadata for last page', () => {
    const meta = buildPaginationMetadata(5, 20, 100);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPrevPage).toBe(true);
    expect(meta.nextPage).toBeNull();
    expect(meta.prevPage).toBe(4);
    expect(meta.startRecord).toBe(81);
    expect(meta.endRecord).toBe(100);
  });

  it('handles empty result set', () => {
    const meta = buildPaginationMetadata(1, 20, 0);
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.startRecord).toBe(0);
    expect(meta.endRecord).toBe(0);
  });

  it('handles partial last page', () => {
    const meta = buildPaginationMetadata(2, 20, 35);
    expect(meta.totalPages).toBe(2);
    expect(meta.endRecord).toBe(35);
  });

  it('single page result', () => {
    const meta = buildPaginationMetadata(1, 20, 5);
    expect(meta.totalPages).toBe(1);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPrevPage).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePaginationParams
// ---------------------------------------------------------------------------
describe('validatePaginationParams', () => {
  it('does not throw for valid inputs', () => {
    expect(() => validatePaginationParams(1, 20)).not.toThrow();
    expect(() => validatePaginationParams(5, 100)).not.toThrow();
  });

  it('throws for page < 1', () => {
    expect(() => validatePaginationParams(0, 20)).toThrow('Invalid page number');
  });

  it('throws for non-integer page', () => {
    expect(() => validatePaginationParams(1.5, 20)).toThrow('Invalid page number');
  });

  it('throws for limit < minLimit', () => {
    expect(() => validatePaginationParams(1, 0)).toThrow('Invalid limit');
  });

  it('throws for limit > maxLimit', () => {
    expect(() => validatePaginationParams(1, 200)).toThrow('Invalid limit');
  });

  it('respects custom maxLimit option', () => {
    expect(() => validatePaginationParams(1, 150, { maxLimit: 200 })).not.toThrow();
    expect(() => validatePaginationParams(1, 201, { maxLimit: 200 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// calculateTotalPages
// ---------------------------------------------------------------------------
describe('calculateTotalPages', () => {
  it('returns 0 for empty result', () => {
    expect(calculateTotalPages(0, 20)).toBe(0);
  });

  it('rounds up for partial page', () => {
    expect(calculateTotalPages(21, 20)).toBe(2);
  });

  it('exact division', () => {
    expect(calculateTotalPages(100, 20)).toBe(5);
  });

  it('single record', () => {
    expect(calculateTotalPages(1, 20)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getCursorPaginationParams
// ---------------------------------------------------------------------------
describe('getCursorPaginationParams', () => {
  it('returns defaults for empty query', () => {
    const result = getCursorPaginationParams(makeReq());
    expect(result.limit).toBe(20);
    expect(result.cursor).toBeNull();
    expect(result.direction).toBe('next');
    expect(result.cursorField).toBe('id');
  });

  it('parses cursor and direction', () => {
    const result = getCursorPaginationParams(makeReq({ cursor: 'abc123', direction: 'prev' }));
    expect(result.cursor).toBe('abc123');
    expect(result.direction).toBe('prev');
  });

  it('caps limit at maxLimit', () => {
    const result = getCursorPaginationParams(makeReq({ limit: '999' }));
    expect(result.limit).toBe(100);
  });

  it('defaults non-prev direction to next', () => {
    const result = getCursorPaginationParams(makeReq({ direction: 'sideways' }));
    expect(result.direction).toBe('next');
  });

  it('respects custom cursorField', () => {
    const result = getCursorPaginationParams(makeReq(), { cursorField: 'createdAt' });
    expect(result.cursorField).toBe('createdAt');
  });
});

// ---------------------------------------------------------------------------
// buildCursorPaginationMetadata
// ---------------------------------------------------------------------------
describe('buildCursorPaginationMetadata', () => {
  const makeItems = n => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

  it('full page — hasNextPage true, correct nextCursor', () => {
    const data = makeItems(20);
    const meta = buildCursorPaginationMetadata(data, 20);
    expect(meta.hasNextPage).toBe(true);
    expect(meta.nextCursor).toBe(20);
    expect(meta.pageSize).toBe(20);
    expect(meta.recordCount).toBe(20);
  });

  it('partial page — hasNextPage false', () => {
    const data = makeItems(5);
    const meta = buildCursorPaginationMetadata(data, 20);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.nextCursor).toBeNull();
  });

  it('empty data', () => {
    const meta = buildCursorPaginationMetadata([], 20);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.nextCursor).toBeNull();
    expect(meta.recordCount).toBe(0);
  });

  it('uses custom cursorField', () => {
    const data = [{ uuid: 'aaa' }, { uuid: 'bbb' }];
    const meta = buildCursorPaginationMetadata(data, 2, 'uuid');
    expect(meta.nextCursor).toBe('bbb');
    expect(meta.cursorField).toBe('uuid');
  });
});

// ---------------------------------------------------------------------------
// getPrismaQueryParams
// ---------------------------------------------------------------------------
describe('getPrismaQueryParams', () => {
  it('maps skip and limit to skip and take', () => {
    const result = getPrismaQueryParams({ skip: 40, limit: 20, page: 3 });
    expect(result.skip).toBe(40);
    expect(result.take).toBe(20);
  });

  it('skip 0 for page 1', () => {
    const result = getPrismaQueryParams({ skip: 0, limit: 10, page: 1 });
    expect(result.skip).toBe(0);
    expect(result.take).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// paginationMiddleware
// ---------------------------------------------------------------------------
describe('paginationMiddleware', () => {
  it('attaches req.pagination on GET request', () => {
    const middleware = paginationMiddleware();
    const req = { method: 'GET', query: { page: '2', limit: '10' } };
    const next = { called: false };
    middleware(req, {}, () => {
      next.called = true;
    });
    expect(next.called).toBe(true);
    expect(req.pagination.page).toBe(2);
    expect(req.pagination.limit).toBe(10);
  });

  it('does not attach req.pagination on POST request', () => {
    const middleware = paginationMiddleware();
    const req = { method: 'POST', query: {} };
    middleware(req, {}, () => {});
    expect(req.pagination).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildPaginatedResponse — lines 148-152
// ---------------------------------------------------------------------------
describe('buildPaginatedResponse', () => {
  const makeRes = () => ({
    status: code => ({ json: body => ({ statusCode: code, ...body }) }),
  });

  it('returns 200 response with success, data, pagination, meta (lines 148-152)', () => {
    const res = makeRes();
    const data = [{ id: 1 }, { id: 2 }];
    const result = buildPaginatedResponse(res, data, { page: 1, limit: 20, total: 2 });
    expect(result.statusCode).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data).toBe(data);
    expect(result.pagination).toBeDefined();
    expect(typeof result.meta.timestamp).toBe('string');
  });

  it('spreads additionalMeta into response meta object', () => {
    const res = makeRes();
    const result = buildPaginatedResponse(res, [], { page: 1, limit: 10, total: 0 }, { cached: true });
    expect(result.meta.cached).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildCursorPaginatedResponse — lines 289-291
// ---------------------------------------------------------------------------
describe('buildCursorPaginatedResponse', () => {
  const makeRes = () => ({
    status: code => ({ json: body => ({ statusCode: code, ...body }) }),
  });

  it('returns 200 cursor-paginated response (lines 289-291)', () => {
    const res = makeRes();
    const data = [{ id: 1 }, { id: 2 }];
    const result = buildCursorPaginatedResponse(res, data, 20);
    expect(result.statusCode).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data).toBe(data);
    expect(result.pagination).toBeDefined();
    expect(typeof result.meta.timestamp).toBe('string');
  });

  it('uses custom cursorField and merges additionalMeta', () => {
    const res = makeRes();
    const data = [{ uuid: 'aaa' }, { uuid: 'bbb' }];
    const result = buildCursorPaginatedResponse(res, data, 2, 'uuid', { source: 'db' });
    expect(result.pagination.cursorField).toBe('uuid');
    expect(result.meta.source).toBe('db');
  });
});
