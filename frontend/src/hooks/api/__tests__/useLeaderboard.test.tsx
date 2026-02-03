/**
 * Tests for useLeaderboard Hook
 *
 * Leaderboard System - Task 5: useLeaderboard hook tests
 *
 * Tests for fetching leaderboard data by category and period:
 * - Successful data fetch
 * - Loading state
 * - Error state
 * - Query key construction
 * - Cache settings (staleTime 5min, gcTime 10min)
 * - Enabled flag (should not fetch when false)
 * - Refetch function
 * - Different parameters (category, period, page)
 * - Discipline parameter for discipline category
 * - Pagination
 * - Default parameter values
 * - Different categories produce different query keys
 *
 * Story 5-5: Leaderboards - Task 5
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as leaderboardsApi from '@/lib/api/leaderboards';
import { useLeaderboard, leaderboardQueryKeys } from '../useLeaderboard';
import type { LeaderboardResponse } from '@/lib/api/leaderboards';
import type { LeaderboardEntryData } from '@/components/leaderboard/LeaderboardEntry';

// Mock API functions
vi.mock('@/lib/api/leaderboards', async () => {
  const actual = await vi.importActual('@/lib/api/leaderboards');
  return {
    ...actual,
    fetchLeaderboard: vi.fn(),
  };
});

const mockEntries: LeaderboardEntryData[] = [
  {
    rank: 1,
    horseId: 101,
    horseName: 'Thunder Strike',
    ownerId: 'user-456',
    ownerName: 'Jane Smith',
    primaryStat: 20,
    secondaryStats: {
      totalCompetitions: 48,
      wins: 12,
      winRate: 25,
    },
    isCurrentUser: false,
    rankChange: 2,
  },
  {
    rank: 2,
    horseId: 102,
    horseName: 'Midnight Dream',
    ownerId: 'user-789',
    ownerName: 'Bob Wilson',
    primaryStat: 18,
    secondaryStats: {
      totalCompetitions: 35,
      wins: 8,
      winRate: 22.8,
    },
    isCurrentUser: false,
    rankChange: -1,
  },
];

const mockLeaderboardResponse: LeaderboardResponse = {
  category: 'level',
  period: 'monthly',
  totalEntries: 1254,
  currentPage: 1,
  totalPages: 26,
  entries: mockEntries,
  userRank: {
    rank: 42,
    entry: {
      rank: 42,
      horseId: 200,
      horseName: 'My Horse',
      ownerId: 'user-123',
      ownerName: 'John Doe',
      primaryStat: 15,
      secondaryStats: {
        totalCompetitions: 20,
        wins: 5,
        winRate: 25,
      },
      isCurrentUser: true,
      rankChange: 5,
    },
  },
  lastUpdated: '2026-02-03T10:30:00Z',
};

const createWrapper = (queryClient?: QueryClient) => {
  const client =
    queryClient ||
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Fetches leaderboard data successfully
  it('should fetch leaderboard data when valid parameters are provided', async () => {
    vi.mocked(leaderboardsApi.fetchLeaderboard).mockResolvedValue(mockLeaderboardResponse);

    const { result } = renderHook(
      () =>
        useLeaderboard({
          category: 'level',
          period: 'monthly',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(leaderboardsApi.fetchLeaderboard).toHaveBeenCalledTimes(1);
    expect(leaderboardsApi.fetchLeaderboard).toHaveBeenCalledWith({
      category: 'level',
      period: 'monthly',
      discipline: undefined,
      page: 1,
      limit: 50,
    });
    expect(result.current.data).toEqual(mockLeaderboardResponse);
  });

  // Test 2: Returns loading state initially
  it('should return loading state while fetching', () => {
    vi.mocked(leaderboardsApi.fetchLeaderboard).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    );

    const { result } = renderHook(
      () =>
        useLeaderboard({
          category: 'level',
          period: 'monthly',
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  // Test 3: Handles API errors correctly
  it('should handle API errors and expose the error object', async () => {
    const mockError = {
      message: 'Server error',
      status: 500,
      code: 'INTERNAL_ERROR',
    };

    vi.mocked(leaderboardsApi.fetchLeaderboard).mockRejectedValue(mockError);

    const { result } = renderHook(
      () =>
        useLeaderboard({
          category: 'level',
          period: 'all-time',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
    expect(result.current.data).toBeUndefined();
  });

  // Test 4: Uses correct query key with all parameters
  it('should use a query key that includes category, period, discipline, page, and limit', async () => {
    vi.mocked(leaderboardsApi.fetchLeaderboard).mockResolvedValue(mockLeaderboardResponse);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    const { result } = renderHook(
      () =>
        useLeaderboard({
          category: 'discipline',
          period: 'weekly',
          discipline: 'dressage',
          page: 3,
          limit: 25,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const expectedKey = leaderboardQueryKeys.list('discipline', 'weekly', 'dressage', 3, 25);
    expect(expectedKey).toEqual(['leaderboards', 'discipline', 'weekly', 'dressage', 3, 25]);

    const cachedData = queryClient.getQueryData(expectedKey);
    expect(cachedData).toEqual(mockLeaderboardResponse);
  });

  // Test 5: Respects staleTime (5 minutes) - data not refetched within window
  it('should use 5 minute staleTime to prevent unnecessary refetches', async () => {
    vi.mocked(leaderboardsApi.fetchLeaderboard).mockResolvedValue(mockLeaderboardResponse);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // First render - should fetch
    const { result, unmount } = renderHook(
      () =>
        useLeaderboard({
          category: 'level',
          period: 'monthly',
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(leaderboardsApi.fetchLeaderboard).toHaveBeenCalledTimes(1);

    // Unmount and remount - should NOT refetch due to staleTime
    unmount();

    const { result: result2 } = renderHook(
      () =>
        useLeaderboard({
          category: 'level',
          period: 'monthly',
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    expect(result2.current.data).toEqual(mockLeaderboardResponse);

    // Should still only be 1 call
    expect(leaderboardsApi.fetchLeaderboard).toHaveBeenCalledTimes(1);
  });

  // Test 6: Respects gcTime (10 minutes) - cache entry exists after fetch
  it('should use 10 minute gcTime for cache retention', async () => {
    vi.mocked(leaderboardsApi.fetchLeaderboard).mockResolvedValue(mockLeaderboardResponse);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const { result } = renderHook(
      () =>
        useLeaderboard({
          category: 'level',
          period: 'monthly',
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify cache exists after successful fetch
    const cacheEntry = queryClient.getQueryCache().find({
      queryKey: leaderboardQueryKeys.list('level', 'monthly', undefined, 1, 50),
    });
    expect(cacheEntry).toBeDefined();
    expect(cacheEntry?.state.data).toEqual(mockLeaderboardResponse);
  });

  // Test 7: Enabled flag prevents fetching when false
  it('should not fetch when enabled is false', () => {
    vi.mocked(leaderboardsApi.fetchLeaderboard).mockResolvedValue(mockLeaderboardResponse);

    const { result } = renderHook(
      () =>
        useLeaderboard({
          category: 'level',
          period: 'monthly',
          enabled: false,
        }),
      { wrapper: createWrapper() }
    );

    expect(leaderboardsApi.fetchLeaderboard).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  // Test 8: Refetch function works
  it('should expose a refetch function that re-fetches data', async () => {
    const firstResponse = { ...mockLeaderboardResponse, totalEntries: 1254 };
    const secondResponse = { ...mockLeaderboardResponse, totalEntries: 1260 };

    vi.mocked(leaderboardsApi.fetchLeaderboard)
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
      },
    });

    const { result } = renderHook(
      () =>
        useLeaderboard({
          category: 'level',
          period: 'monthly',
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalEntries).toBe(1254);

    // Refetch
    await result.current.refetch();

    await waitFor(() => expect(result.current.data?.totalEntries).toBe(1260));
    expect(leaderboardsApi.fetchLeaderboard).toHaveBeenCalledTimes(2);
  });

  // Test 9: Discipline parameter is passed for discipline category
  it('should pass discipline parameter when category is discipline', async () => {
    const disciplineResponse: LeaderboardResponse = {
      ...mockLeaderboardResponse,
      category: 'discipline',
      period: 'weekly',
    };

    vi.mocked(leaderboardsApi.fetchLeaderboard).mockResolvedValue(disciplineResponse);

    const { result } = renderHook(
      () =>
        useLeaderboard({
          category: 'discipline',
          period: 'weekly',
          discipline: 'show-jumping',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(leaderboardsApi.fetchLeaderboard).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'discipline',
        discipline: 'show-jumping',
      })
    );
  });

  // Test 10: Pagination with different page numbers
  it('should fetch correct page when page parameter changes', async () => {
    const page2Response: LeaderboardResponse = {
      ...mockLeaderboardResponse,
      currentPage: 2,
    };

    vi.mocked(leaderboardsApi.fetchLeaderboard).mockResolvedValue(page2Response);

    const { result } = renderHook(
      () =>
        useLeaderboard({
          category: 'prize-money',
          period: 'all-time',
          page: 2,
          limit: 100,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(leaderboardsApi.fetchLeaderboard).toHaveBeenCalledWith({
      category: 'prize-money',
      period: 'all-time',
      discipline: undefined,
      page: 2,
      limit: 100,
    });
  });

  // Test 11: Default parameter values (page=1, limit=50)
  it('should use default page=1 and limit=50 when not specified', async () => {
    vi.mocked(leaderboardsApi.fetchLeaderboard).mockResolvedValue(mockLeaderboardResponse);

    const { result } = renderHook(
      () =>
        useLeaderboard({
          category: 'win-rate',
          period: 'daily',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(leaderboardsApi.fetchLeaderboard).toHaveBeenCalledWith({
      category: 'win-rate',
      period: 'daily',
      discipline: undefined,
      page: 1,
      limit: 50,
    });
  });

  // Test 12: Different categories produce different query keys and cache separately
  it('should cache different categories separately with unique query keys', async () => {
    const levelResponse: LeaderboardResponse = {
      ...mockLeaderboardResponse,
      category: 'level',
    };
    const prizeResponse: LeaderboardResponse = {
      ...mockLeaderboardResponse,
      category: 'prize-money',
      totalEntries: 800,
    };

    vi.mocked(leaderboardsApi.fetchLeaderboard)
      .mockResolvedValueOnce(levelResponse)
      .mockResolvedValueOnce(prizeResponse);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    // Fetch level leaderboard
    const { result: levelResult } = renderHook(
      () =>
        useLeaderboard({
          category: 'level',
          period: 'monthly',
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(levelResult.current.isSuccess).toBe(true));

    // Fetch prize-money leaderboard
    const { result: prizeResult } = renderHook(
      () =>
        useLeaderboard({
          category: 'prize-money',
          period: 'monthly',
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(prizeResult.current.isSuccess).toBe(true));

    // Both should be cached separately
    const levelKey = leaderboardQueryKeys.list('level', 'monthly', undefined, 1, 50);
    const prizeKey = leaderboardQueryKeys.list('prize-money', 'monthly', undefined, 1, 50);

    expect(levelKey).not.toEqual(prizeKey);
    expect(queryClient.getQueryData(levelKey)).toEqual(levelResponse);
    expect(queryClient.getQueryData(prizeKey)).toEqual(prizeResponse);
  });
});

describe('leaderboardQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(leaderboardQueryKeys).toBeDefined();
    expect(leaderboardQueryKeys.all).toEqual(['leaderboards']);
    expect(leaderboardQueryKeys.list('level', 'monthly')).toEqual([
      'leaderboards',
      'level',
      'monthly',
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('should create unique keys for different parameters', () => {
    const key1 = leaderboardQueryKeys.list('level', 'monthly', undefined, 1, 50);
    const key2 = leaderboardQueryKeys.list('prize-money', 'monthly', undefined, 1, 50);
    const key3 = leaderboardQueryKeys.list('level', 'weekly', undefined, 1, 50);

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
  });
});
