/**
 * Tests for useCompetitionsFiltered Hook
 *
 * Competition Entry System - useCompetitionsFiltered hook tests
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (mzrv2 / Constitution §3: no vi.mock-of-API-client). The hook exercises the
 * real `apiClient` envelope unwrap of `{ success, data }` end-to-end. The
 * underlying GET is /api/v1/competitions with optional filter querystring
 * params (discipline, dateRange, entryFee) emitted by `buildFilterQuery`;
 * captured handlers track both pathname AND search per request.
 *
 * Tests for fetching competitions with filtering support:
 * - Basic fetching behavior
 * - Loading states
 * - Error handling
 * - Filter query key management + querystring propagation
 * - Cache behavior (staleTime, gcTime)
 * - Refetch functionality
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import * as competitionsApi from '@/lib/api/competitions';
import { useCompetitionsFiltered, competitionFilteredQueryKeys } from '../useCompetitionsFiltered';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const mockCompetitions: competitionsApi.CompetitionData[] = [
  {
    id: 1,
    name: 'Spring Dressage Championship',
    discipline: 'dressage',
    date: '2026-03-15T10:00:00Z',
    entryFee: 50,
    maxEntries: 20,
    currentEntries: 12,
    status: 'open',
    prizePool: 5000,
    location: 'Central Arena',
  },
  {
    id: 2,
    name: 'Weekly Jumping Series',
    discipline: 'jumping',
    date: '2026-02-10T14:00:00Z',
    entryFee: 25,
    maxEntries: 30,
    currentEntries: 28,
    status: 'open',
    prizePool: 2500,
  },
  {
    id: 3,
    name: 'Free Training Show',
    discipline: 'eventing',
    date: '2026-02-05T09:00:00Z',
    entryFee: 0,
    maxEntries: 50,
    currentEntries: 15,
    status: 'open',
  },
];

interface CapturedRequest {
  pathname: string;
  search: string;
}

const createWrapper = (staleTime?: number) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: staleTime ?? 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useCompetitionsFiltered', () => {
  let captured: CapturedRequest[] = [];

  beforeEach(() => {
    captured = [];
  });

  // Test 1: Fetches competitions on mount
  it('should fetch competitions on mount', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions`, ({ request }) => {
        const url = new URL(request.url);
        captured.push({ pathname: url.pathname, search: url.search });
        return HttpResponse.json({ success: true, data: mockCompetitions });
      })
    );

    const { result } = renderHook(() => useCompetitionsFiltered(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(captured).toHaveLength(1);
    expect(captured[0].pathname).toBe('/api/v1/competitions');
    // No filters → no querystring (buildFilterQuery returns '')
    expect(captured[0].search).toBe('');
    expect(result.current.data).toEqual(mockCompetitions);
  });

  // Test 2: Returns loading state initially
  it('should return loading state initially', () => {
    server.use(
      http.get(`${base}/api/v1/competitions`, async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: mockCompetitions });
      })
    );

    const { result } = renderHook(() => useCompetitionsFiltered(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  // Test 3: Returns data after successful fetch
  it('should return data after successful fetch', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions`, () => {
        return HttpResponse.json({ success: true, data: mockCompetitions });
      })
    );

    const { result } = renderHook(() => useCompetitionsFiltered(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.[0].name).toBe('Spring Dressage Championship');
    expect(result.current.data?.[1].discipline).toBe('jumping');
    expect(result.current.data?.[2].entryFee).toBe(0);
  });

  // Test 4: Handles fetch error correctly
  it('should handle fetch error correctly', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions`, () => {
        return HttpResponse.json(
          { success: false, message: 'Failed to fetch competitions' },
          { status: 500 }
        );
      })
    );

    const { result } = renderHook(() => useCompetitionsFiltered(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.statusCode).toBe(500);
    expect(result.current.error?.message).toBe('Failed to fetch competitions');
    expect(result.current.data).toBeUndefined();
  });

  // Test 5: Refetch works correctly
  it('should refetch when refetch is called', async () => {
    let callCount = 0;
    server.use(
      http.get(`${base}/api/v1/competitions`, () => {
        callCount += 1;
        return HttpResponse.json({ success: true, data: mockCompetitions });
      })
    );

    const { result } = renderHook(() => useCompetitionsFiltered(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(callCount).toBe(1);
    expect(result.current.data).toHaveLength(3);

    // Trigger refetch
    await result.current.refetch();

    await waitFor(() => expect(callCount).toBe(2));

    expect(result.current.data).toHaveLength(3);
    expect(result.current.isSuccess).toBe(true);
  });

  // Test 6: Filters are included in query key + transmitted as querystring
  it('should include filters in query key and transmit them as querystring', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions`, ({ request }) => {
        const url = new URL(request.url);
        captured.push({ pathname: url.pathname, search: url.search });
        return HttpResponse.json({ success: true, data: [mockCompetitions[0]] });
      })
    );

    const filters: competitionsApi.CompetitionFilters = {
      discipline: 'dressage',
      dateRange: 'week',
    };

    const { result } = renderHook(() => useCompetitionsFiltered(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(captured).toHaveLength(1);
    expect(captured[0].pathname).toBe('/api/v1/competitions');
    expect(captured[0].search).toContain('discipline=dressage');
    expect(captured[0].search).toContain('dateRange=week');

    // Verify query key includes filters
    const expectedKey = competitionFilteredQueryKeys.list(filters);
    expect(expectedKey).toEqual(['competitions', 'filtered', filters]);
  });

  // Test 7: Cache works with different filters
  it('should maintain separate cache for different filters', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions`, ({ request }) => {
        const url = new URL(request.url);
        captured.push({ pathname: url.pathname, search: url.search });
        const discipline = url.searchParams.get('discipline');
        if (discipline === 'dressage') {
          return HttpResponse.json({ success: true, data: [mockCompetitions[0]] });
        }
        if (discipline === 'jumping') {
          return HttpResponse.json({ success: true, data: [mockCompetitions[1]] });
        }
        return HttpResponse.json({ success: true, data: mockCompetitions });
      })
    );

    // First render with dressage filter
    const { result: result1 } = renderHook(
      () => useCompetitionsFiltered({ discipline: 'dressage' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result1.current.isSuccess).toBe(true));
    expect(result1.current.data).toHaveLength(1);
    expect(result1.current.data?.[0].discipline).toBe('dressage');

    // Second render with jumping filter
    const { result: result2 } = renderHook(
      () => useCompetitionsFiltered({ discipline: 'jumping' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    expect(result2.current.data).toHaveLength(1);
    expect(result2.current.data?.[0].discipline).toBe('jumping');

    // Both calls should have been made (separate cache keys)
    expect(captured).toHaveLength(2);
    expect(captured[0].search).toContain('discipline=dressage');
    expect(captured[1].search).toContain('discipline=jumping');
  });

  // Test 8: staleTime prevents unnecessary refetches
  it('should respect staleTime and not refetch fresh data', async () => {
    let callCount = 0;
    server.use(
      http.get(`${base}/api/v1/competitions`, () => {
        callCount += 1;
        return HttpResponse.json({ success: true, data: mockCompetitions });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 5 * 60 * 1000, // 5 minutes
          gcTime: 10 * 60 * 1000,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCompetitionsFiltered(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isStale).toBe(false);

    // Data should be fresh
    expect(result.current.data).toEqual(mockCompetitions);
    expect(callCount).toBe(1);
  });

  // Test 9: gcTime is configured correctly in the hook
  it('should have gcTime configured for cache management', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions`, () => {
        return HttpResponse.json({ success: true, data: mockCompetitions });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCompetitionsFiltered(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify data is cached
    expect(result.current.data).toEqual(mockCompetitions);

    // Verify the query is in the cache
    const cachedData = queryClient.getQueryData(competitionFilteredQueryKeys.list());
    expect(cachedData).toEqual(mockCompetitions);

    // The hook sets gcTime to 5 minutes; we verify the cache exists.
    const queryState = queryClient.getQueryState(competitionFilteredQueryKeys.list());
    expect(queryState).toBeDefined();
    expect(queryState?.data).toEqual(mockCompetitions);
  });
});

describe('competitionFilteredQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(competitionFilteredQueryKeys).toBeDefined();
    expect(competitionFilteredQueryKeys.all).toEqual(['competitions', 'filtered']);
    expect(competitionFilteredQueryKeys.list()).toEqual(['competitions', 'filtered', undefined]);
    expect(competitionFilteredQueryKeys.list({ discipline: 'dressage' })).toEqual([
      'competitions',
      'filtered',
      { discipline: 'dressage' },
    ]);
  });

  it('should create unique keys for different filter combinations', () => {
    const key1 = competitionFilteredQueryKeys.list({ discipline: 'dressage' });
    const key2 = competitionFilteredQueryKeys.list({ discipline: 'jumping' });
    const key3 = competitionFilteredQueryKeys.list({ discipline: 'dressage', dateRange: 'week' });

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
    expect(key2).not.toEqual(key3);
  });
});
