/**
 * Tests for useLeaderboardRefresh Hook
 *
 * Leaderboard System - Task 5: useLeaderboardRefresh hook tests
 *
 * Tests for cache invalidation of leaderboard queries:
 * - refreshAll invalidates all leaderboard queries
 * - refreshCategory invalidates specific category queries
 * - isRefreshing state management
 * - Multiple refresh calls
 * - Refresh with different categories
 *
 * Story 5-5: Leaderboards - Task 5
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLeaderboardRefresh } from '../useLeaderboardRefresh';
import { leaderboardQueryKeys } from '../useLeaderboard';
import { userRankSummaryQueryKeys } from '../useUserRankSummary';

let queryClient: QueryClient;

const createWrapper = () => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useLeaderboardRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
          staleTime: Infinity,
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: refreshAll invalidates all leaderboard queries
  it('should invalidate all leaderboard and user summary queries when refreshAll is called', async () => {
    const wrapper = createWrapper();

    // Pre-populate cache with leaderboard data
    queryClient.setQueryData(
      leaderboardQueryKeys.list('level', 'monthly', undefined, 1, 50),
      { category: 'level', entries: [] }
    );
    queryClient.setQueryData(
      leaderboardQueryKeys.list('prize-money', 'all-time', undefined, 1, 50),
      { category: 'prize-money', entries: [] }
    );
    queryClient.setQueryData(
      userRankSummaryQueryKeys.user('user-123'),
      { userId: 'user-123', rankings: [] }
    );

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useLeaderboardRefresh(), { wrapper });

    await act(async () => {
      await result.current.refreshAll();
    });

    // Should have been called with both leaderboard and user summary keys
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: leaderboardQueryKeys.all,
      })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: userRankSummaryQueryKeys.all,
      })
    );
  });

  // Test 2: refreshCategory invalidates specific category queries
  it('should invalidate only the specified category queries when refreshCategory is called', async () => {
    const wrapper = createWrapper();

    // Pre-populate cache
    queryClient.setQueryData(
      leaderboardQueryKeys.list('level', 'monthly', undefined, 1, 50),
      { category: 'level', entries: [] }
    );

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useLeaderboardRefresh(), { wrapper });

    await act(async () => {
      await result.current.refreshCategory('level', 'monthly');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['leaderboards', 'level', 'monthly', undefined],
      })
    );
  });

  // Test 3: isRefreshing state returns to false after refresh completes
  it('should set isRefreshing to false after refresh completes', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useLeaderboardRefresh(), { wrapper });

    // Initially not refreshing
    expect(result.current.isRefreshing).toBe(false);

    await act(async () => {
      await result.current.refreshAll();
    });

    // After refresh completes, should be false again
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
  });

  // Test 4: Multiple sequential refresh calls work correctly
  it('should handle multiple sequential refresh calls', async () => {
    const wrapper = createWrapper();

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useLeaderboardRefresh(), { wrapper });

    // First refresh
    await act(async () => {
      await result.current.refreshAll();
    });

    // Second refresh
    await act(async () => {
      await result.current.refreshAll();
    });

    // invalidateQueries called twice for leaderboards.all and twice for user-summary.all
    const leaderboardCalls = invalidateSpy.mock.calls.filter(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: leaderboardQueryKeys.all })
    );
    const userSummaryCalls = invalidateSpy.mock.calls.filter(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: userRankSummaryQueryKeys.all })
    );

    expect(leaderboardCalls.length).toBe(2);
    expect(userSummaryCalls.length).toBe(2);
  });

  // Test 5: refreshCategory with discipline parameter
  it('should pass discipline to the invalidation key when refreshing a discipline category', async () => {
    const wrapper = createWrapper();

    // Pre-populate cache with discipline data
    queryClient.setQueryData(
      leaderboardQueryKeys.list('discipline', 'weekly', 'dressage', 1, 50),
      { category: 'discipline', entries: [] }
    );

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useLeaderboardRefresh(), { wrapper });

    await act(async () => {
      await result.current.refreshCategory('discipline', 'weekly', 'dressage');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['leaderboards', 'discipline', 'weekly', 'dressage'],
      })
    );
  });
});
