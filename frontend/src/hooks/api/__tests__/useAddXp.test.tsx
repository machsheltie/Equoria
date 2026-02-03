/**
 * Tests for useAddXp Hook
 *
 * XP System - Task: useAddXp mutation hook tests
 *
 * Tests for adding XP to horses:
 * - Mutation function and API calls
 * - Loading and success states
 * - Error handling
 * - Query invalidation on success (horse level info, XP history)
 * - Correct request structure
 * - Multiple mutation calls
 * - Error logging behavior
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as xpApi from '@/lib/api/xp';
import { useAddXp } from '../useAddXp';
import { horseLevelInfoQueryKeys } from '../useHorseLevelInfo';
import { xpHistoryQueryKeys } from '../useXpHistory';
import type { AddXpResult, XpGain } from '@/lib/api/xp';

// Mock API functions
vi.mock('@/lib/api/xp', async () => {
  const actual = await vi.importActual('@/lib/api/xp');
  return {
    ...actual,
    addXp: vi.fn(),
  };
});

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

const mockErrorResult = {
  message: 'Horse not found',
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

describe('useAddXp', () => {
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

  // Test 1: Mutation executes successfully
  it('should execute mutation successfully', async () => {
    vi.mocked(xpApi.addXp).mockResolvedValue(mockAddXpResult);

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

    expect(xpApi.addXp).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockAddXpResult);
  });

  // Test 2: Returns AddXpResult with success flag
  it('should return AddXpResult with success flag and level-up info', async () => {
    vi.mocked(xpApi.addXp).mockResolvedValue(mockAddXpResult);

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
  it('should call addXp API with correct request payload', async () => {
    vi.mocked(xpApi.addXp).mockResolvedValue(mockAddXpResult);

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

    expect(xpApi.addXp).toHaveBeenCalledWith(variables);
  });

  // Test 4: Invalidates horse level info cache on success
  it('should invalidate horse level info cache on success', async () => {
    vi.mocked(xpApi.addXp).mockResolvedValue(mockAddXpResult);

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
    vi.mocked(xpApi.addXp).mockResolvedValue(mockAddXpResult);

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
    vi.mocked(xpApi.addXp).mockResolvedValue(mockAddXpResult);

    const wrapper = createWrapper();

    // Pre-populate cache with filtered XP history
    queryClient.setQueryData(
      xpHistoryQueryKeys.filtered(1, { dateRange: '30days' }),
      []
    );

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
    vi.mocked(xpApi.addXp).mockRejectedValue(mockErrorResult);

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

    expect(result.current.error).toEqual(mockErrorResult);
    expect(result.current.data).toBeUndefined();
  });

  // Test 8: isPending state during mutation
  it('should return isPending state during mutation execution', async () => {
    let resolvePromise: (value: AddXpResult) => void;
    const pendingPromise = new Promise<AddXpResult>((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(xpApi.addXp).mockReturnValue(pendingPromise);

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

    // Resolve to clean up
    act(() => {
      resolvePromise!(mockAddXpResult);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
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
    vi.mocked(xpApi.addXp).mockResolvedValue(mockAddXpResult);

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

    vi.mocked(xpApi.addXp)
      .mockResolvedValueOnce(result1)
      .mockResolvedValueOnce(result2);

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
    expect(xpApi.addXp).toHaveBeenCalledTimes(2);
  });
});
