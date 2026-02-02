/**
 * Tests for useHorseCompetitionHistory Hook
 *
 * Competition Results System - Task: useHorseCompetitionHistory hook tests
 *
 * Tests for fetching horse competition history and statistics:
 * - Basic fetching with horse ID
 * - Loading states
 * - Statistics and competitions data
 * - Error handling
 * - Disabled state when ID is null
 * - Query key management
 * - Cache behavior (staleTime, gcTime)
 * - Empty history handling
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as competitionResultsApi from '@/lib/api/competitionResults';
import {
  useHorseCompetitionHistory,
  horseCompetitionHistoryQueryKeys,
} from '../useHorseCompetitionHistory';
import type { CompetitionHistoryData } from '@/lib/api/competitionResults';

// Mock API functions
vi.mock('@/lib/api/competitionResults', async () => {
  const actual = await vi.importActual('@/lib/api/competitionResults');
  return {
    ...actual,
    fetchHorseCompetitionHistory: vi.fn(),
  };
});

const mockHistoryData: CompetitionHistoryData = {
  horseId: 1,
  horseName: 'Thunder',
  statistics: {
    totalCompetitions: 15,
    wins: 5,
    top3Finishes: 10,
    winRate: 33.33,
    totalPrizeMoney: 12500,
    averagePlacement: 2.8,
    bestPlacement: 1,
  },
  competitions: [
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
  ],
};

const mockEmptyHistoryData: CompetitionHistoryData = {
  horseId: 888,
  horseName: 'New Horse',
  statistics: {
    totalCompetitions: 0,
    wins: 0,
    top3Finishes: 0,
    winRate: 0,
    totalPrizeMoney: 0,
    averagePlacement: 0,
    bestPlacement: 0,
  },
  competitions: [],
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

describe('useHorseCompetitionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Fetches history when horseId provided
  it('should fetch competition history when horseId is provided', async () => {
    vi.mocked(competitionResultsApi.fetchHorseCompetitionHistory).mockResolvedValue(
      mockHistoryData
    );

    const { result } = renderHook(() => useHorseCompetitionHistory(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(competitionResultsApi.fetchHorseCompetitionHistory).toHaveBeenCalledTimes(1);
    expect(competitionResultsApi.fetchHorseCompetitionHistory).toHaveBeenCalledWith(1);
    expect(result.current.data).toEqual(mockHistoryData);
  });

  // Test 2: Returns loading state initially
  it('should return loading state initially', () => {
    vi.mocked(competitionResultsApi.fetchHorseCompetitionHistory).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    );

    const { result } = renderHook(() => useHorseCompetitionHistory(1), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  // Test 3: Returns data with statistics and competitions
  it('should return data with statistics and competitions', async () => {
    vi.mocked(competitionResultsApi.fetchHorseCompetitionHistory).mockResolvedValue(
      mockHistoryData
    );

    const { result } = renderHook(() => useHorseCompetitionHistory(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify statistics
    expect(result.current.data?.statistics.totalCompetitions).toBe(15);
    expect(result.current.data?.statistics.wins).toBe(5);
    expect(result.current.data?.statistics.top3Finishes).toBe(10);
    expect(result.current.data?.statistics.winRate).toBe(33.33);
    expect(result.current.data?.statistics.totalPrizeMoney).toBe(12500);
    expect(result.current.data?.statistics.averagePlacement).toBe(2.8);
    expect(result.current.data?.statistics.bestPlacement).toBe(1);

    // Verify competitions
    expect(result.current.data?.competitions).toHaveLength(3);
    expect(result.current.data?.competitions[0].competitionName).toBe('Spring Dressage Championship');
  });

  // Test 4: Handles fetch error correctly
  it('should handle fetch error correctly', async () => {
    const mockError = {
      message: 'Horse not found',
      status: 'error',
      statusCode: 404,
    };

    vi.mocked(competitionResultsApi.fetchHorseCompetitionHistory).mockRejectedValue(mockError);

    const { result } = renderHook(() => useHorseCompetitionHistory(999), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
    expect(result.current.data).toBeUndefined();
  });

  // Test 5: Disabled when horseId is null
  it('should not fetch when horseId is null', () => {
    vi.mocked(competitionResultsApi.fetchHorseCompetitionHistory).mockResolvedValue(
      mockHistoryData
    );

    const { result } = renderHook(() => useHorseCompetitionHistory(null), {
      wrapper: createWrapper(),
    });

    // Should not call API when ID is null
    expect(competitionResultsApi.fetchHorseCompetitionHistory).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  // Test 6: Updates when horseId changes
  it('should fetch new data when horseId changes', async () => {
    const history1 = { ...mockHistoryData, horseId: 1, horseName: 'Horse 1' };
    const history2 = { ...mockHistoryData, horseId: 2, horseName: 'Horse 2' };

    vi.mocked(competitionResultsApi.fetchHorseCompetitionHistory).mockImplementation((id) => {
      if (id === 1) return Promise.resolve(history1);
      if (id === 2) return Promise.resolve(history2);
      return Promise.reject({ message: 'Not found', status: 'error', statusCode: 404 });
    });

    const { result, rerender } = renderHook(
      ({ id }: { id: number | null }) => useHorseCompetitionHistory(id),
      {
        wrapper: createWrapper(),
        initialProps: { id: 1 },
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.horseName).toBe('Horse 1');
    expect(competitionResultsApi.fetchHorseCompetitionHistory).toHaveBeenCalledWith(1);

    // Change ID
    rerender({ id: 2 });

    await waitFor(() => expect(result.current.data?.horseName).toBe('Horse 2'));
    expect(competitionResultsApi.fetchHorseCompetitionHistory).toHaveBeenCalledWith(2);
    expect(competitionResultsApi.fetchHorseCompetitionHistory).toHaveBeenCalledTimes(2);
  });

  // Test 7: Uses correct query key
  it('should use correct query key structure', async () => {
    vi.mocked(competitionResultsApi.fetchHorseCompetitionHistory).mockResolvedValue(
      mockHistoryData
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    const { result } = renderHook(() => useHorseCompetitionHistory(123), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify query key structure
    const expectedKey = horseCompetitionHistoryQueryKeys.history(123);
    expect(expectedKey).toEqual(['horse-competition-history', 123]);

    // Verify data is cached under correct key
    const cachedData = queryClient.getQueryData(expectedKey);
    expect(cachedData).toEqual(mockHistoryData);
  });

  // Test 8: staleTime works correctly (5 minutes)
  it('should use 5 minute staleTime to prevent unnecessary refetches', async () => {
    vi.mocked(competitionResultsApi.fetchHorseCompetitionHistory).mockResolvedValue(
      mockHistoryData
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // First render - should fetch
    const { result, unmount } = renderHook(() => useHorseCompetitionHistory(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(competitionResultsApi.fetchHorseCompetitionHistory).toHaveBeenCalledTimes(1);

    // Unmount and remount - should NOT refetch due to staleTime
    unmount();

    const { result: result2 } = renderHook(() => useHorseCompetitionHistory(1), {
      wrapper: createWrapper(queryClient),
    });

    // Data should still be available without refetch
    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    expect(result2.current.data).toEqual(mockHistoryData);

    // Should still only be 1 call (data was cached and fresh)
    expect(competitionResultsApi.fetchHorseCompetitionHistory).toHaveBeenCalledTimes(1);
  });

  // Test 9: Data structure matches interface
  it('should return data structure that matches CompetitionHistoryData interface', async () => {
    vi.mocked(competitionResultsApi.fetchHorseCompetitionHistory).mockResolvedValue(
      mockHistoryData
    );

    const { result } = renderHook(() => useHorseCompetitionHistory(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data).toBeDefined();

    // Verify all required fields exist
    expect(typeof data?.horseId).toBe('number');
    expect(typeof data?.horseName).toBe('string');
    expect(data?.statistics).toBeDefined();
    expect(Array.isArray(data?.competitions)).toBe(true);

    // Verify statistics structure
    const stats = data?.statistics;
    expect(typeof stats?.totalCompetitions).toBe('number');
    expect(typeof stats?.wins).toBe('number');
    expect(typeof stats?.top3Finishes).toBe('number');
    expect(typeof stats?.winRate).toBe('number');
    expect(typeof stats?.totalPrizeMoney).toBe('number');
    expect(typeof stats?.averagePlacement).toBe('number');
    expect(typeof stats?.bestPlacement).toBe('number');

    // Verify competition entry structure
    if (data?.competitions && data.competitions.length > 0) {
      const competition = data.competitions[0];
      expect(typeof competition.competitionId).toBe('number');
      expect(typeof competition.competitionName).toBe('string');
      expect(typeof competition.discipline).toBe('string');
      expect(typeof competition.date).toBe('string');
      expect(typeof competition.placement).toBe('number');
      expect(typeof competition.totalParticipants).toBe('number');
      expect(typeof competition.finalScore).toBe('number');
      expect(typeof competition.prizeMoney).toBe('number');
      expect(typeof competition.xpGained).toBe('number');
    }
  });

  // Test 10: Empty history handled gracefully
  it('should handle empty history gracefully for new horses', async () => {
    vi.mocked(competitionResultsApi.fetchHorseCompetitionHistory).mockResolvedValue(
      mockEmptyHistoryData
    );

    const { result } = renderHook(() => useHorseCompetitionHistory(888), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.horseId).toBe(888);
    expect(result.current.data?.horseName).toBe('New Horse');
    expect(result.current.data?.statistics.totalCompetitions).toBe(0);
    expect(result.current.data?.statistics.wins).toBe(0);
    expect(result.current.data?.statistics.winRate).toBe(0);
    expect(result.current.data?.statistics.totalPrizeMoney).toBe(0);
    expect(result.current.data?.competitions).toHaveLength(0);
  });
});

describe('horseCompetitionHistoryQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(horseCompetitionHistoryQueryKeys).toBeDefined();
    expect(horseCompetitionHistoryQueryKeys.all).toEqual(['horse-competition-history']);
    expect(horseCompetitionHistoryQueryKeys.history(1)).toEqual(['horse-competition-history', 1]);
    expect(horseCompetitionHistoryQueryKeys.history(456)).toEqual(['horse-competition-history', 456]);
  });

  it('should create unique keys for different horse IDs', () => {
    const key1 = horseCompetitionHistoryQueryKeys.history(1);
    const key2 = horseCompetitionHistoryQueryKeys.history(2);
    const key3 = horseCompetitionHistoryQueryKeys.history(100);

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
    expect(key2).not.toEqual(key3);
  });
});
