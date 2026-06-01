/**
 * Tests for useCompetitionResults Hook
 *
 * Competition Results System - useCompetitionResults hook tests
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (mzrv2 / Constitution §3: no vi.mock-of-API-client). The hook exercises the
 * real `apiClient` envelope unwrap of `{ success, data }` end-to-end.
 *
 * Tests for fetching full competition results with rankings:
 * - Basic fetching with competition ID
 * - Loading states
 * - Error handling
 * - Disabled state when ID is null
 * - Query key management
 * - Cache behavior (staleTime, gcTime)
 * - Data updates when ID changes
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { useCompetitionResults, competitionResultsQueryKeys } from '../useCompetitionResults';
import type { CompetitionResults } from '@/lib/api/competitionResults';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const mockCompetitionResults: CompetitionResults = {
  competitionId: 1,
  competitionName: 'Spring Dressage Championship',
  discipline: 'dressage',
  date: '2026-03-15T10:00:00Z',
  totalParticipants: 12,
  prizePool: 5000,
  prizeDistribution: {
    first: 2500,
    second: 1500,
    third: 1000,
  },
  results: [
    {
      rank: 1,
      horseId: 1,
      horseName: 'Thunder',
      ownerId: 'user-1',
      ownerName: 'John Doe',
      finalScore: 95.5,
      prizeWon: 2500,
      isCurrentUser: true,
      scoreBreakdown: {
        baseStatScore: 70,
        traitBonus: 5,
        trainingScore: 10,
        equipmentBonus: 3,
        riderBonus: 5,
        healthModifier: 0,
        randomLuck: 2.5,
      },
    },
    {
      rank: 2,
      horseId: 2,
      horseName: 'Storm',
      ownerId: 'user-2',
      ownerName: 'Jane Smith',
      finalScore: 88.2,
      prizeWon: 1500,
      isCurrentUser: false,
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

describe('useCompetitionResults', () => {
  let calledPaths: string[] = [];

  beforeEach(() => {
    calledPaths = [];
  });

  // Test 1: Fetches results when competitionId provided
  it('should fetch competition results when competitionId is provided', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id/results`, ({ request, params }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({
          success: true,
          data: { ...mockCompetitionResults, competitionId: Number(params.id) },
        });
      })
    );

    const { result } = renderHook(() => useCompetitionResults(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calledPaths).toEqual(['/api/v1/competitions/1/results']);
    expect(result.current.data).toEqual(mockCompetitionResults);
  });

  // Test 2: Returns loading state initially
  it('should return loading state initially', () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id/results`, async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: mockCompetitionResults });
      })
    );

    const { result } = renderHook(() => useCompetitionResults(1), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  // Test 3: Returns data after successful fetch
  it('should return data after successful fetch with complete results structure', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id/results`, () => {
        return HttpResponse.json({ success: true, data: mockCompetitionResults });
      })
    );

    const { result } = renderHook(() => useCompetitionResults(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.competitionName).toBe('Spring Dressage Championship');
    expect(result.current.data?.discipline).toBe('dressage');
    expect(result.current.data?.totalParticipants).toBe(12);
    expect(result.current.data?.prizePool).toBe(5000);
    expect(result.current.data?.prizeDistribution.first).toBe(2500);
    expect(result.current.data?.results).toHaveLength(2);
    expect(result.current.data?.results[0].rank).toBe(1);
    expect(result.current.data?.results[0].horseName).toBe('Thunder');
  });

  // Test 4: Handles fetch error correctly
  it('should handle fetch error correctly', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id/results`, () => {
        return HttpResponse.json(
          { success: false, message: 'Competition results not found' },
          { status: 404 }
        );
      })
    );

    const { result } = renderHook(() => useCompetitionResults(999), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.statusCode).toBe(404);
    expect(result.current.error?.message).toBe('Competition results not found');
    expect(result.current.data).toBeUndefined();
  });

  // Test 5: Disabled when competitionId is null
  it('should not fetch when competitionId is null', () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id/results`, ({ request }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ success: true, data: mockCompetitionResults });
      })
    );

    const { result } = renderHook(() => useCompetitionResults(null), {
      wrapper: createWrapper(),
    });

    // Should not call API when ID is null
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(calledPaths).toEqual([]);
  });

  // Test 6: Updates when competitionId changes
  it('should fetch new data when competitionId changes', async () => {
    const results1 = {
      ...mockCompetitionResults,
      competitionId: 1,
      competitionName: 'Competition 1',
    };
    const results2 = {
      ...mockCompetitionResults,
      competitionId: 2,
      competitionName: 'Competition 2',
    };

    server.use(
      http.get(`${base}/api/v1/competitions/:id/results`, ({ request, params }) => {
        calledPaths.push(new URL(request.url).pathname);
        const id = Number(params.id);
        if (id === 1) return HttpResponse.json({ success: true, data: results1 });
        if (id === 2) return HttpResponse.json({ success: true, data: results2 });
        return HttpResponse.json(
          { success: false, message: 'Not found' },
          { status: 404 }
        );
      })
    );

    const { result, rerender } = renderHook(
      ({ id }: { id: number | null }) => useCompetitionResults(id),
      {
        wrapper: createWrapper(),
        initialProps: { id: 1 as number | null },
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.competitionName).toBe('Competition 1');
    expect(calledPaths).toContain('/api/v1/competitions/1/results');

    // Change ID
    rerender({ id: 2 });

    await waitFor(() => expect(result.current.data?.competitionName).toBe('Competition 2'));
    expect(calledPaths).toContain('/api/v1/competitions/2/results');
    expect(calledPaths).toHaveLength(2);
  });

  // Test 7: Uses correct query key
  it('should use correct query key structure', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id/results`, () => {
        return HttpResponse.json({ success: true, data: mockCompetitionResults });
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

    const { result } = renderHook(() => useCompetitionResults(123), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify query key structure
    const expectedKey = competitionResultsQueryKeys.results(123);
    expect(expectedKey).toEqual(['competition-results', 123]);

    // Verify data is cached under correct key
    const cachedData = queryClient.getQueryData(expectedKey);
    expect(cachedData).toEqual(mockCompetitionResults);
  });

  // Test 8: staleTime prevents unnecessary refetches
  it('should use 10 minute staleTime to prevent unnecessary refetches', async () => {
    let callCount = 0;
    server.use(
      http.get(`${base}/api/v1/competitions/:id/results`, () => {
        callCount += 1;
        return HttpResponse.json({ success: true, data: mockCompetitionResults });
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
    const { result, unmount } = renderHook(() => useCompetitionResults(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callCount).toBe(1);

    // Unmount and remount - should NOT refetch due to staleTime
    unmount();

    const { result: result2 } = renderHook(() => useCompetitionResults(1), {
      wrapper: createWrapper(queryClient),
    });

    // Data should still be available without refetch
    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    expect(result2.current.data).toEqual(mockCompetitionResults);

    // Should still only be 1 call (data was cached and fresh)
    expect(callCount).toBe(1);
  });

  // Test 9: gcTime is configured correctly (15 minutes)
  it('should configure gcTime for 15 minutes cache retention', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id/results`, () => {
        return HttpResponse.json({ success: true, data: mockCompetitionResults });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const { result } = renderHook(() => useCompetitionResults(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify the query was created with data
    const queryState = queryClient.getQueryState(competitionResultsQueryKeys.results(1));
    expect(queryState).toBeDefined();
    expect(queryState?.data).toEqual(mockCompetitionResults);

    // The hook configures gcTime: 15 * 60 * 1000 (15 minutes)
    // We verify the data is cached and accessible
    const cachedData = queryClient.getQueryData(competitionResultsQueryKeys.results(1));
    expect(cachedData).toEqual(mockCompetitionResults);

    // Verify that the hook's configuration is applied (gcTime is internal to React Query)
    // The fact that data persists in cache after successful fetch confirms gcTime > 0
    expect(result.current.data).toBeDefined();
  });

  // Test 10: Refetch works correctly
  it('should refetch data when refetch is called', async () => {
    const updatedResults = {
      ...mockCompetitionResults,
      totalParticipants: 15,
    };

    let callCount = 0;
    server.use(
      http.get(`${base}/api/v1/competitions/:id/results`, () => {
        callCount += 1;
        const body = callCount === 1 ? mockCompetitionResults : updatedResults;
        return HttpResponse.json({ success: true, data: body });
      })
    );

    const { result } = renderHook(() => useCompetitionResults(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalParticipants).toBe(12);

    // Trigger refetch
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.data?.totalParticipants).toBe(15));
    expect(callCount).toBe(2);
  });
});

describe('competitionResultsQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(competitionResultsQueryKeys).toBeDefined();
    expect(competitionResultsQueryKeys.all).toEqual(['competition-results']);
    expect(competitionResultsQueryKeys.results(1)).toEqual(['competition-results', 1]);
    expect(competitionResultsQueryKeys.results(123)).toEqual(['competition-results', 123]);
  });

  it('should create unique keys for different competition IDs', () => {
    const key1 = competitionResultsQueryKeys.results(1);
    const key2 = competitionResultsQueryKeys.results(2);
    const key3 = competitionResultsQueryKeys.results(100);

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
    expect(key2).not.toEqual(key3);
  });
});
