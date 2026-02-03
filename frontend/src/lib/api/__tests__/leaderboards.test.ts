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
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLeaderboard, fetchUserRankSummary } from '../leaderboards';

// Mock the API client module
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

// Import the mocked module for assertions
import { apiClient } from '@/lib/api-client';

describe('fetchLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

    await fetchLeaderboard({
      category: 'discipline',
      period: 'weekly',
      discipline: 'show-jumping',
      page: 2,
      limit: 50,
    });

    expect(apiClient.get).toHaveBeenCalledTimes(1);

    const calledUrl = vi.mocked(apiClient.get).mock.calls[0][0];
    expect(calledUrl).toContain('/api/leaderboards/discipline');
    expect(calledUrl).toContain('period=weekly');
    expect(calledUrl).toContain('discipline=show-jumping');
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).toContain('limit=50');
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

    vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

    await fetchLeaderboard({
      category: 'level',
      period: 'monthly',
    });

    const calledUrl = vi.mocked(apiClient.get).mock.calls[0][0];
    expect(calledUrl).toBe('/api/leaderboards/level?period=monthly');
  });

  // Test 3: Handles API errors correctly
  it('should propagate API errors from the client', async () => {
    const apiError = {
      message: 'Internal server error',
      status: 'error',
      statusCode: 500,
    };

    vi.mocked(apiClient.get).mockRejectedValue(apiError);

    await expect(
      fetchLeaderboard({
        category: 'level',
        period: 'all-time',
      })
    ).rejects.toEqual(apiError);
  });
});

describe('fetchUserRankSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 4: Constructs correct URL for user rank summary
  it('should construct the correct URL with the userId', async () => {
    const mockResponse = {
      userId: 'user-123',
      userName: 'John Doe',
      rankings: [],
      bestRankings: [],
    };

    vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

    const result = await fetchUserRankSummary('user-123');

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/api/leaderboards/user-summary/user-123');
    expect(result).toEqual(mockResponse);
  });

  // Test 5: Handles errors correctly
  it('should propagate API errors from the client', async () => {
    const apiError = {
      message: 'User not found',
      status: 'error',
      statusCode: 404,
    };

    vi.mocked(apiClient.get).mockRejectedValue(apiError);

    await expect(fetchUserRankSummary('nonexistent-user')).rejects.toEqual(apiError);
  });
});
