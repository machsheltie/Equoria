/**
 * Tests for useClaimPrizes Hook
 *
 * Prize System - Task: useClaimPrizes mutation hook tests
 *
 * Tests for claiming competition prizes:
 * - Mutation function and API calls
 * - Loading and success states
 * - Error handling
 * - Query invalidation on success
 * - Callback support (onSuccess, onError)
 * - Multiple mutation calls
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as prizesApi from '@/lib/api/prizes';
import { useClaimPrizes } from '../useClaimPrizes';
import { prizeHistoryQueryKeys } from '../usePrizeHistory';
import { horsePrizeSummaryQueryKeys } from '../useHorsePrizeSummary';

// Mock API functions
vi.mock('@/lib/api/prizes', async () => {
  const actual = await vi.importActual('@/lib/api/prizes');
  return {
    ...actual,
    claimCompetitionPrizes: vi.fn(),
  };
});

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

const mockErrorResult = {
  message: 'Competition not found',
  status: 'error',
  statusCode: 404,
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
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
  it('should call claimCompetitionPrizes with correct competitionId', async () => {
    vi.mocked(prizesApi.claimCompetitionPrizes).mockResolvedValue(mockClaimResult);

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 123 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(prizesApi.claimCompetitionPrizes).toHaveBeenCalledTimes(1);
    expect(prizesApi.claimCompetitionPrizes).toHaveBeenCalledWith(123);
  });

  // Test 3: Returns success result on successful claim
  it('should return success result with prize claim data', async () => {
    vi.mocked(prizesApi.claimCompetitionPrizes).mockResolvedValue(mockClaimResult);

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
    vi.mocked(prizesApi.claimCompetitionPrizes).mockRejectedValue(mockErrorResult);

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 999 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockErrorResult);
    expect(result.current.data).toBeUndefined();
  });

  // Test 5: Invalidates prize history cache on success
  it('should invalidate prize history query on success', async () => {
    vi.mocked(prizesApi.claimCompetitionPrizes).mockResolvedValue(mockClaimResult);

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
    vi.mocked(prizesApi.claimCompetitionPrizes).mockResolvedValue(mockClaimResult);

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

  // Test 7: Invalidates user balance cache on success
  it('should invalidate user query on success', async () => {
    vi.mocked(prizesApi.claimCompetitionPrizes).mockResolvedValue(mockClaimResult);

    const wrapper = createWrapper();

    // Pre-populate cache with user data
    queryClient.setQueryData(['user'], { id: 1, money: 8000 });

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
        queryKey: ['user'],
      })
    );
  });

  // Test 8: Handles mutation error correctly
  it('should handle different error types correctly', async () => {
    const alreadyClaimedError = {
      message: 'Prizes already claimed',
      status: 'error',
      statusCode: 400,
    };

    vi.mocked(prizesApi.claimCompetitionPrizes).mockRejectedValue(alreadyClaimedError);

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 888 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(alreadyClaimedError);
    expect(result.current.error?.statusCode).toBe(400);
    expect(result.current.error?.message).toBe('Prizes already claimed');
  });

  // Test 9: Supports onSuccess callback
  it('should call onSuccess callback when claim succeeds', async () => {
    vi.mocked(prizesApi.claimCompetitionPrizes).mockResolvedValue(mockClaimResult);

    const onSuccessMock = vi.fn();

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate(
        { competitionId: 1 },
        { onSuccess: onSuccessMock }
      );
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
    vi.mocked(prizesApi.claimCompetitionPrizes).mockRejectedValue(mockErrorResult);

    const onErrorMock = vi.fn();

    const { result } = renderHook(() => useClaimPrizes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate(
        { competitionId: 999 },
        { onError: onErrorMock }
      );
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(onErrorMock).toHaveBeenCalledTimes(1);
    // TanStack Query v5 passes 4 args: error, variables, context, mutation
    expect(onErrorMock).toHaveBeenCalledWith(
      mockErrorResult,
      { competitionId: 999 },
      undefined,
      expect.any(Object) // mutation context object
    );
  });

  // Test 11: Can be called multiple times
  it('should allow multiple consecutive mutation calls', async () => {
    const result1 = { ...mockClaimResult, newBalance: 10500 };
    const result2 = { ...mockClaimResult, newBalance: 13000, message: 'Claimed second prize' };

    vi.mocked(prizesApi.claimCompetitionPrizes)
      .mockResolvedValueOnce(result1)
      .mockResolvedValueOnce(result2);

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
    expect(prizesApi.claimCompetitionPrizes).toHaveBeenCalledTimes(2);
    expect(prizesApi.claimCompetitionPrizes).toHaveBeenNthCalledWith(1, 1);
    expect(prizesApi.claimCompetitionPrizes).toHaveBeenNthCalledWith(2, 2);
  });

  // Test 12: Loading state is correct during mutation
  it('should return loading state during mutation', async () => {
    let resolvePromise: (value: prizesApi.PrizeClaimResult) => void;
    const pendingPromise = new Promise<prizesApi.PrizeClaimResult>((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(prizesApi.claimCompetitionPrizes).mockReturnValue(pendingPromise);

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

    // Resolve to clean up
    act(() => {
      resolvePromise!(mockClaimResult);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useClaimPrizes with partial success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle partial success with errors array', async () => {
    const partialSuccessResult: prizesApi.PrizeClaimResult = {
      success: true,
      prizesClaimed: [mockClaimResult.prizesClaimed[0]],
      newBalance: 10500,
      message: 'Claimed 1 of 2 prizes',
      errors: ['Prize for horse Storm already claimed'],
    };

    vi.mocked(prizesApi.claimCompetitionPrizes).mockResolvedValue(partialSuccessResult);

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
