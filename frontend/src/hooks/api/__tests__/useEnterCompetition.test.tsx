/**
 * Tests for useEnterCompetition Hook
 *
 * Competition Entry System - Task: useEnterCompetition mutation hook tests
 *
 * Tests for submitting competition entries:
 * - Mutation function and API calls
 * - Loading and success states
 * - Error handling
 * - Query invalidation on success
 * - Network error handling
 * - Meaningful error messages
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as competitionsApi from '@/lib/api/competitions';
import { useEnterCompetition } from '../useEnterCompetition';
import { competitionFilteredQueryKeys } from '../useCompetitionsFiltered';
import { competitionDetailsQueryKeys } from '../useCompetitionDetails';
import { horseEligibilityQueryKeys } from '../useHorseEligibility';

// Mock API functions
vi.mock('@/lib/api/competitions', async () => {
  const actual = await vi.importActual('@/lib/api/competitions');
  return {
    ...actual,
    submitCompetitionEntry: vi.fn(),
  };
});

const mockSuccessResult: competitionsApi.EntryResult = {
  success: true,
  entryIds: [101, 102, 103],
  totalCost: 150,
  message: 'Successfully entered 3 horses into the competition',
};

const mockPartialSuccessResult: competitionsApi.EntryResult = {
  success: true,
  entryIds: [101, 102],
  totalCost: 100,
  message: 'Entered 2 of 3 horses',
  failedEntries: [
    { horseId: 3, reason: 'Horse does not meet minimum level requirement' },
  ],
};

const mockErrorResult = {
  message: 'Insufficient funds for entry fee',
  status: 'error',
  statusCode: 400,
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

describe('useEnterCompetition', () => {
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

  // Test 1: Mutation function defined correctly
  it('should have mutation function defined correctly', () => {
    const { result } = renderHook(() => useEnterCompetition(), {
      wrapper: createWrapper(),
    });

    expect(result.current.mutate).toBeDefined();
    expect(result.current.mutateAsync).toBeDefined();
    expect(typeof result.current.mutate).toBe('function');
    expect(typeof result.current.mutateAsync).toBe('function');
  });

  // Test 2: Calls submitCompetitionEntry with correct data
  it('should call submitCompetitionEntry with correct data', async () => {
    vi.mocked(competitionsApi.submitCompetitionEntry).mockResolvedValue(mockSuccessResult);

    const { result } = renderHook(() => useEnterCompetition(), {
      wrapper: createWrapper(),
    });

    const entryData: competitionsApi.EntryData = {
      competitionId: 123,
      horseIds: [1, 2, 3],
    };

    await act(async () => {
      result.current.mutate(entryData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(competitionsApi.submitCompetitionEntry).toHaveBeenCalledTimes(1);
    expect(competitionsApi.submitCompetitionEntry).toHaveBeenCalledWith(entryData);
  });

  // Test 3: Returns loading state during submission
  it('should return loading state during submission', async () => {
    let resolvePromise: (value: competitionsApi.EntryResult) => void;
    const pendingPromise = new Promise<competitionsApi.EntryResult>((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(competitionsApi.submitCompetitionEntry).mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useEnterCompetition(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ competitionId: 123, horseIds: [1] });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    expect(result.current.isPending).toBe(true);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);

    // Resolve to clean up
    act(() => {
      resolvePromise!(mockSuccessResult);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  // Test 4: Returns success data after submission
  it('should return success data after submission', async () => {
    vi.mocked(competitionsApi.submitCompetitionEntry).mockResolvedValue(mockSuccessResult);

    const { result } = renderHook(() => useEnterCompetition(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 123, horseIds: [1, 2, 3] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockSuccessResult);
    expect(result.current.data?.success).toBe(true);
    expect(result.current.data?.entryIds).toHaveLength(3);
    expect(result.current.data?.totalCost).toBe(150);
    expect(result.current.data?.message).toContain('3 horses');
  });

  // Test 5: Handles submission error correctly
  it('should handle submission error correctly', async () => {
    vi.mocked(competitionsApi.submitCompetitionEntry).mockRejectedValue(mockErrorResult);

    const { result } = renderHook(() => useEnterCompetition(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 123, horseIds: [1] });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockErrorResult);
    expect(result.current.data).toBeUndefined();
  });

  // Test 6: Invalidates competitions query on success
  it('should invalidate competitions query on success', async () => {
    vi.mocked(competitionsApi.submitCompetitionEntry).mockResolvedValue(mockSuccessResult);

    const wrapper = createWrapper();

    // Pre-populate cache with competitions list
    queryClient.setQueryData(competitionFilteredQueryKeys.list(), [
      { id: 123, name: 'Test Competition', currentEntries: 10 },
    ]);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useEnterCompetition(), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({ competitionId: 123, horseIds: [1] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: competitionFilteredQueryKeys.all,
      })
    );
  });

  // Test 7: Invalidates competition details query on success
  it('should invalidate competition details query on success', async () => {
    vi.mocked(competitionsApi.submitCompetitionEntry).mockResolvedValue(mockSuccessResult);

    const wrapper = createWrapper();

    // Pre-populate cache with competition details
    queryClient.setQueryData(competitionDetailsQueryKeys.detail(123), {
      id: 123,
      name: 'Test Competition',
      currentEntries: 10,
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useEnterCompetition(), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({ competitionId: 123, horseIds: [1] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: competitionDetailsQueryKeys.detail(123),
      })
    );
  });

  // Test 8: Invalidates horse eligibility query on success
  it('should invalidate horse eligibility query on success', async () => {
    vi.mocked(competitionsApi.submitCompetitionEntry).mockResolvedValue(mockSuccessResult);

    const wrapper = createWrapper();

    // Pre-populate cache with eligibility data
    queryClient.setQueryData(horseEligibilityQueryKeys.all, []);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useEnterCompetition(), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({ competitionId: 123, horseIds: [1] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: horseEligibilityQueryKeys.all,
      })
    );
  });

  // Test 9: Invalidates user query on success
  it('should invalidate user query on success', async () => {
    vi.mocked(competitionsApi.submitCompetitionEntry).mockResolvedValue(mockSuccessResult);

    const wrapper = createWrapper();

    // Pre-populate cache with user data
    queryClient.setQueryData(['user'], { id: 1, money: 1000 });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useEnterCompetition(), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({ competitionId: 123, horseIds: [1] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['user'],
      })
    );
  });

  // Test 10: Handles network error with meaningful message
  it('should handle network error with proper structure', async () => {
    const networkError = {
      message: 'Network error: Unable to connect to server',
      status: 'error',
      statusCode: 0,
    };

    vi.mocked(competitionsApi.submitCompetitionEntry).mockRejectedValue(networkError);

    const { result } = renderHook(() => useEnterCompetition(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 123, horseIds: [1] });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(networkError);
    expect(result.current.error?.statusCode).toBe(0);
    expect(result.current.error?.message).toContain('Network error');
  });

  // Test 11: Error messages are meaningful
  it('should preserve meaningful error messages from API', async () => {
    const validationError = {
      message: 'One or more horses are not eligible for this competition',
      status: 'error',
      statusCode: 422,
    };

    vi.mocked(competitionsApi.submitCompetitionEntry).mockRejectedValue(validationError);

    const { result } = renderHook(() => useEnterCompetition(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 123, horseIds: [1, 2] });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      'One or more horses are not eligible for this competition'
    );
    expect(result.current.error?.statusCode).toBe(422);
  });
});

describe('useEnterCompetition with partial success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle partial success with failed entries', async () => {
    vi.mocked(competitionsApi.submitCompetitionEntry).mockResolvedValue(
      mockPartialSuccessResult
    );

    const { result } = renderHook(() => useEnterCompetition(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ competitionId: 123, horseIds: [1, 2, 3] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.success).toBe(true);
    expect(result.current.data?.entryIds).toHaveLength(2);
    expect(result.current.data?.failedEntries).toHaveLength(1);
    expect(result.current.data?.failedEntries?.[0].horseId).toBe(3);
    expect(result.current.data?.failedEntries?.[0].reason).toContain('minimum level');
  });
});
