/**
 * Tests for useAddXp Hook
 *
 * XP System - useAddXp mutation hook tests
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (mzrv2 / Constitution §3: no vi.mock-of-API-client). The hook exercises the
 * real `apiClient` envelope unwrap of `{ success, data }` end-to-end on the
 * POST /api/v1/horses/:horseId/award-xp path.
 *
 * Tests for adding XP to horses:
 * - Mutation function and API calls (real HTTP path + body captured)
 * - Loading and success states (never-resolving handler)
 * - Error handling (HTTP error response)
 * - Query invalidation on success (queryClient spy preserved — orthogonal to API mock)
 * - Correct request structure (body captured + horseId in URL)
 * - Multiple mutation calls (per-handler hit counter)
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { useAddXp } from '../useAddXp';
import { horseLevelInfoQueryKeys } from '../useHorseLevelInfo';
import { xpHistoryQueryKeys } from '../useXpHistory';
import type { AddXpResult, XpGain } from '@/lib/api/xp';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const mockXpGain: XpGain = {
  xpGainId: 'xp-new',
  horseId: 1,
  horseName: 'Thunder',
  source: 'competition',
  sourceId: 123,
  sourceName: 'Show Jumping Classic',
  xpAmount: 50,
  timestamp: '2026-03-15T10:00:00Z',
  oldLevel: 5,
  newLevel: 6,
  oldXp: 450,
  newXp: 500,
  leveledUp: true,
};

const mockAddXpResult: AddXpResult = {
  success: true,
  xpGain: mockXpGain,
  leveledUp: true,
  newLevel: 6,
  message: 'XP added successfully',
};

let queryClient: QueryClient;

const createWrapper = () => {
  queryClient = new QueryClient({
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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useAddXp', () => {
  let calledPaths: string[] = [];
  let capturedBodies: Array<unknown> = [];

  beforeEach(() => {
    calledPaths = [];
    capturedBodies = [];
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  // Test 1: Mutation executes successfully
  it('should execute mutation successfully', async () => {
    server.use(
      http.post(`${base}/api/v1/horses/:horseId/award-xp`, ({ request }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ success: true, data: mockAddXpResult });
      })
    );

    const { result } = renderHook(() => useAddXp(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        horseId: 1,
        xpAmount: 50,
        source: 'competition',
        sourceId: 123,
        sourceName: 'Show Jumping Classic',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calledPaths).toEqual(['/api/v1/horses/1/award-xp']);
    expect(result.current.data).toEqual(mockAddXpResult);
  });

  // Test 2: Returns AddXpResult with success flag
  it('should return AddXpResult with success flag and level-up info', async () => {
    server.use(
      http.post(`${base}/api/v1/horses/:horseId/award-xp`, () => {
        return HttpResponse.json({ success: true, data: mockAddXpResult });
      })
    );

    const { result } = renderHook(() => useAddXp(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        horseId: 1,
        xpAmount: 50,
        source: 'competition',
        sourceId: 123,
        sourceName: 'Show Jumping Classic',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.success).toBe(true);
    expect(result.current.data?.leveledUp).toBe(true);
    expect(result.current.data?.newLevel).toBe(6);
    expect(result.current.data?.message).toBe('XP added successfully');
    expect(result.current.data?.xpGain.xpAmount).toBe(50);
  });

  // Test 3: Calls API with correct request structure
  it('should POST request payload with horseId in URL and rest in body', async () => {
    server.use(
      http.post(`${base}/api/v1/horses/:horseId/award-xp`, async ({ request, params }) => {
        calledPaths.push(new URL(request.url).pathname);
        capturedBodies.push({ horseId: Number(params.horseId), body: await request.json() });
        return HttpResponse.json({ success: true, data: mockAddXpResult });
      })
    );

    const { result } = renderHook(() => useAddXp(), {
      wrapper: createWrapper(),
    });

    const variables = {
      horseId: 42,
      xpAmount: 75,
      source: 'training' as const,
      sourceId: 789,
      sourceName: 'Dressage Training Session',
    };

    await act(async () => {
      result.current.mutate(variables);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // useAddXp extracts horseId out of variables and passes the rest as the body.
    // The real HTTP path verifies horseId is in the URL (route param) and the
    // remaining fields are POSTed as the JSON body.
    const { horseId, ...expectedBody } = variables;
    expect(calledPaths).toEqual([`/api/v1/horses/${horseId}/award-xp`]);
    expect(capturedBodies).toEqual([{ horseId, body: expectedBody }]);
  });

  // Test 4: Invalidates horse level info cache on success
  it('should invalidate horse level info cache on success', async () => {
    server.use(
      http.post(`${base}/api/v1/horses/:horseId/award-xp`, () => {
        return HttpResponse.json({ success: true, data: mockAddXpResult });
      })
    );

    const wrapper = createWrapper();

    // Pre-populate cache with horse level info
    queryClient.setQueryData(horseLevelInfoQueryKeys.horse(1), {
      horseId: 1,
      currentLevel: 5,
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAddXp(), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({
        horseId: 1,
        xpAmount: 50,
        source: 'competition',
        sourceId: 123,
        sourceName: 'Show Jumping Classic',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: horseLevelInfoQueryKeys.horse(1),
      })
    );
  });

  // Test 5: Invalidates XP history cache on success
  it('should invalidate XP history cache for the specific horse on success', async () => {
    server.use(
      http.post(`${base}/api/v1/horses/:horseId/award-xp`, () => {
        return HttpResponse.json({ success: true, data: mockAddXpResult });
      })
    );

    const wrapper = createWrapper();

    // Pre-populate cache with XP history
    queryClient.setQueryData(xpHistoryQueryKeys.horse(1), []);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAddXp(), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({
        horseId: 1,
        xpAmount: 50,
        source: 'competition',
        sourceId: 123,
        sourceName: 'Show Jumping Classic',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: xpHistoryQueryKeys.horse(1),
      })
    );
  });

  // Test 6: Invalidates all XP history queries on success
  it('should invalidate all XP history queries for filtered cache invalidation', async () => {
    server.use(
      http.post(`${base}/api/v1/horses/:horseId/award-xp`, () => {
        return HttpResponse.json({ success: true, data: mockAddXpResult });
      })
    );

    const wrapper = createWrapper();

    // Pre-populate cache with filtered XP history
    queryClient.setQueryData(xpHistoryQueryKeys.filtered(1, { dateRange: '30days' }), []);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAddXp(), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({
        horseId: 1,
        xpAmount: 50,
        source: 'competition',
        sourceId: 123,
        sourceName: 'Show Jumping Classic',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: xpHistoryQueryKeys.all,
      })
    );
  });

  // Test 7: Handles mutation errors
  it('should handle mutation errors correctly', async () => {
    server.use(
      http.post(`${base}/api/v1/horses/:horseId/award-xp`, () => {
        return HttpResponse.json({ success: false, message: 'Horse not found' }, { status: 404 });
      })
    );

    const { result } = renderHook(() => useAddXp(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        horseId: 999,
        xpAmount: 50,
        source: 'competition',
        sourceId: 123,
        sourceName: 'Show Jumping Classic',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.statusCode).toBe(404);
    expect(result.current.error?.message).toBe('Horse not found');
    expect(result.current.data).toBeUndefined();
  });

  // Test 8: isPending state during mutation
  it('should return isPending state during mutation execution', async () => {
    // Never-resolving handler keeps the mutation in `pending` state for the
    // duration of the test.
    server.use(
      http.post(`${base}/api/v1/horses/:horseId/award-xp`, () => {
        return new Promise<never>(() => {
          /* never resolves */
        });
      })
    );

    const { result } = renderHook(() => useAddXp(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        horseId: 1,
        xpAmount: 50,
        source: 'competition',
        sourceId: 123,
        sourceName: 'Show Jumping Classic',
      });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    expect(result.current.isPending).toBe(true);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  // Test 9: Mutation is idle initially
  it('should be idle initially with mutation function defined', () => {
    const { result } = renderHook(() => useAddXp(), {
      wrapper: createWrapper(),
    });

    expect(result.current.mutate).toBeDefined();
    expect(result.current.mutateAsync).toBeDefined();
    expect(typeof result.current.mutate).toBe('function');
    expect(typeof result.current.mutateAsync).toBe('function');
    expect(result.current.isIdle).toBe(true);
    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  // Test 10: Supports onSuccess callback
  it('should call onSuccess callback when XP addition succeeds', async () => {
    server.use(
      http.post(`${base}/api/v1/horses/:horseId/award-xp`, () => {
        return HttpResponse.json({ success: true, data: mockAddXpResult });
      })
    );

    const onSuccessMock = vi.fn();

    const { result } = renderHook(() => useAddXp(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate(
        {
          horseId: 1,
          xpAmount: 50,
          source: 'competition',
          sourceId: 123,
          sourceName: 'Show Jumping Classic',
        },
        { onSuccess: onSuccessMock }
      );
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onSuccessMock).toHaveBeenCalledTimes(1);
  });

  // Test 11: Can be called multiple times
  it('should allow multiple consecutive mutation calls', async () => {
    const result1: AddXpResult = { ...mockAddXpResult, newLevel: 6 };
    const result2: AddXpResult = {
      ...mockAddXpResult,
      newLevel: 7,
      message: 'XP added - another level up!',
    };
    let hitCount = 0;
    const receivedHorseIds: number[] = [];

    server.use(
      http.post(`${base}/api/v1/horses/:horseId/award-xp`, ({ params }) => {
        receivedHorseIds.push(Number(params.horseId));
        const responseData = hitCount === 0 ? result1 : result2;
        hitCount += 1;
        return HttpResponse.json({ success: true, data: responseData });
      })
    );

    const { result } = renderHook(() => useAddXp(), {
      wrapper: createWrapper(),
    });

    // First mutation
    await act(async () => {
      result.current.mutate({
        horseId: 1,
        xpAmount: 50,
        source: 'competition',
        sourceId: 123,
        sourceName: 'Show Jumping Classic',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.newLevel).toBe(6);

    // Second mutation
    await act(async () => {
      result.current.mutate({
        horseId: 1,
        xpAmount: 100,
        source: 'achievement',
        sourceId: 456,
        sourceName: 'First Win',
      });
    });

    await waitFor(() => expect(result.current.data?.newLevel).toBe(7));
    expect(hitCount).toBe(2);
    expect(receivedHorseIds).toEqual([1, 1]);
  });
});
