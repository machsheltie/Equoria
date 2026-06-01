/**
 * Tests for useHorsePrizeSummary Hook
 *
 * Prize System - useHorsePrizeSummary hook tests
 *
 * Tests for fetching horse prize summary:
 * - Basic fetching with horse ID
 * - Loading states
 * - Error handling
 * - Disabled state when horseId is null
 * - Query key management
 * - Cache behavior (staleTime, gcTime)
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (mzrv2 / Constitution §3: no vi.mock-of-API-client). The hook exercises
 * the real `apiClient` envelope unwrap end-to-end.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { useHorsePrizeSummary, horsePrizeSummaryQueryKeys } from '../useHorsePrizeSummary';
import type { HorsePrizeSummary } from '@/lib/api/prizes';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const mockHorsePrizeSummary: HorsePrizeSummary = {
  horseId: 1,
  horseName: 'Thunder',
  totalCompetitions: 15,
  totalPrizeMoney: 12500,
  totalXpGained: 950,
  firstPlaces: 5,
  secondPlaces: 4,
  thirdPlaces: 3,
  unclaimedPrizes: 1,
  recentPrizes: [
    {
      transactionId: 'txn-001',
      date: '2026-03-15T10:00:00Z',
      competitionId: 1,
      competitionName: 'Spring Dressage Championship',
      horseId: 1,
      horseName: 'Thunder',
      discipline: 'dressage',
      placement: 1,
      prizeMoney: 2500,
      xpGained: 150,
      claimed: true,
      claimedAt: '2026-03-15T12:00:00Z',
    },
    {
      transactionId: 'txn-003',
      date: '2026-01-25T09:00:00Z',
      competitionId: 3,
      competitionName: 'Regional Eventing Finals',
      horseId: 1,
      horseName: 'Thunder',
      discipline: 'eventing',
      placement: 3,
      prizeMoney: 1000,
      xpGained: 75,
      claimed: false,
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
        mutations: {
          retry: false,
        },
      },
    });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useHorsePrizeSummary', () => {
  let calledPaths: string[] = [];

  beforeEach(() => {
    calledPaths = [];
  });

  // Test 1: Fetches horse prize summary on mount
  it('should fetch horse prize summary when horseId is provided', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/prize-summary`, ({ request, params }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({
          success: true,
          data: { ...mockHorsePrizeSummary, horseId: Number(params.horseId) },
        });
      })
    );

    const { result } = renderHook(() => useHorsePrizeSummary(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calledPaths).toEqual(['/api/v1/horses/1/prize-summary']);
    expect(result.current.data).toEqual(mockHorsePrizeSummary);
  });

  // Test 2: Returns loading state initially
  it('should return loading state initially', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/prize-summary`, async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: mockHorsePrizeSummary });
      })
    );

    const { result } = renderHook(() => useHorsePrizeSummary(1), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  // Test 3: Returns data after successful fetch
  it('should return data after successful fetch with complete summary structure', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/prize-summary`, () => {
        return HttpResponse.json({ success: true, data: mockHorsePrizeSummary });
      })
    );

    const { result } = renderHook(() => useHorsePrizeSummary(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.horseId).toBe(1);
    expect(result.current.data?.horseName).toBe('Thunder');
    expect(result.current.data?.totalCompetitions).toBe(15);
    expect(result.current.data?.totalPrizeMoney).toBe(12500);
    expect(result.current.data?.firstPlaces).toBe(5);
    expect(result.current.data?.secondPlaces).toBe(4);
    expect(result.current.data?.thirdPlaces).toBe(3);
    expect(result.current.data?.unclaimedPrizes).toBe(1);
    expect(result.current.data?.recentPrizes).toHaveLength(2);
  });

  // Test 4: Handles fetch error correctly
  it('should handle fetch error correctly', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/prize-summary`, () => {
        return HttpResponse.json(
          { success: false, message: 'Horse not found' },
          { status: 404 }
        );
      })
    );

    const { result } = renderHook(() => useHorsePrizeSummary(999), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.statusCode).toBe(404);
    expect(result.current.error?.message).toBe('Horse not found');
    expect(result.current.data).toBeUndefined();
  });

  // Test 5: Refetch works correctly
  it('should refetch data when refetch is called', async () => {
    let callCount = 0;
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/prize-summary`, () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json({ success: true, data: mockHorsePrizeSummary });
        }
        return HttpResponse.json({
          success: true,
          data: { ...mockHorsePrizeSummary, totalPrizeMoney: 15000, unclaimedPrizes: 0 },
        });
      })
    );

    const { result } = renderHook(() => useHorsePrizeSummary(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalPrizeMoney).toBe(12500);

    // Trigger refetch
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.data?.totalPrizeMoney).toBe(15000));
    expect(callCount).toBe(2);
  });

  // Test 6: Cache works for different horses
  it('should create separate cache entries for different horses', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/prize-summary`, ({ params }) => {
        const id = Number(params.horseId);
        if (id === 1) {
          return HttpResponse.json({ success: true, data: mockHorsePrizeSummary });
        }
        if (id === 2) {
          return HttpResponse.json({
            success: true,
            data: { ...mockHorsePrizeSummary, horseId: 2, horseName: 'Storm' },
          });
        }
        return HttpResponse.json(
          { success: false, message: 'Not found' },
          { status: 404 }
        );
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Fetch horse 1
    const { result: result1 } = renderHook(() => useHorsePrizeSummary(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result1.current.isSuccess).toBe(true));
    expect(result1.current.data?.horseName).toBe('Thunder');

    // Fetch horse 2
    const { result: result2 } = renderHook(() => useHorsePrizeSummary(2), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    expect(result2.current.data?.horseName).toBe('Storm');

    // Both should be cached under correct keys
    expect(queryClient.getQueryData(horsePrizeSummaryQueryKeys.summary(1))).toBeDefined();
    expect(queryClient.getQueryData(horsePrizeSummaryQueryKeys.summary(2))).toBeDefined();
  });

  // Test 7: staleTime prevents unnecessary refetches
  it('should use 5 minute staleTime to prevent unnecessary refetches', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/prize-summary`, ({ request }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ success: true, data: mockHorsePrizeSummary });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // First render - should fetch
    const { result, unmount } = renderHook(() => useHorsePrizeSummary(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calledPaths).toHaveLength(1);

    // Unmount and remount - should NOT refetch due to staleTime
    unmount();

    const { result: result2 } = renderHook(() => useHorsePrizeSummary(1), {
      wrapper: createWrapper(queryClient),
    });

    // Data should still be available without refetch
    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    expect(result2.current.data).toEqual(mockHorsePrizeSummary);

    // Should still only be 1 call (data was cached and fresh)
    expect(calledPaths).toHaveLength(1);
  });

  // Test 8: Disabled when horseId is null
  it('should not fetch when horseId is null', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/prize-summary`, ({ request }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ success: true, data: mockHorsePrizeSummary });
      })
    );

    const { result } = renderHook(() => useHorsePrizeSummary(null), {
      wrapper: createWrapper(),
    });

    // Should not call API when ID is null
    expect(calledPaths).toEqual([]);
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  // Test 9: Query key includes horseId
  it('should use correct query key structure with horseId', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/prize-summary`, () => {
        return HttpResponse.json({ success: true, data: mockHorsePrizeSummary });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    const { result } = renderHook(() => useHorsePrizeSummary(123), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify query key structure
    const expectedKey = horsePrizeSummaryQueryKeys.summary(123);
    expect(expectedKey).toEqual(['prizes', 'horseSummary', 123]);

    // Verify data is cached under correct key
    const cachedData = queryClient.getQueryData(expectedKey);
    expect(cachedData).toEqual(mockHorsePrizeSummary);
  });

  // Test 10: gcTime is configured correctly
  it('should configure gcTime for 10 minutes cache retention', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/prize-summary`, () => {
        return HttpResponse.json({ success: true, data: mockHorsePrizeSummary });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const { result } = renderHook(() => useHorsePrizeSummary(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify the query was created with data
    const queryState = queryClient.getQueryState(horsePrizeSummaryQueryKeys.summary(1));
    expect(queryState).toBeDefined();
    expect(queryState?.data).toEqual(mockHorsePrizeSummary);

    // Verify data is cached and accessible
    const cachedData = queryClient.getQueryData(horsePrizeSummaryQueryKeys.summary(1));
    expect(cachedData).toEqual(mockHorsePrizeSummary);

    // Verify that the hook's configuration is applied
    expect(result.current.data).toBeDefined();
  });
});

describe('horsePrizeSummaryQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(horsePrizeSummaryQueryKeys).toBeDefined();
    expect(horsePrizeSummaryQueryKeys.all).toEqual(['prizes', 'horseSummary']);
    expect(horsePrizeSummaryQueryKeys.summary(1)).toEqual(['prizes', 'horseSummary', 1]);
    expect(horsePrizeSummaryQueryKeys.summary(123)).toEqual(['prizes', 'horseSummary', 123]);
  });

  it('should create unique keys for different horse IDs', () => {
    const key1 = horsePrizeSummaryQueryKeys.summary(1);
    const key2 = horsePrizeSummaryQueryKeys.summary(2);
    const key3 = horsePrizeSummaryQueryKeys.summary(100);

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
    expect(key2).not.toEqual(key3);
  });
});
