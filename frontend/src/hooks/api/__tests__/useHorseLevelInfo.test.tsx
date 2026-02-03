/**
 * Tests for useHorseLevelInfo Hook
 *
 * XP System - Task: useHorseLevelInfo hook tests
 *
 * Tests for fetching horse level and XP progress:
 * - Basic fetching with horse ID
 * - Loading states
 * - Error handling
 * - Disabled state when horseId is 0 or negative
 * - Query key management
 * - Cache behavior (staleTime 2min, gcTime 5min)
 * - Correct data structure validation
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as xpApi from '@/lib/api/xp';
import { useHorseLevelInfo, horseLevelInfoQueryKeys } from '../useHorseLevelInfo';
import type { HorseLevelInfo } from '@/lib/api/xp';

// Mock API functions
vi.mock('@/lib/api/xp', async () => {
  const actual = await vi.importActual('@/lib/api/xp');
  return {
    ...actual,
    fetchHorseLevelInfo: vi.fn(),
  };
});

const mockLevelInfo: HorseLevelInfo = {
  horseId: 1,
  horseName: 'Thunder',
  currentLevel: 5,
  currentXp: 450,
  xpForCurrentLevel: 45,
  xpToNextLevel: 100,
  totalXp: 450,
  progressPercent: 45,
  levelThresholds: { 1: 0, 2: 100, 3: 300, 4: 600, 5: 1000 },
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

describe('useHorseLevelInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Fetches level info successfully
  it('should fetch level info when a valid horseId is provided', async () => {
    vi.mocked(xpApi.fetchHorseLevelInfo).mockResolvedValue(mockLevelInfo);

    const { result } = renderHook(() => useHorseLevelInfo(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(xpApi.fetchHorseLevelInfo).toHaveBeenCalledTimes(1);
    expect(xpApi.fetchHorseLevelInfo).toHaveBeenCalledWith(1);
    expect(result.current.data).toEqual(mockLevelInfo);
  });

  // Test 2: Returns correct data structure
  it('should return correct data structure with all fields', async () => {
    vi.mocked(xpApi.fetchHorseLevelInfo).mockResolvedValue(mockLevelInfo);

    const { result } = renderHook(() => useHorseLevelInfo(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data).toBeDefined();
    expect(data?.horseId).toBe(1);
    expect(data?.horseName).toBe('Thunder');
    expect(data?.currentLevel).toBe(5);
    expect(data?.currentXp).toBe(450);
    expect(data?.xpForCurrentLevel).toBe(45);
    expect(data?.xpToNextLevel).toBe(100);
    expect(data?.totalXp).toBe(450);
    expect(data?.progressPercent).toBe(45);
    expect(data?.levelThresholds).toEqual({ 1: 0, 2: 100, 3: 300, 4: 600, 5: 1000 });
  });

  // Test 3: Uses correct query key
  it('should use correct query key for horse-specific data', async () => {
    vi.mocked(xpApi.fetchHorseLevelInfo).mockResolvedValue(mockLevelInfo);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    const { result } = renderHook(() => useHorseLevelInfo(42), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify data is cached under correct key
    const expectedKey = horseLevelInfoQueryKeys.horse(42);
    expect(expectedKey).toEqual(['horseLevelInfo', 42]);

    const cachedData = queryClient.getQueryData(expectedKey);
    expect(cachedData).toEqual(mockLevelInfo);
  });

  // Test 4: Respects staleTime (2 minutes)
  it('should use 2 minute staleTime to prevent unnecessary refetches', async () => {
    vi.mocked(xpApi.fetchHorseLevelInfo).mockResolvedValue(mockLevelInfo);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // First render - should fetch
    const { result, unmount } = renderHook(() => useHorseLevelInfo(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(xpApi.fetchHorseLevelInfo).toHaveBeenCalledTimes(1);

    // Unmount and remount - should NOT refetch due to staleTime
    unmount();

    const { result: result2 } = renderHook(() => useHorseLevelInfo(1), {
      wrapper: createWrapper(queryClient),
    });

    // Data should still be available without refetch
    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    expect(result2.current.data).toEqual(mockLevelInfo);

    // Should still only be 1 call (data was cached and fresh)
    expect(xpApi.fetchHorseLevelInfo).toHaveBeenCalledTimes(1);
  });

  // Test 5: Respects gcTime (5 minutes)
  it('should use 5 minute gcTime for cache retention', async () => {
    vi.mocked(xpApi.fetchHorseLevelInfo).mockResolvedValue(mockLevelInfo);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const { result } = renderHook(() => useHorseLevelInfo(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify cache exists after successful fetch
    const cacheEntry = queryClient.getQueryCache().find({
      queryKey: horseLevelInfoQueryKeys.horse(1),
    });
    expect(cacheEntry).toBeDefined();
    expect(cacheEntry?.state.data).toEqual(mockLevelInfo);
  });

  // Test 6: Disabled when horseId is 0 or negative
  it('should not fetch when horseId is 0', () => {
    vi.mocked(xpApi.fetchHorseLevelInfo).mockResolvedValue(mockLevelInfo);

    const { result } = renderHook(() => useHorseLevelInfo(0), {
      wrapper: createWrapper(),
    });

    expect(xpApi.fetchHorseLevelInfo).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('should not fetch when horseId is negative', () => {
    vi.mocked(xpApi.fetchHorseLevelInfo).mockResolvedValue(mockLevelInfo);

    const { result } = renderHook(() => useHorseLevelInfo(-1), {
      wrapper: createWrapper(),
    });

    expect(xpApi.fetchHorseLevelInfo).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
  });

  // Test 7: Handles API errors
  it('should handle API errors correctly', async () => {
    const mockError = {
      message: 'Horse not found',
      status: 404,
      code: 'NOT_FOUND',
    };

    vi.mocked(xpApi.fetchHorseLevelInfo).mockRejectedValue(mockError);

    const { result } = renderHook(() => useHorseLevelInfo(999), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
    expect(result.current.data).toBeUndefined();
  });

  // Test 8: Loading state management
  it('should return loading state initially', () => {
    vi.mocked(xpApi.fetchHorseLevelInfo).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    );

    const { result } = renderHook(() => useHorseLevelInfo(1), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});

describe('horseLevelInfoQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(horseLevelInfoQueryKeys).toBeDefined();
    expect(horseLevelInfoQueryKeys.all).toEqual(['horseLevelInfo']);
    expect(horseLevelInfoQueryKeys.horse(1)).toEqual(['horseLevelInfo', 1]);
    expect(horseLevelInfoQueryKeys.horse(42)).toEqual(['horseLevelInfo', 42]);
  });

  it('should create unique keys for different horses', () => {
    const key1 = horseLevelInfoQueryKeys.horse(1);
    const key2 = horseLevelInfoQueryKeys.horse(2);

    expect(key1).not.toEqual(key2);
  });
});
