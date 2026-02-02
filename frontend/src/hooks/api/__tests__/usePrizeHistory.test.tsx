/**
 * Tests for usePrizeHistory Hook
 *
 * Prize System - Task: usePrizeHistory hook tests
 *
 * Tests for fetching user prize transaction history:
 * - Basic fetching with user ID
 * - Loading states
 * - Error handling
 * - Disabled state when userId is empty
 * - Query key management with filters
 * - Cache behavior (staleTime, gcTime)
 * - Filter support
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as prizesApi from '@/lib/api/prizes';
import { usePrizeHistory, prizeHistoryQueryKeys } from '../usePrizeHistory';
import type { PrizeTransaction, TransactionFilters } from '@/lib/api/prizes';

// Mock API functions
vi.mock('@/lib/api/prizes', async () => {
  const actual = await vi.importActual('@/lib/api/prizes');
  return {
    ...actual,
    fetchPrizeHistory: vi.fn(),
  };
});

const mockPrizeHistory: PrizeTransaction[] = [
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
    transactionId: 'txn-002',
    date: '2026-02-10T14:00:00Z',
    competitionId: 2,
    competitionName: 'Winter Jumping Series',
    horseId: 2,
    horseName: 'Storm',
    discipline: 'jumping',
    placement: 2,
    prizeMoney: 1500,
    xpGained: 100,
    claimed: true,
    claimedAt: '2026-02-10T16:00:00Z',
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
];

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

describe('usePrizeHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Fetches prize history on mount
  it('should fetch prize history when userId is provided', async () => {
    vi.mocked(prizesApi.fetchPrizeHistory).mockResolvedValue(mockPrizeHistory);

    const { result } = renderHook(() => usePrizeHistory('user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(prizesApi.fetchPrizeHistory).toHaveBeenCalledTimes(1);
    expect(prizesApi.fetchPrizeHistory).toHaveBeenCalledWith('user-123', undefined);
    expect(result.current.data).toEqual(mockPrizeHistory);
  });

  // Test 2: Returns loading state initially
  it('should return loading state initially', () => {
    vi.mocked(prizesApi.fetchPrizeHistory).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    );

    const { result } = renderHook(() => usePrizeHistory('user-123'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  // Test 3: Returns data after successful fetch
  it('should return data after successful fetch with complete structure', async () => {
    vi.mocked(prizesApi.fetchPrizeHistory).mockResolvedValue(mockPrizeHistory);

    const { result } = renderHook(() => usePrizeHistory('user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.[0].transactionId).toBe('txn-001');
    expect(result.current.data?.[0].competitionName).toBe('Spring Dressage Championship');
    expect(result.current.data?.[0].prizeMoney).toBe(2500);
    expect(result.current.data?.[0].claimed).toBe(true);
    expect(result.current.data?.[2].claimed).toBe(false);
  });

  // Test 4: Handles fetch error correctly
  it('should handle fetch error correctly', async () => {
    const mockError = {
      message: 'User not found',
      status: 'error',
      statusCode: 404,
    };

    vi.mocked(prizesApi.fetchPrizeHistory).mockRejectedValue(mockError);

    const { result } = renderHook(() => usePrizeHistory('error-user'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
    expect(result.current.data).toBeUndefined();
  });

  // Test 5: Refetch works correctly
  it('should refetch data when refetch is called', async () => {
    const updatedHistory = [
      ...mockPrizeHistory,
      {
        transactionId: 'txn-004',
        date: '2026-03-20T10:00:00Z',
        competitionId: 4,
        competitionName: 'New Competition',
        horseId: 1,
        horseName: 'Thunder',
        discipline: 'dressage',
        placement: 1,
        prizeMoney: 3000,
        xpGained: 175,
        claimed: false,
      },
    ];

    vi.mocked(prizesApi.fetchPrizeHistory)
      .mockResolvedValueOnce(mockPrizeHistory)
      .mockResolvedValueOnce(updatedHistory);

    const { result } = renderHook(() => usePrizeHistory('user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(3);

    // Trigger refetch
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.data).toHaveLength(4));
    expect(prizesApi.fetchPrizeHistory).toHaveBeenCalledTimes(2);
  });

  // Test 6: Filters are included in query key
  it('should include filters in API call', async () => {
    vi.mocked(prizesApi.fetchPrizeHistory).mockResolvedValue(mockPrizeHistory);

    const filters: TransactionFilters = {
      dateRange: '30days',
      horseId: 1,
      discipline: 'dressage',
    };

    const { result } = renderHook(() => usePrizeHistory('user-123', filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(prizesApi.fetchPrizeHistory).toHaveBeenCalledWith('user-123', filters);
  });

  // Test 7: Cache works with different filters
  it('should create separate cache entries for different filters', async () => {
    vi.mocked(prizesApi.fetchPrizeHistory).mockResolvedValue(mockPrizeHistory);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const filters1: TransactionFilters = { dateRange: '7days' };
    const filters2: TransactionFilters = { dateRange: '30days' };

    // First render with filters1
    const { result: result1, unmount: unmount1 } = renderHook(
      () => usePrizeHistory('user-123', filters1),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result1.current.isSuccess).toBe(true));

    // Second render with filters2
    const { result: result2 } = renderHook(() => usePrizeHistory('user-123', filters2), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result2.current.isSuccess).toBe(true));

    // Should have been called twice with different filters
    expect(prizesApi.fetchPrizeHistory).toHaveBeenCalledTimes(2);
    expect(prizesApi.fetchPrizeHistory).toHaveBeenCalledWith('user-123', filters1);
    expect(prizesApi.fetchPrizeHistory).toHaveBeenCalledWith('user-123', filters2);

    unmount1();
  });

  // Test 8: staleTime prevents unnecessary refetches
  it('should use 5 minute staleTime to prevent unnecessary refetches', async () => {
    vi.mocked(prizesApi.fetchPrizeHistory).mockResolvedValue(mockPrizeHistory);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // First render - should fetch
    const { result, unmount } = renderHook(() => usePrizeHistory('user-123'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(prizesApi.fetchPrizeHistory).toHaveBeenCalledTimes(1);

    // Unmount and remount - should NOT refetch due to staleTime
    unmount();

    const { result: result2 } = renderHook(() => usePrizeHistory('user-123'), {
      wrapper: createWrapper(queryClient),
    });

    // Data should still be available without refetch
    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    expect(result2.current.data).toEqual(mockPrizeHistory);

    // Should still only be 1 call (data was cached and fresh)
    expect(prizesApi.fetchPrizeHistory).toHaveBeenCalledTimes(1);
  });

  // Test 9: Disabled when userId is empty
  it('should not fetch when userId is empty string', () => {
    vi.mocked(prizesApi.fetchPrizeHistory).mockResolvedValue(mockPrizeHistory);

    const { result } = renderHook(() => usePrizeHistory(''), {
      wrapper: createWrapper(),
    });

    // Should not call API when userId is empty
    expect(prizesApi.fetchPrizeHistory).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  // Test 10: Query key structure is correct
  it('should use correct query key structure', async () => {
    vi.mocked(prizesApi.fetchPrizeHistory).mockResolvedValue(mockPrizeHistory);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    const filters: TransactionFilters = { dateRange: '7days' };

    const { result } = renderHook(() => usePrizeHistory('user-123', filters), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify query key structure
    const expectedKey = prizeHistoryQueryKeys.history('user-123', filters);
    expect(expectedKey).toEqual(['prizes', 'history', 'user-123', filters]);

    // Verify data is cached under correct key
    const cachedData = queryClient.getQueryData(expectedKey);
    expect(cachedData).toEqual(mockPrizeHistory);
  });
});

describe('prizeHistoryQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(prizeHistoryQueryKeys).toBeDefined();
    expect(prizeHistoryQueryKeys.all).toEqual(['prizes', 'history']);
    expect(prizeHistoryQueryKeys.history('user-1')).toEqual(['prizes', 'history', 'user-1', undefined]);
    expect(prizeHistoryQueryKeys.history('user-1', { dateRange: '7days' })).toEqual([
      'prizes',
      'history',
      'user-1',
      { dateRange: '7days' },
    ]);
  });

  it('should create unique keys for different users and filters', () => {
    const key1 = prizeHistoryQueryKeys.history('user-1');
    const key2 = prizeHistoryQueryKeys.history('user-2');
    const key3 = prizeHistoryQueryKeys.history('user-1', { dateRange: '7days' });

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
    expect(key2).not.toEqual(key3);
  });
});
