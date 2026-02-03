/**
 * Tests for useXpHistory Hook
 *
 * XP System - Task: useXpHistory hook tests
 *
 * Tests for fetching XP gain history:
 * - Basic fetching with horse ID
 * - Loading states and data structure
 * - Error handling
 * - Disabled state when horseId is 0 or negative
 * - Query key management with and without filters
 * - Cache behavior (staleTime 5min, gcTime 10min)
 * - Filter support (dateRange, source)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as xpApi from '@/lib/api/xp';
import { useXpHistory, xpHistoryQueryKeys } from '../useXpHistory';
import type { XpGain, XpHistoryFilters } from '@/lib/api/xp';

// Mock API functions
vi.mock('@/lib/api/xp', async () => {
  const actual = await vi.importActual('@/lib/api/xp');
  return {
    ...actual,
    fetchXpHistory: vi.fn(),
  };
});

const mockXpHistory: XpGain[] = [
  {
    xpGainId: 'xp-1',
    horseId: 1,
    horseName: 'Thunder',
    source: 'competition',
    sourceId: 123,
    sourceName: 'Show Jumping Classic',
    xpAmount: 50,
    timestamp: '2026-03-15T10:00:00Z',
    oldLevel: 4,
    newLevel: 5,
    oldXp: 400,
    newXp: 450,
    leveledUp: true,
  },
  {
    xpGainId: 'xp-2',
    horseId: 1,
    horseName: 'Thunder',
    source: 'training',
    sourceId: 456,
    sourceName: 'Dressage Training',
    xpAmount: 25,
    timestamp: '2026-03-10T14:00:00Z',
    oldLevel: 4,
    newLevel: 4,
    oldXp: 375,
    newXp: 400,
    leveledUp: false,
  },
  {
    xpGainId: 'xp-3',
    horseId: 1,
    horseName: 'Thunder',
    source: 'achievement',
    sourceId: 789,
    sourceName: 'First Win Achievement',
    xpAmount: 100,
    timestamp: '2026-02-20T08:00:00Z',
    oldLevel: 3,
    newLevel: 4,
    oldXp: 275,
    newXp: 375,
    leveledUp: true,
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
      },
    });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useXpHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Fetches XP history successfully
  it('should fetch XP history when a valid horseId is provided', async () => {
    vi.mocked(xpApi.fetchXpHistory).mockResolvedValue(mockXpHistory);

    const { result } = renderHook(() => useXpHistory(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(xpApi.fetchXpHistory).toHaveBeenCalledTimes(1);
    expect(xpApi.fetchXpHistory).toHaveBeenCalledWith(1, undefined);
    expect(result.current.data).toEqual(mockXpHistory);
  });

  // Test 2: Returns array of XpGain entries
  it('should return array of XpGain entries with correct structure', async () => {
    vi.mocked(xpApi.fetchXpHistory).mockResolvedValue(mockXpHistory);

    const { result } = renderHook(() => useXpHistory(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
    const firstEntry = result.current.data?.[0];
    expect(firstEntry?.xpGainId).toBe('xp-1');
    expect(firstEntry?.source).toBe('competition');
    expect(firstEntry?.xpAmount).toBe(50);
    expect(firstEntry?.leveledUp).toBe(true);
    expect(firstEntry?.oldLevel).toBe(4);
    expect(firstEntry?.newLevel).toBe(5);
  });

  // Test 3: Uses correct query key without filters
  it('should use correct query key without filters', async () => {
    vi.mocked(xpApi.fetchXpHistory).mockResolvedValue(mockXpHistory);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    const { result } = renderHook(() => useXpHistory(42), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify data is cached under correct key (no filters)
    const expectedKey = xpHistoryQueryKeys.horse(42);
    expect(expectedKey).toEqual(['xpHistory', 42]);

    const cachedData = queryClient.getQueryData(expectedKey);
    expect(cachedData).toEqual(mockXpHistory);
  });

  // Test 4: Uses filtered query key with filters
  it('should use filtered query key when filters are provided', async () => {
    vi.mocked(xpApi.fetchXpHistory).mockResolvedValue(mockXpHistory);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    const filters: XpHistoryFilters = { dateRange: '30days', source: 'competition' };

    const { result } = renderHook(() => useXpHistory(42, filters), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify data is cached under filtered key
    const expectedKey = xpHistoryQueryKeys.filtered(42, filters);
    expect(expectedKey).toEqual(['xpHistory', 42, filters]);

    const cachedData = queryClient.getQueryData(expectedKey);
    expect(cachedData).toEqual(mockXpHistory);

    // Verify API was called with filters
    expect(xpApi.fetchXpHistory).toHaveBeenCalledWith(42, filters);
  });

  // Test 5: Respects staleTime (5 minutes)
  it('should use 5 minute staleTime to prevent unnecessary refetches', async () => {
    vi.mocked(xpApi.fetchXpHistory).mockResolvedValue(mockXpHistory);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // First render - should fetch
    const { result, unmount } = renderHook(() => useXpHistory(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(xpApi.fetchXpHistory).toHaveBeenCalledTimes(1);

    // Unmount and remount - should NOT refetch due to staleTime
    unmount();

    const { result: result2 } = renderHook(() => useXpHistory(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    expect(result2.current.data).toEqual(mockXpHistory);

    // Should still only be 1 call
    expect(xpApi.fetchXpHistory).toHaveBeenCalledTimes(1);
  });

  // Test 6: Respects gcTime (10 minutes)
  it('should use 10 minute gcTime for cache retention', async () => {
    vi.mocked(xpApi.fetchXpHistory).mockResolvedValue(mockXpHistory);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const { result } = renderHook(() => useXpHistory(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify cache exists after successful fetch
    const cacheEntry = queryClient.getQueryCache().find({
      queryKey: xpHistoryQueryKeys.horse(1),
    });
    expect(cacheEntry).toBeDefined();
    expect(cacheEntry?.state.data).toEqual(mockXpHistory);
  });

  // Test 7: Disabled when horseId is 0 or negative
  it('should not fetch when horseId is 0', () => {
    vi.mocked(xpApi.fetchXpHistory).mockResolvedValue(mockXpHistory);

    const { result } = renderHook(() => useXpHistory(0), {
      wrapper: createWrapper(),
    });

    expect(xpApi.fetchXpHistory).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('should not fetch when horseId is negative', () => {
    vi.mocked(xpApi.fetchXpHistory).mockResolvedValue(mockXpHistory);

    const { result } = renderHook(() => useXpHistory(-5), {
      wrapper: createWrapper(),
    });

    expect(xpApi.fetchXpHistory).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
  });

  // Test 8: Handles API errors
  it('should handle API errors correctly', async () => {
    const mockError = {
      message: 'Horse not found',
      status: 404,
      code: 'NOT_FOUND',
    };

    vi.mocked(xpApi.fetchXpHistory).mockRejectedValue(mockError);

    const { result } = renderHook(() => useXpHistory(999), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
    expect(result.current.data).toBeUndefined();
  });
});

describe('xpHistoryQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(xpHistoryQueryKeys).toBeDefined();
    expect(xpHistoryQueryKeys.all).toEqual(['xpHistory']);
    expect(xpHistoryQueryKeys.horse(1)).toEqual(['xpHistory', 1]);
  });

  it('should create filtered keys with filter objects', () => {
    const filters: XpHistoryFilters = { dateRange: '7days', source: 'training' };
    const key = xpHistoryQueryKeys.filtered(1, filters);
    expect(key).toEqual(['xpHistory', 1, filters]);
  });

  it('should create unique keys for different horses and filters', () => {
    const key1 = xpHistoryQueryKeys.horse(1);
    const key2 = xpHistoryQueryKeys.horse(2);
    const key3 = xpHistoryQueryKeys.filtered(1, { dateRange: '7days' });

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
  });
});
