/**
 * Tests for useClaimPrizes Hook
 *
 * Prize System - useClaimPrizes mutation hook tests
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (mzrv2 / Constitution §3: no vi.mock-of-API-client). The hook exercises the
 * real `apiClient` envelope unwrap of `{ success, data }` end-to-end on the
 * POST /api/v1/competition/:competitionId/claim-prizes path.
 *
 * Tests for claiming competition prizes:
 * - Mutation function and API calls (real HTTP path captured)
 * - Loading and success states (never-resolving handler)
 * - Error handling (HTTP error response)
 * - Query invalidation on success (queryClient spy preserved — orthogonal to API mock)
 * - Callback support (onSuccess, onError)
 * - Multiple mutation calls (per-handler hit counter)
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import type * as prizesApi from '@/lib/api/prizes';
import { useClaimPrizes } from '../useClaimPrizes';
import { prizeHistoryQueryKeys } from '../usePrizeHistory';
import { horsePrizeSummaryQueryKeys } from '../useHorsePrizeSummary';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const mockClaimResult: prizesApi.PrizeClaimResult = {
  success: true,
  prizesClaimed: [
    {
      horseId: 1,
      horseName: 'Thunder',
      competitionId: 1,
      competitionName: 'Spring Dressage Championship',
      discipline: 'dressage',
      date: '2026-03-15T10:00:00Z',
      placement: 1,
      totalParticipants: 12,
      prizeMoney: 2500,
      xpGained: 150,
      claimed: true,
      claimedAt: '2026-03-15T14:00:00Z',
    },
  ],
  newBalance: 10500,
  message: 'Successfully claimed 1 prize totaling $2500',
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

describe('useClaimPrizes', () => {
  let calledPaths: string[] = [];

  beforeEach(() => {
    calledPaths = [];
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  // Test 1: Mutation is idle initially
  it('should be idle initially with mutation function defined', () => {
    const { result } = renderHook(() => useClaimPrizes(), {
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

  // Test 2: Calls API endpoint when mutate is called
  it('should call claim-prizes endpoint with correct competitionId in URL', async () => {
    server.use(
      http.post(`${base}/api/v1/competition/:competitionId/claim-prizes`, ({ request }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ success: true, data: mockClaimResult });
      })
    );

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 123 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calledPaths).toEqual(['/api/v1/competition/123/claim-prizes']);
  });

  // Test 3: Returns success result on successful claim
  it('should return success result with prize claim data', async () => {
    server.use(
      http.post(`${base}/api/v1/competition/:competitionId/claim-prizes`, () => {
        return HttpResponse.json({ success: true, data: mockClaimResult });
      })
    );

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 1 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockClaimResult);
    expect(result.current.data?.success).toBe(true);
    expect(result.current.data?.prizesClaimed).toHaveLength(1);
    expect(result.current.data?.newBalance).toBe(10500);
    expect(result.current.data?.message).toContain('$2500');
  });

  // Test 4: Returns error on failed claim
  it('should handle claim error correctly', async () => {
    server.use(
      http.post(`${base}/api/v1/competition/:competitionId/claim-prizes`, () => {
        return HttpResponse.json(
          { success: false, message: 'Competition not found' },
          { status: 404 }
        );
      })
    );

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 999 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.statusCode).toBe(404);
    expect(result.current.error?.message).toBe('Competition not found');
    expect(result.current.data).toBeUndefined();
  });

  // Test 5: Invalidates prize history cache on success
  it('should invalidate prize history query on success', async () => {
    server.use(
      http.post(`${base}/api/v1/competition/:competitionId/claim-prizes`, () => {
        return HttpResponse.json({ success: true, data: mockClaimResult });
      })
    );

    const wrapper = createWrapper();

    // Pre-populate cache with prize history
    queryClient.setQueryData(prizeHistoryQueryKeys.all, []);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({ competitionId: 1 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: prizeHistoryQueryKeys.all,
      })
    );
  });

  // Test 6: Invalidates horse prize summary cache on success
  it('should invalidate horse prize summary query on success', async () => {
    server.use(
      http.post(`${base}/api/v1/competition/:competitionId/claim-prizes`, () => {
        return HttpResponse.json({ success: true, data: mockClaimResult });
      })
    );

    const wrapper = createWrapper();

    // Pre-populate cache with horse prize summary
    queryClient.setQueryData(horsePrizeSummaryQueryKeys.all, {});

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({ competitionId: 1 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: horsePrizeSummaryQueryKeys.all,
      })
    );
  });

  // Test 7: Invalidates profile cache on success (sentinel for Equoria-9ufs fix)
  it('should invalidate profile query on success', async () => {
    server.use(
      http.post(`${base}/api/v1/competition/:competitionId/claim-prizes`, () => {
        return HttpResponse.json({ success: true, data: mockClaimResult });
      })
    );

    const wrapper = createWrapper();

    // Pre-populate cache with profile data
    queryClient.setQueryData(['profile'], { user: { id: 1, money: 8000 } });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({ competitionId: 1 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Must invalidate ['profile'] so the nav coin balance updates after a prize
    // claim. Bug: was invalidating ['user','balance'] which is unused in prod UI.
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['profile'],
      })
    );
    // Must NOT use the old wrong key
    expect(invalidateSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['user', 'balance'],
      })
    );
  });

  // Test 8: Handles mutation error correctly
  it('should handle different error types correctly', async () => {
    server.use(
      http.post(`${base}/api/v1/competition/:competitionId/claim-prizes`, () => {
        return HttpResponse.json(
          { success: false, message: 'Prizes already claimed' },
          { status: 400 }
        );
      })
    );

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 888 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.statusCode).toBe(400);
    expect(result.current.error?.message).toBe('Prizes already claimed');
  });

  // Test 9: Supports onSuccess callback
  it('should call onSuccess callback when claim succeeds', async () => {
    server.use(
      http.post(`${base}/api/v1/competition/:competitionId/claim-prizes`, () => {
        return HttpResponse.json({ success: true, data: mockClaimResult });
      })
    );

    const onSuccessMock = vi.fn();

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 1 }, { onSuccess: onSuccessMock });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onSuccessMock).toHaveBeenCalledTimes(1);
    // TanStack Query v5 passes 4 args: data, variables, context, mutation
    expect(onSuccessMock).toHaveBeenCalledWith(
      mockClaimResult,
      { competitionId: 1 },
      undefined,
      expect.any(Object) // mutation context object
    );
  });

  // Test 10: Supports onError callback
  it('should call onError callback when claim fails', async () => {
    server.use(
      http.post(`${base}/api/v1/competition/:competitionId/claim-prizes`, () => {
        return HttpResponse.json(
          { success: false, message: 'Competition not found' },
          { status: 404 }
        );
      })
    );

    const onErrorMock = vi.fn();

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 999 }, { onError: onErrorMock });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(onErrorMock).toHaveBeenCalledTimes(1);
    // TanStack Query v5 passes 4 args: error, variables, context, mutation
    const callArgs = onErrorMock.mock.calls[0];
    expect(callArgs[0]).toMatchObject({
      message: 'Competition not found',
      statusCode: 404,
    });
    expect(callArgs[1]).toEqual({ competitionId: 999 });
    expect(callArgs[2]).toBeUndefined();
    expect(callArgs[3]).toEqual(expect.any(Object));
  });

  // Test 11: Can be called multiple times
  it('should allow multiple consecutive mutation calls', async () => {
    const result1 = { ...mockClaimResult, newBalance: 10500 };
    const result2 = { ...mockClaimResult, newBalance: 13000, message: 'Claimed second prize' };
    const receivedCompetitionIds: number[] = [];
    let callIndex = 0;

    server.use(
      http.post(`${base}/api/v1/competition/:competitionId/claim-prizes`, ({ params }) => {
        receivedCompetitionIds.push(Number(params.competitionId));
        const responseData = callIndex === 0 ? result1 : result2;
        callIndex += 1;
        return HttpResponse.json({ success: true, data: responseData });
      })
    );

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    // First claim
    await act(async () => {
      result.current.mutate({ competitionId: 1 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.newBalance).toBe(10500);

    // Second claim
    await act(async () => {
      result.current.mutate({ competitionId: 2 });
    });

    await waitFor(() => expect(result.current.data?.newBalance).toBe(13000));
    expect(receivedCompetitionIds).toEqual([1, 2]);
  });

  // Test 12: Loading state is correct during mutation
  it('should return loading state during mutation', async () => {
    server.use(
      http.post(`${base}/api/v1/competition/:competitionId/claim-prizes`, async () => {
        await delay('infinite'); // never resolves — keeps the mutation in pending state
        return HttpResponse.json({ success: true, data: mockClaimResult });
      })
    );

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ competitionId: 1 });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    expect(result.current.isPending).toBe(true);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});

describe('useClaimPrizes with partial success', () => {
  it('should handle partial success with errors array', async () => {
    const partialSuccessResult: prizesApi.PrizeClaimResult = {
      success: true,
      prizesClaimed: [mockClaimResult.prizesClaimed[0]],
      newBalance: 10500,
      message: 'Claimed 1 of 2 prizes',
      errors: ['Prize for horse Storm already claimed'],
    };

    server.use(
      http.post(`${base}/api/v1/competition/:competitionId/claim-prizes`, () => {
        return HttpResponse.json({ success: true, data: partialSuccessResult });
      })
    );

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 1 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.success).toBe(true);
    expect(result.current.data?.prizesClaimed).toHaveLength(1);
    expect(result.current.data?.errors).toHaveLength(1);
    expect(result.current.data?.errors?.[0]).toContain('Storm');
  });
});
