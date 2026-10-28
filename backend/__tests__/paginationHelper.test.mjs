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
  buildPaginatedResponse,
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
