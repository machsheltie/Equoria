/**
 * Performance — Pagination Boundary Behavior Tests
 *
 * Tests parsePaginationParams and buildPaginatedResponse from paginationHelper.mjs.
 * Uses the real implementation with mock Express request/response objects — no
 * mocks of the pagination module itself. Verifies that:
 * - Default page/limit values apply when query params are absent
 * - Limit is capped at maxLimit to prevent over-fetching
 * - Invalid page/limit values fall back to defaults
 * - buildPaginatedResponse produces correct pagination metadata
 * - Edge cases: empty result set, single page, last page
 */

import { describe, it, expect } from '@jest/globals';
import { parsePaginationParams, buildPaginationMetadata, PAGINATION_DEFAULTS } from '../../utils/paginationHelper.mjs';

/**
 * Build a minimal mock Express request with the given query params.
 */
function makeReq(query = {}) {
  return { query, method: 'GET' };
}

describe('Pagination — parsePaginationParams', () => {
  it('applies defaults when no query params are provided', () => {
    const { page, limit, skip } = parsePaginationParams(makeReq());
    expect(page).toBe(PAGINATION_DEFAULTS.defaultPage);
    expect(limit).toBe(PAGINATION_DEFAULTS.defaultLimit);
    expect(skip).toBe(0);
  });

  it('parses explicit page and limit from query', () => {
    const { page, limit, skip } = parsePaginationParams(makeReq({ page: '3', limit: '10' }));
    expect(page).toBe(3);
    expect(limit).toBe(10);
    expect(skip).toBe(20); // (3-1) * 10
  });

  it('caps limit at maxLimit', () => {
    const { limit } = parsePaginationParams(makeReq({ limit: '9999' }));
    expect(limit).toBe(PAGINATION_DEFAULTS.maxLimit);
  });

  it('falls back to defaultLimit when limit is invalid (zero)', () => {
    const { limit } = parsePaginationParams(makeReq({ limit: '0' }));
    expect(limit).toBe(PAGINATION_DEFAULTS.defaultLimit);
  });

  it('falls back to defaultPage when page is negative', () => {
    const { page } = parsePaginationParams(makeReq({ page: '-5' }));
    expect(page).toBe(PAGINATION_DEFAULTS.defaultPage);
  });

  it('falls back to defaults when values are non-numeric strings', () => {
    const { page, limit } = parsePaginationParams(makeReq({ page: 'abc', limit: 'xyz' }));
    expect(page).toBe(PAGINATION_DEFAULTS.defaultPage);
    expect(limit).toBe(PAGINATION_DEFAULTS.defaultLimit);
  });

  it('respects custom defaultLimit and maxLimit options', () => {
    const { limit } = parsePaginationParams(makeReq({ limit: '500' }), {
      defaultLimit: 5,
      maxLimit: 50,
    });
    expect(limit).toBe(50); // capped at custom maxLimit
  });

  it('calculates skip correctly for page 1', () => {
    const { skip } = parsePaginationParams(makeReq({ page: '1', limit: '20' }));
    expect(skip).toBe(0);
  });

  it('calculates skip correctly for page 5 with limit 10', () => {
    const { skip } = parsePaginationParams(makeReq({ page: '5', limit: '10' }));
    expect(skip).toBe(40); // (5-1) * 10
  });
});

describe('Pagination — buildPaginationMetadata', () => {
  it('returns correct metadata for a middle page', () => {
    const meta = buildPaginationMetadata(3, 10, 100);
    expect(meta.currentPage).toBe(3);
    expect(meta.pageSize).toBe(10);
    expect(meta.totalRecords).toBe(100);
    expect(meta.totalPages).toBe(10);
    expect(meta.hasNextPage).toBe(true);
    expect(meta.hasPrevPage).toBe(true);
    expect(meta.nextPage).toBe(4);
    expect(meta.prevPage).toBe(2);
  });

  it('indicates no previous page on page 1', () => {
    const meta = buildPaginationMetadata(1, 20, 60);
    expect(meta.hasPrevPage).toBe(false);
    expect(meta.prevPage).toBeNull();
    expect(meta.hasNextPage).toBe(true);
  });

  it('indicates no next page on the last page', () => {
    const meta = buildPaginationMetadata(3, 20, 60);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.nextPage).toBeNull();
    expect(meta.hasPrevPage).toBe(true);
  });

  it('handles empty result set (total = 0)', () => {
    const meta = buildPaginationMetadata(1, 20, 0);
    expect(meta.totalRecords).toBe(0);
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPrevPage).toBe(false);
    expect(meta.startRecord).toBe(0);
    expect(meta.endRecord).toBe(0);
  });

  it('calculates startRecord and endRecord correctly', () => {
    const meta = buildPaginationMetadata(2, 10, 25);
    expect(meta.startRecord).toBe(11); // (2-1)*10 + 1
    expect(meta.endRecord).toBe(20); // min(2*10, 25)
  });

  it('endRecord does not exceed total on the final partial page', () => {
    const meta = buildPaginationMetadata(3, 10, 25);
    expect(meta.startRecord).toBe(21);
    expect(meta.endRecord).toBe(25); // min(30, 25)
  });
});
