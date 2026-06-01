/**
 * Tests for useUserRankSummary Hook
 *
 * Leaderboard System - Task 5: useUserRankSummary hook tests
 *
 * Tests for fetching user ranking summaries:
 * - Successful data fetch
 * - Loading state
 * - Error state
 * - Query key construction
 * - Cache settings (staleTime 5min, gcTime 10min)
 * - Enabled flag (should not fetch when false)
 * - Refetch function
 * - Different userId values
 *
 * Story 5-5: Leaderboards - Task 5
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (mzrv2 / Constitution §3: no vi.mock-of-API-client). The hook exercises
 * the real `apiClient` envelope unwrap end-to-end.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { useUserRankSummary, userRankSummaryQueryKeys } from '../useUserRankSummary';
import type { UserRankSummaryResponse } from '@/lib/api/leaderboards';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const mockUserRankSummary: UserRankSummaryResponse = {
  userId: 'user-123',
  userName: 'John Doe',
  rankings: [
    {
      category: 'level',
      categoryLabel: 'Horse Level',
      rank: 42,
      totalEntries: 1254,
      rankChange: 5,
      primaryStat: 15,
      statLabel: 'Level',
    },
    {
      category: 'prize-money',
      categoryLabel: 'Prize Money',
      rank: 8,
      totalEntries: 980,
      rankChange: -2,
      primaryStat: 125340,
      statLabel: 'Total Earnings',
    },
    {
      category: 'win-rate',
      categoryLabel: 'Win Rate',
      rank: 156,
      totalEntries: 2100,
      rankChange: 0,
      primaryStat: 42,
      statLabel: 'Win Rate %',
    },
  ],
  bestRankings: [
    {
      category: 'prize-money',
      categoryLabel: 'Prize Money',
      rank: 8,
      achievement: 'Top 10',
    },
  ],
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

describe('useUserRankSummary', () => {
  let calledPaths: string[] = [];

  beforeEach(() => {
    calledPaths = [];
  });

  // Test 1: Fetches user rank summary successfully
  it('should fetch user rank summary when a valid userId is provided', async () => {
    server.use(
      http.get(`${base}/api/v1/leaderboards/user-summary/:userId`, ({ request, params }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({
          success: true,
          data: { ...mockUserRankSummary, userId: String(params.userId) },
        });
      })
    );

    const { result } = renderHook(() => useUserRankSummary({ userId: 'user-123' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calledPaths).toEqual(['/api/v1/leaderboards/user-summary/user-123']);
    expect(result.current.data).toEqual(mockUserRankSummary);
  });

  // Test 2: Returns loading state initially
  it('should return loading state while fetching', async () => {
    server.use(
      http.get(`${base}/api/v1/leaderboards/user-summary/:userId`, async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: mockUserRankSummary });
      })
    );

    const { result } = renderHook(() => useUserRankSummary({ userId: 'user-123' }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  // Test 3: Handles API errors correctly
  it('should handle API errors and expose the error object', async () => {
    server.use(
      http.get(`${base}/api/v1/leaderboards/user-summary/:userId`, () => {
        return HttpResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      })
    );

    const { result } = renderHook(() => useUserRankSummary({ userId: 'nonexistent-user' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.statusCode).toBe(404);
    expect(result.current.error?.message).toBe('User not found');
    expect(result.current.data).toBeUndefined();
  });

  // Test 4: Uses correct query key for user-specific data
  it('should use correct query key including the userId', async () => {
    server.use(
      http.get(`${base}/api/v1/leaderboards/user-summary/:userId`, () => {
        return HttpResponse.json({ success: true, data: mockUserRankSummary });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    const { result } = renderHook(() => useUserRankSummary({ userId: 'user-123' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const expectedKey = userRankSummaryQueryKeys.user('user-123');
    expect(expectedKey).toEqual(['leaderboards', 'user-summary', 'user-123']);

    const cachedData = queryClient.getQueryData(expectedKey);
    expect(cachedData).toEqual(mockUserRankSummary);
  });

  // Test 5: Respects staleTime (5 minutes)
  it('should use 5 minute staleTime to prevent unnecessary refetches', async () => {
    server.use(
      http.get(`${base}/api/v1/leaderboards/user-summary/:userId`, ({ request }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ success: true, data: mockUserRankSummary });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // First render - should fetch
    const { result, unmount } = renderHook(() => useUserRankSummary({ userId: 'user-123' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calledPaths).toHaveLength(1);

    // Unmount and remount - should NOT refetch due to staleTime
    unmount();

    const { result: result2 } = renderHook(() => useUserRankSummary({ userId: 'user-123' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    expect(result2.current.data).toEqual(mockUserRankSummary);

    // Should still only be 1 call
    expect(calledPaths).toHaveLength(1);
  });

  // Test 6: Enabled flag prevents fetching when false
  it('should not fetch when enabled is false', async () => {
    server.use(
      http.get(`${base}/api/v1/leaderboards/user-summary/:userId`, ({ request }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ success: true, data: mockUserRankSummary });
      })
    );

    const { result } = renderHook(
      () => useUserRankSummary({ userId: 'user-123', enabled: false }),
      { wrapper: createWrapper() }
    );

    expect(calledPaths).toEqual([]);
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  // Test 7: Refetch function works
  it('should expose a refetch function that re-fetches data', async () => {
    let callCount = 0;
    server.use(
      http.get(`${base}/api/v1/leaderboards/user-summary/:userId`, () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json({
            success: true,
            data: { ...mockUserRankSummary, userName: 'John Doe' },
          });
        }
        return HttpResponse.json({
          success: true,
          data: { ...mockUserRankSummary, userName: 'John Updated' },
        });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
      },
    });

    const { result } = renderHook(() => useUserRankSummary({ userId: 'user-123' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.userName).toBe('John Doe');

    // Refetch
    await result.current.refetch();

    await waitFor(() => expect(result.current.data?.userName).toBe('John Updated'));
    expect(callCount).toBe(2);
  });

  // Test 8: Different userId values produce different cache entries
  it('should cache different users separately with unique query keys', async () => {
    server.use(
      http.get(`${base}/api/v1/leaderboards/user-summary/:userId`, ({ params }) => {
        const userId = String(params.userId);
        if (userId === 'user-111') {
          return HttpResponse.json({
            success: true,
            data: { ...mockUserRankSummary, userId: 'user-111', userName: 'Alice' },
          });
        }
        if (userId === 'user-222') {
          return HttpResponse.json({
            success: true,
            data: { ...mockUserRankSummary, userId: 'user-222', userName: 'Bob' },
          });
        }
        return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    // Fetch user 1
    const { result: result1 } = renderHook(() => useUserRankSummary({ userId: 'user-111' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result1.current.isSuccess).toBe(true));

    // Fetch user 2
    const { result: result2 } = renderHook(() => useUserRankSummary({ userId: 'user-222' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result2.current.isSuccess).toBe(true));

    // Both should be cached separately
    const user1Key = userRankSummaryQueryKeys.user('user-111');
    const user2Key = userRankSummaryQueryKeys.user('user-222');

    expect(user1Key).not.toEqual(user2Key);
    expect(queryClient.getQueryData(user1Key)).toMatchObject({ userName: 'Alice' });
    expect(queryClient.getQueryData(user2Key)).toMatchObject({ userName: 'Bob' });
  });
});

describe('userRankSummaryQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(userRankSummaryQueryKeys).toBeDefined();
    expect(userRankSummaryQueryKeys.all).toEqual(['leaderboards', 'user-summary']);
    expect(userRankSummaryQueryKeys.user('user-abc')).toEqual([
      'leaderboards',
      'user-summary',
      'user-abc',
    ]);
  });

  it('should create unique keys for different users', () => {
    const key1 = userRankSummaryQueryKeys.user('user-1');
    const key2 = userRankSummaryQueryKeys.user('user-2');

    expect(key1).not.toEqual(key2);
  });
});
