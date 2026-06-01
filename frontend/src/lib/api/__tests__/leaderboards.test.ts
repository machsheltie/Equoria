/**
 * Tests for Leaderboards API Functions
 *
 * Leaderboard System - Task 5: API layer tests
 *
 * Tests for the leaderboard API functions:
 * - fetchLeaderboard URL construction and query params
 * - fetchLeaderboard error handling
 * - fetchUserRankSummary URL construction
 * - fetchUserRankSummary error handling
 * - Query parameter encoding for special characters
 *
 * Story 5-5: Leaderboards - Task 5
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (Equoria-f12xy) instead of vi.mock'ing the api-client. This exercises the
 * REAL api-client (request building, `{ success, data }` unwrap, error
 * construction) end-to-end. The previous `apiClient.get` mock-call
 * assertions (`mock.calls[0][0]`, `toHaveBeenCalledWith`) are reframed as
 * MSW request inspection — the path + query string the functions build land
 * on the wire and are captured there, proving the same URL construction.
 *
 * Error reframe: the real client throws `{ message, status, statusCode }`
 * where `statusCode` is derived from the HTTP response status (not echoed
 * from the body). The old tests asserted `.rejects.toEqual(apiError)` against
 * a hand-built object; the equivalent real-client assertion is
 * `.rejects.toMatchObject({ message, statusCode })`.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { fetchLeaderboard, fetchUserRankSummary } from '../leaderboards';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

describe('fetchLeaderboard', () => {
  // Test 1: Constructs correct URL with all parameters
  it('should construct the correct URL with category, period, discipline, page, and limit', async () => {
    const mockResponse = {
      category: 'discipline',
      period: 'weekly',
      totalEntries: 500,
      currentPage: 2,
      totalPages: 10,
      entries: [],
      lastUpdated: '2026-02-03T10:00:00Z',
    };

    let capturedPath = '';
    let capturedQuery: URLSearchParams | undefined;
    server.use(
      http.get(`${base}/api/v1/leaderboards/discipline`, ({ request }) => {
        const url = new URL(request.url);
        capturedPath = url.pathname;
        capturedQuery = url.searchParams;
        return HttpResponse.json({ data: mockResponse });
      })
    );

    await fetchLeaderboard({
      category: 'discipline',
      period: 'weekly',
      discipline: 'show-jumping',
      page: 2,
      limit: 50,
    });

    expect(capturedPath).toBe('/api/v1/leaderboards/discipline');
    expect(capturedQuery?.get('period')).toBe('weekly');
    expect(capturedQuery?.get('discipline')).toBe('show-jumping');
    expect(capturedQuery?.get('page')).toBe('2');
    expect(capturedQuery?.get('limit')).toBe('50');
  });

  // Test 2: Constructs URL without optional parameters
  it('should construct URL with only required parameters when optionals are omitted', async () => {
    const mockResponse = {
      category: 'level',
      period: 'monthly',
      totalEntries: 1254,
      currentPage: 1,
      totalPages: 26,
      entries: [],
      lastUpdated: '2026-02-03T10:00:00Z',
    };

    let capturedSearch = '';
    let capturedPath = '';
    server.use(
      http.get(`${base}/api/v1/leaderboards/level`, ({ request }) => {
        const url = new URL(request.url);
        capturedPath = url.pathname;
        capturedSearch = url.search;
        return HttpResponse.json({ data: mockResponse });
      })
    );

    await fetchLeaderboard({
      category: 'level',
      period: 'monthly',
    });

    // Was: expect(calledUrl).toBe('/api/v1/leaderboards/level?period=monthly')
    expect(capturedPath).toBe('/api/v1/leaderboards/level');
    expect(capturedSearch).toBe('?period=monthly');
  });

  // Test 3: Handles API errors correctly
  it('should propagate API errors from the client', async () => {
    server.use(
      http.get(`${base}/api/v1/leaderboards/level`, () =>
        HttpResponse.json({ message: 'Internal server error', status: 'error' }, { status: 500 })
      )
    );

    await expect(
      fetchLeaderboard({
        category: 'level',
        period: 'all-time',
      })
    ).rejects.toMatchObject({
      message: 'Internal server error',
      statusCode: 500,
    });
  });
});

describe('fetchUserRankSummary', () => {
  // Test 4: Constructs correct URL for user rank summary
  it('should construct the correct URL with the userId', async () => {
    const mockResponse = {
      userId: 'user-123',
      userName: 'John Doe',
      rankings: [],
      bestRankings: [],
    };

    let capturedPath = '';
    server.use(
      http.get(`${base}/api/v1/leaderboards/user-summary/user-123`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json({ data: mockResponse });
      })
    );

    const result = await fetchUserRankSummary('user-123');

    expect(capturedPath).toBe('/api/v1/leaderboards/user-summary/user-123');
    expect(result).toEqual(mockResponse);
  });

  // Test 5: Handles errors correctly
  it('should propagate API errors from the client', async () => {
    server.use(
      http.get(`${base}/api/v1/leaderboards/user-summary/nonexistent-user`, () =>
        HttpResponse.json({ message: 'User not found', status: 'error' }, { status: 404 })
      )
    );

    await expect(fetchUserRankSummary('nonexistent-user')).rejects.toMatchObject({
      message: 'User not found',
      statusCode: 404,
    });
  });
});
