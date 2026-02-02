/**
 * Tests for useCompetitionDetails Hook
 *
 * Competition Entry System - Task: useCompetitionDetails hook tests
 *
 * Tests for fetching detailed competition information:
 * - Basic fetching with ID
 * - Loading states
 * - Error handling
 * - Disabled state when ID is null
 * - Query key separation from list queries
 * - Data updates when ID changes
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as competitionsApi from '@/lib/api/competitions';
import {
  useCompetitionDetails,
  competitionDetailsQueryKeys,
} from '../useCompetitionDetails';

// Mock API functions
vi.mock('@/lib/api/competitions', async () => {
  const actual = await vi.importActual('@/lib/api/competitions');
  return {
    ...actual,
    fetchCompetitionDetails: vi.fn(),
  };
});

const mockCompetitionDetails: competitionsApi.CompetitionData = {
  id: 1,
  name: 'Spring Dressage Championship',
  description: 'Annual spring dressage competition for intermediate riders',
  discipline: 'dressage',
  date: '2026-03-15T10:00:00Z',
  location: 'Central Arena',
  prizePool: 5000,
  entryFee: 50,
  maxEntries: 20,
  currentEntries: 12,
  status: 'open',
  requirements: {
    minAge: 3,
    maxAge: 15,
    minLevel: 5,
    requiredTraits: ['balanced', 'focused'],
  },
};

const createWrapper = () => {
  const queryClient = new QueryClient({
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

describe('useCompetitionDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Fetches competition details when ID provided
  it('should fetch competition details when ID is provided', async () => {
    vi.mocked(competitionsApi.fetchCompetitionDetails).mockResolvedValue(
      mockCompetitionDetails
    );

    const { result } = renderHook(() => useCompetitionDetails(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(competitionsApi.fetchCompetitionDetails).toHaveBeenCalledTimes(1);
    expect(competitionsApi.fetchCompetitionDetails).toHaveBeenCalledWith(1);
    expect(result.current.data).toEqual(mockCompetitionDetails);
  });

  // Test 2: Returns loading state initially
  it('should return loading state initially', () => {
    vi.mocked(competitionsApi.fetchCompetitionDetails).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    );

    const { result } = renderHook(() => useCompetitionDetails(1), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  // Test 3: Returns data after successful fetch
  it('should return data after successful fetch', async () => {
    vi.mocked(competitionsApi.fetchCompetitionDetails).mockResolvedValue(
      mockCompetitionDetails
    );

    const { result } = renderHook(() => useCompetitionDetails(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.name).toBe('Spring Dressage Championship');
    expect(result.current.data?.discipline).toBe('dressage');
    expect(result.current.data?.prizePool).toBe(5000);
    expect(result.current.data?.requirements?.minLevel).toBe(5);
  });

  // Test 4: Handles fetch error correctly
  it('should handle fetch error correctly', async () => {
    const mockError = {
      message: 'Competition not found',
      status: 'error',
      statusCode: 404,
    };

    vi.mocked(competitionsApi.fetchCompetitionDetails).mockRejectedValue(mockError);

    const { result } = renderHook(() => useCompetitionDetails(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
    expect(result.current.data).toBeUndefined();
  });

  // Test 5: Disabled when ID is null
  it('should not fetch when ID is null', () => {
    vi.mocked(competitionsApi.fetchCompetitionDetails).mockResolvedValue(
      mockCompetitionDetails
    );

    const { result } = renderHook(() => useCompetitionDetails(null), {
      wrapper: createWrapper(),
    });

    // Should not call API when ID is null
    expect(competitionsApi.fetchCompetitionDetails).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  // Test 6: Updates when ID changes
  it('should fetch new data when ID changes', async () => {
    const competition1 = { ...mockCompetitionDetails, id: 1, name: 'Competition 1' };
    const competition2 = { ...mockCompetitionDetails, id: 2, name: 'Competition 2' };

    vi.mocked(competitionsApi.fetchCompetitionDetails).mockImplementation((id) => {
      if (id === 1) return Promise.resolve(competition1);
      if (id === 2) return Promise.resolve(competition2);
      return Promise.reject({ message: 'Not found', status: 'error', statusCode: 404 });
    });

    const { result, rerender } = renderHook(
      ({ id }: { id: number | null }) => useCompetitionDetails(id),
      {
        wrapper: createWrapper(),
        initialProps: { id: 1 },
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('Competition 1');
    expect(competitionsApi.fetchCompetitionDetails).toHaveBeenCalledWith(1);

    // Change ID
    rerender({ id: 2 });

    await waitFor(() => expect(result.current.data?.name).toBe('Competition 2'));
    expect(competitionsApi.fetchCompetitionDetails).toHaveBeenCalledWith(2);
    expect(competitionsApi.fetchCompetitionDetails).toHaveBeenCalledTimes(2);
  });

  // Test 7: Uses separate cache from competitions list
  it('should use separate query key from competitions list', async () => {
    vi.mocked(competitionsApi.fetchCompetitionDetails).mockResolvedValue(
      mockCompetitionDetails
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCompetitionDetails(1), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify query key is different from list key
    const detailsKey = competitionDetailsQueryKeys.detail(1);
    expect(detailsKey).toEqual(['competition', 'detail', 1]);

    // Verify list key is not affected
    const listData = queryClient.getQueryData(['competitions', 'filtered']);
    expect(listData).toBeUndefined();

    // Verify detail data is cached correctly
    const detailData = queryClient.getQueryData(detailsKey);
    expect(detailData).toEqual(mockCompetitionDetails);
  });
});

describe('competitionDetailsQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(competitionDetailsQueryKeys).toBeDefined();
    expect(competitionDetailsQueryKeys.all).toEqual(['competition', 'detail']);
    expect(competitionDetailsQueryKeys.detail(1)).toEqual(['competition', 'detail', 1]);
    expect(competitionDetailsQueryKeys.detail(123)).toEqual(['competition', 'detail', 123]);
  });

  it('should create unique keys for different competition IDs', () => {
    const key1 = competitionDetailsQueryKeys.detail(1);
    const key2 = competitionDetailsQueryKeys.detail(2);
    const key3 = competitionDetailsQueryKeys.detail(100);

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
    expect(key2).not.toEqual(key3);
  });
});
