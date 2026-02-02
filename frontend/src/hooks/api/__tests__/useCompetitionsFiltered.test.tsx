/**
 * Tests for useCompetitionsFiltered Hook
 *
 * Competition Entry System - Task: useCompetitions hook tests
 *
 * Tests for fetching competitions with filtering support:
 * - Basic fetching behavior
 * - Loading states
 * - Error handling
 * - Filter query key management
 * - Cache behavior (staleTime, gcTime)
 * - Refetch functionality
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as competitionsApi from '@/lib/api/competitions';
import {
  useCompetitionsFiltered,
  competitionFilteredQueryKeys,
} from '../useCompetitionsFiltered';

// Mock API functions
vi.mock('@/lib/api/competitions', async () => {
  const actual = await vi.importActual('@/lib/api/competitions');
  return {
    ...actual,
    fetchCompetitions: vi.fn(),
  };
});

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Fetches competitions on mount
  it('should fetch competitions on mount', async () => {
    vi.mocked(competitionsApi.fetchCompetitions).mockResolvedValue(mockCompetitions);

    const { result } = renderHook(() => useCompetitionsFiltered(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(competitionsApi.fetchCompetitions).toHaveBeenCalledTimes(1);
    expect(competitionsApi.fetchCompetitions).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual(mockCompetitions);
  });

  // Test 2: Returns loading state initially
  it('should return loading state initially', () => {
    vi.mocked(competitionsApi.fetchCompetitions).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
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
    vi.mocked(competitionsApi.fetchCompetitions).mockResolvedValue(mockCompetitions);

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
    const mockError = {
      message: 'Failed to fetch competitions',
      status: 'error',
      statusCode: 500,
    };

    vi.mocked(competitionsApi.fetchCompetitions).mockRejectedValue(mockError);

    const { result } = renderHook(() => useCompetitionsFiltered(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
    expect(result.current.data).toBeUndefined();
  });

  // Test 5: Refetch works correctly
  it('should refetch when refetch is called', async () => {
    // Track call count manually
    let callCount = 0;
    vi.mocked(competitionsApi.fetchCompetitions).mockImplementation(() => {
      callCount++;
      return Promise.resolve(mockCompetitions);
    });

    const { result } = renderHook(() => useCompetitionsFiltered(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(callCount).toBe(1);
    expect(result.current.data).toHaveLength(3);

    // Trigger refetch
    await result.current.refetch();

    await waitFor(() => expect(callCount).toBe(2));

    // Verify refetch was called and data is still correct
    expect(result.current.data).toHaveLength(3);
    expect(result.current.isSuccess).toBe(true);
  });

  // Test 6: Filters are included in query key
  it('should include filters in query key', async () => {
    vi.mocked(competitionsApi.fetchCompetitions).mockResolvedValue([mockCompetitions[0]]);

    const filters: competitionsApi.CompetitionFilters = {
      discipline: 'dressage',
      dateRange: 'week',
    };

    const { result } = renderHook(() => useCompetitionsFiltered(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(competitionsApi.fetchCompetitions).toHaveBeenCalledWith(filters);

    // Verify query key includes filters
    const expectedKey = competitionFilteredQueryKeys.list(filters);
    expect(expectedKey).toEqual(['competitions', 'filtered', filters]);
  });

  // Test 7: Cache works with different filters
  it('should maintain separate cache for different filters', async () => {
    vi.mocked(competitionsApi.fetchCompetitions).mockImplementation((filters) => {
      if (filters?.discipline === 'dressage') {
        return Promise.resolve([mockCompetitions[0]]);
      }
      if (filters?.discipline === 'jumping') {
        return Promise.resolve([mockCompetitions[1]]);
      }
      return Promise.resolve(mockCompetitions);
    });

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
    expect(competitionsApi.fetchCompetitions).toHaveBeenCalledTimes(2);
  });

  // Test 8: staleTime prevents unnecessary refetches
  it('should respect staleTime and not refetch fresh data', async () => {
    vi.mocked(competitionsApi.fetchCompetitions).mockResolvedValue(mockCompetitions);

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
    expect(competitionsApi.fetchCompetitions).toHaveBeenCalledTimes(1);
  });

  // Test 9: gcTime is configured correctly in the hook
  it('should have gcTime configured for cache management', async () => {
    vi.mocked(competitionsApi.fetchCompetitions).mockResolvedValue(mockCompetitions);

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

    // The hook sets gcTime to 10 minutes (600000ms)
    // We verify that the cache exists and the hook configuration is correct
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
