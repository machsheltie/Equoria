/**
 * Tests for useUserCompetitionStats Hook
 *
 * Competition Results System - Task: useUserCompetitionStats hook tests
 *
 * Tests for fetching user-wide competition statistics:
 * - Basic fetching with user ID
 * - Loading states
 * - Aggregated statistics
 * - Error handling
 * - Disabled state when ID is null
 * - Query key management
 * - Cache behavior (2 minute staleTime for frequent updates)
 * - Recent competitions included
 * - Zero stats for new users
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as competitionResultsApi from '@/lib/api/competitionResults';
import {
  useUserCompetitionStats,
  userCompetitionStatsQueryKeys,
} from '../useUserCompetitionStats';
import type { UserCompetitionStats } from '@/lib/api/competitionResults';

// Mock API functions
vi.mock('@/lib/api/competitionResults', async () => {
  const actual = await vi.importActual('@/lib/api/competitionResults');
  return {
    ...actual,
    fetchUserCompetitionStats: vi.fn(),
  };
});

const mockUserStats: UserCompetitionStats = {
  userId: 'user-1',
  totalCompetitions: 45,
  totalWins: 12,
  totalTop3: 28,
  winRate: 26.67,
  totalPrizeMoney: 35000,
  totalXpGained: 4500,
  bestPlacement: 1,
  mostSuccessfulDiscipline: 'dressage',
  recentCompetitions: [
    {
      competitionId: 1,
      competitionName: 'Spring Dressage Championship',
      discipline: 'dressage',
      date: '2026-03-15T10:00:00Z',
      placement: 1,
      totalParticipants: 12,
      finalScore: 95.5,
      prizeMoney: 2500,
      xpGained: 150,
    },
    {
      competitionId: 2,
      competitionName: 'Winter Jumping Series',
      discipline: 'jumping',
      date: '2026-02-10T14:00:00Z',
      placement: 2,
      totalParticipants: 20,
      finalScore: 88.2,
      prizeMoney: 1500,
      xpGained: 100,
    },
    {
      competitionId: 3,
      competitionName: 'Regional Eventing Finals',
      discipline: 'eventing',
      date: '2026-01-25T09:00:00Z',
      placement: 3,
      totalParticipants: 18,
      finalScore: 82.0,
      prizeMoney: 1000,
      xpGained: 75,
    },
    {
      competitionId: 4,
      competitionName: 'Amateur Dressage Cup',
      discipline: 'dressage',
      date: '2026-01-15T11:00:00Z',
      placement: 1,
      totalParticipants: 15,
      finalScore: 91.3,
      prizeMoney: 2000,
      xpGained: 125,
    },
    {
      competitionId: 5,
      competitionName: 'Cross Country Challenge',
      discipline: 'eventing',
      date: '2026-01-05T08:00:00Z',
      placement: 4,
      totalParticipants: 25,
      finalScore: 78.5,
      prizeMoney: 500,
      xpGained: 50,
    },
  ],
};

const mockNewUserStats: UserCompetitionStats = {
  userId: 'new-user',
  totalCompetitions: 0,
  totalWins: 0,
  totalTop3: 0,
  winRate: 0,
  totalPrizeMoney: 0,
  totalXpGained: 0,
  bestPlacement: 0,
  mostSuccessfulDiscipline: '',
  recentCompetitions: [],
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
        mutations: {
          retry: false,
        },
      },
    });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useUserCompetitionStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Fetches stats when userId provided
  it('should fetch competition stats when userId is provided', async () => {
    vi.mocked(competitionResultsApi.fetchUserCompetitionStats).mockResolvedValue(
      mockUserStats
    );

    const { result } = renderHook(() => useUserCompetitionStats('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(competitionResultsApi.fetchUserCompetitionStats).toHaveBeenCalledTimes(1);
    expect(competitionResultsApi.fetchUserCompetitionStats).toHaveBeenCalledWith('user-1');
    expect(result.current.data).toEqual(mockUserStats);
  });

  // Test 2: Returns loading state initially
  it('should return loading state initially', () => {
    vi.mocked(competitionResultsApi.fetchUserCompetitionStats).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    );

    const { result } = renderHook(() => useUserCompetitionStats('user-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  // Test 3: Returns aggregated statistics
  it('should return aggregated statistics across all horses', async () => {
    vi.mocked(competitionResultsApi.fetchUserCompetitionStats).mockResolvedValue(
      mockUserStats
    );

    const { result } = renderHook(() => useUserCompetitionStats('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify aggregated stats
    expect(result.current.data?.totalCompetitions).toBe(45);
    expect(result.current.data?.totalWins).toBe(12);
    expect(result.current.data?.totalTop3).toBe(28);
    expect(result.current.data?.winRate).toBe(26.67);
    expect(result.current.data?.totalPrizeMoney).toBe(35000);
    expect(result.current.data?.totalXpGained).toBe(4500);
    expect(result.current.data?.bestPlacement).toBe(1);
    expect(result.current.data?.mostSuccessfulDiscipline).toBe('dressage');
  });

  // Test 4: Handles fetch error correctly
  it('should handle fetch error correctly', async () => {
    const mockError = {
      message: 'User not found',
      status: 'error',
      statusCode: 404,
    };

    vi.mocked(competitionResultsApi.fetchUserCompetitionStats).mockRejectedValue(mockError);

    const { result } = renderHook(() => useUserCompetitionStats('error-user'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
    expect(result.current.data).toBeUndefined();
  });

  // Test 5: Disabled when userId is null
  it('should not fetch when userId is null', () => {
    vi.mocked(competitionResultsApi.fetchUserCompetitionStats).mockResolvedValue(
      mockUserStats
    );

    const { result } = renderHook(() => useUserCompetitionStats(null), {
      wrapper: createWrapper(),
    });

    // Should not call API when ID is null
    expect(competitionResultsApi.fetchUserCompetitionStats).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  // Test 6: Updates when userId changes
  it('should fetch new data when userId changes', async () => {
    const stats1 = { ...mockUserStats, userId: 'user-1' };
    const stats2 = { ...mockUserStats, userId: 'user-2', totalWins: 20 };

    vi.mocked(competitionResultsApi.fetchUserCompetitionStats).mockImplementation((id) => {
      if (id === 'user-1') return Promise.resolve(stats1);
      if (id === 'user-2') return Promise.resolve(stats2);
      return Promise.reject({ message: 'Not found', status: 'error', statusCode: 404 });
    });

    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useUserCompetitionStats(id),
      {
        wrapper: createWrapper(),
        initialProps: { id: 'user-1' },
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.userId).toBe('user-1');
    expect(competitionResultsApi.fetchUserCompetitionStats).toHaveBeenCalledWith('user-1');

    // Change ID
    rerender({ id: 'user-2' });

    await waitFor(() => expect(result.current.data?.userId).toBe('user-2'));
    expect(result.current.data?.totalWins).toBe(20);
    expect(competitionResultsApi.fetchUserCompetitionStats).toHaveBeenCalledWith('user-2');
    expect(competitionResultsApi.fetchUserCompetitionStats).toHaveBeenCalledTimes(2);
  });

  // Test 7: Uses correct query key
  it('should use correct query key structure', async () => {
    vi.mocked(competitionResultsApi.fetchUserCompetitionStats).mockResolvedValue(
      mockUserStats
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    const { result } = renderHook(() => useUserCompetitionStats('user-123'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify query key structure
    const expectedKey = userCompetitionStatsQueryKeys.stats('user-123');
    expect(expectedKey).toEqual(['user-competition-stats', 'user-123']);

    // Verify data is cached under correct key
    const cachedData = queryClient.getQueryData(expectedKey);
    expect(cachedData).toEqual(mockUserStats);
  });

  // Test 8: 2 minute staleTime (most frequent updates)
  it('should use 2 minute staleTime for frequent updates', async () => {
    vi.mocked(competitionResultsApi.fetchUserCompetitionStats).mockResolvedValue(
      mockUserStats
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // First render - should fetch
    const { result, unmount } = renderHook(() => useUserCompetitionStats('user-1'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(competitionResultsApi.fetchUserCompetitionStats).toHaveBeenCalledTimes(1);

    // Unmount and remount - should NOT refetch due to staleTime
    unmount();

    const { result: result2 } = renderHook(() => useUserCompetitionStats('user-1'), {
      wrapper: createWrapper(queryClient),
    });

    // Data should still be available without refetch
    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    expect(result2.current.data).toEqual(mockUserStats);

    // Should still only be 1 call (data was cached and fresh)
    expect(competitionResultsApi.fetchUserCompetitionStats).toHaveBeenCalledTimes(1);
  });

  // Test 9: Recent competitions included
  it('should include recent competitions in the stats', async () => {
    vi.mocked(competitionResultsApi.fetchUserCompetitionStats).mockResolvedValue(
      mockUserStats
    );

    const { result } = renderHook(() => useUserCompetitionStats('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify recent competitions
    expect(result.current.data?.recentCompetitions).toHaveLength(5);
    expect(result.current.data?.recentCompetitions[0].competitionName).toBe(
      'Spring Dressage Championship'
    );

    // Verify competition entry structure
    const recentComp = result.current.data?.recentCompetitions[0];
    expect(recentComp?.competitionId).toBe(1);
    expect(recentComp?.discipline).toBe('dressage');
    expect(recentComp?.placement).toBe(1);
    expect(recentComp?.prizeMoney).toBe(2500);
    expect(recentComp?.xpGained).toBe(150);
  });

  // Test 10: Zero stats handled correctly (new users)
  it('should handle zero stats correctly for new users', async () => {
    vi.mocked(competitionResultsApi.fetchUserCompetitionStats).mockResolvedValue(
      mockNewUserStats
    );

    const { result } = renderHook(() => useUserCompetitionStats('new-user'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.userId).toBe('new-user');
    expect(result.current.data?.totalCompetitions).toBe(0);
    expect(result.current.data?.totalWins).toBe(0);
    expect(result.current.data?.totalTop3).toBe(0);
    expect(result.current.data?.winRate).toBe(0);
    expect(result.current.data?.totalPrizeMoney).toBe(0);
    expect(result.current.data?.totalXpGained).toBe(0);
    expect(result.current.data?.bestPlacement).toBe(0);
    expect(result.current.data?.mostSuccessfulDiscipline).toBe('');
    expect(result.current.data?.recentCompetitions).toHaveLength(0);
  });
});

describe('userCompetitionStatsQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(userCompetitionStatsQueryKeys).toBeDefined();
    expect(userCompetitionStatsQueryKeys.all).toEqual(['user-competition-stats']);
    expect(userCompetitionStatsQueryKeys.stats('user-1')).toEqual(['user-competition-stats', 'user-1']);
    expect(userCompetitionStatsQueryKeys.stats('abc-123')).toEqual(['user-competition-stats', 'abc-123']);
  });

  it('should create unique keys for different user IDs', () => {
    const key1 = userCompetitionStatsQueryKeys.stats('user-1');
    const key2 = userCompetitionStatsQueryKeys.stats('user-2');
    const key3 = userCompetitionStatsQueryKeys.stats('admin');

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
    expect(key2).not.toEqual(key3);
  });
});
