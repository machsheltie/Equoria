/**
 * Tests for useHorseLevelInfo Hook
 *
 * XP System - useHorseLevelInfo hook tests
 *
 * Tests for fetching horse level and XP progress:
 * - Basic fetching with horse ID
 * - Loading states
 * - Error handling
 * - Disabled state when horseId is 0 or negative
 * - Query key management
 * - Cache behavior (staleTime 2min, gcTime 5min)
 * - Correct data structure validation
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (mzrv2 / Constitution §3: no vi.mock-of-API-client). The hook exercises
 * the real `apiClient` envelope unwrap end-to-end.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { useHorseLevelInfo, horseLevelInfoQueryKeys } from '../useHorseLevelInfo';
import type { HorseLevelInfo } from '@/lib/api/xp';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
  let calledPaths: string[] = [];

  beforeEach(() => {
    calledPaths = [];
  });

  // Test 1: Fetches level info successfully
  it('should fetch level info when a valid horseId is provided', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/xp`, ({ request, params }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({
          success: true,
          data: { ...mockLevelInfo, horseId: Number(params.horseId) },
        });
      })
    );

    const { result } = renderHook(() => useHorseLevelInfo(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calledPaths).toEqual(['/api/v1/horses/1/xp']);
    expect(result.current.data).toEqual(mockLevelInfo);
  });

  // Test 2: Returns correct data structure
  it('should return correct data structure with all fields', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/xp`, () => {
        return HttpResponse.json({ success: true, data: mockLevelInfo });
      })
    );

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
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/xp`, () => {
        return HttpResponse.json({ success: true, data: mockLevelInfo });
      })
    );

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
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/xp`, ({ request }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ success: true, data: mockLevelInfo });
      })
    );

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
    expect(calledPaths).toHaveLength(1);

    // Unmount and remount - should NOT refetch due to staleTime
    unmount();

    const { result: result2 } = renderHook(() => useHorseLevelInfo(1), {
      wrapper: createWrapper(queryClient),
    });

    // Data should still be available without refetch
    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    expect(result2.current.data).toEqual(mockLevelInfo);

    // Should still only be 1 call (data was cached and fresh)
    expect(calledPaths).toHaveLength(1);
  });

  // Test 5: Respects gcTime (5 minutes)
  it('should use 5 minute gcTime for cache retention', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/xp`, () => {
        return HttpResponse.json({ success: true, data: mockLevelInfo });
      })
    );

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
  it('should not fetch when horseId is 0', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/xp`, ({ request }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ success: true, data: mockLevelInfo });
      })
    );

    const { result } = renderHook(() => useHorseLevelInfo(0), {
      wrapper: createWrapper(),
    });

    expect(calledPaths).toEqual([]);
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('should not fetch when horseId is negative', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/xp`, ({ request }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ success: true, data: mockLevelInfo });
      })
    );

    const { result } = renderHook(() => useHorseLevelInfo(-1), {
      wrapper: createWrapper(),
    });

    expect(calledPaths).toEqual([]);
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
  });

  // Test 7: Handles API errors
  it('should handle API errors correctly', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/xp`, () => {
        return HttpResponse.json(
          { success: false, message: 'Horse not found' },
          { status: 404 }
        );
      })
    );

    const { result } = renderHook(() => useHorseLevelInfo(999), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.statusCode).toBe(404);
    expect(result.current.error?.message).toBe('Horse not found');
    expect(result.current.data).toBeUndefined();
  });

  // Test 8: Loading state management
  it('should return loading state initially', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/xp`, async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: mockLevelInfo });
      })
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
