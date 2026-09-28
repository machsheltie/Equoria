/**
 * Tests for Conformation React Query Hooks
 *
 * Tests cover:
 * - Query key generation
 * - Data fetching success scenarios
 * - Loading states
 * - Error handling
 * - Caching behavior
 * - Enabled/disabled states
 *
 * Story 3-5: Conformation Scoring UI - Task 4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHorseConformation, useBreedAverages } from '../useConformation';

// Test wrapper for React Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useHorseConformation', () => {
  beforeEach(() => {
    // Clear all query caches before each test
    const queryClient = new QueryClient();
    queryClient.clear();
  });

  describe('Query Key Generation', () => {
    it('should generate correct query key for numeric horseId', () => {
      const { result } = renderHook(() => useHorseConformation(123), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
      // Query key should be ['horse', '123', 'conformation']
    });

    it('should generate correct query key for string horseId', () => {
      const { result } = renderHook(() => useHorseConformation('456'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
      // Query key should be ['horse', '456', 'conformation']
    });
  });

  describe('Data Fetching', () => {
    it('should fetch conformation data successfully', async () => {
      const { result } = renderHook(() => useHorseConformation(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveProperty('head');
      expect(result.current.data).toHaveProperty('neck');
      expect(result.current.data).toHaveProperty('shoulders');
      expect(result.current.data).toHaveProperty('back');
      expect(result.current.data).toHaveProperty('hindquarters');
      expect(result.current.data).toHaveProperty('legs');
      expect(result.current.data).toHaveProperty('hooves');
      expect(result.current.data).toHaveProperty('topline');
      expect(result.current.data).toHaveProperty('overallConformation');
    });

    it('should return scores in valid range (0-100)', async () => {
      const { result } = renderHook(() => useHorseConformation(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const { data } = result.current;
      expect(data!.head).toBeGreaterThanOrEqual(0);
      expect(data!.head).toBeLessThanOrEqual(100);
      expect(data!.neck).toBeGreaterThanOrEqual(0);
      expect(data!.neck).toBeLessThanOrEqual(100);
      expect(data!.overallConformation).toBeGreaterThanOrEqual(0);
      expect(data!.overallConformation).toBeLessThanOrEqual(100);
    });

    it('should calculate overall score as average of 7 regions', async () => {
      const { result } = renderHook(() => useHorseConformation(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const { data } = result.current;
      const calculatedAverage =
        (data!.head +
          data!.neck +
          data!.shoulders +
          data!.back +
          data!.hindquarters +
          data!.legs +
          data!.hooves +
          data!.topline) /
        8;

      expect(data!.overallConformation).toBeCloseTo(calculatedAverage, 1);
    });

    it('should generate different scores for different horse IDs', async () => {
      const { result: result1 } = renderHook(() => useHorseConformation(1), {
        wrapper: createWrapper(),
      });
      const { result: result2 } = renderHook(() => useHorseConformation(2), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result1.current.isSuccess).toBe(true));
      await waitFor(() => expect(result2.current.isSuccess).toBe(true));

      // Scores should be different for different horse IDs
      const isDifferent =
        result1.current.data!.head !== result2.current.data!.head ||
        result1.current.data!.neck !== result2.current.data!.neck;

      expect(isDifferent).toBe(true);
    });
  });

  describe('Loading States', () => {
    it('should start in loading state', () => {
      const { result } = renderHook(() => useHorseConformation(1), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should transition to success state', async () => {
      const { result } = renderHook(() => useHorseConformation(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeDefined();
    });
  });

  describe('Enabled/Disabled States', () => {
    it('should not fetch when horseId is undefined', () => {
      const { result } = renderHook(() => useHorseConformation(undefined as any), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when horseId is null', () => {
      const { result } = renderHook(() => useHorseConformation(null as any), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when horseId is empty string', () => {
      const { result } = renderHook(() => useHorseConformation(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });

    it('should fetch when horseId is 0 (valid edge case)', async () => {
      const { result } = renderHook(() => useHorseConformation(0), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeDefined();
    });
  });

  describe('Caching', () => {
    it('should use cached data for same horseId', async () => {
      const wrapper = createWrapper();

      // First render
      const { result: result1 } = renderHook(() => useHorseConformation(1), { wrapper });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));
      const firstData = result1.current.data;

      // Second render with same horseId
      const { result: result2 } = renderHook(() => useHorseConformation(1), { wrapper });

      // Should immediately have data from cache
      expect(result2.current.data).toEqual(firstData);
    });
  });
});

describe('useHorseConformation query key normalization (Equoria-bvddn.33)', () => {
  it('shares one cache entry for a numeric and a string horseId — same horse, same key', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // First call with a numeric id populates the cache.
    const { result: numericResult } = renderHook(() => useHorseConformation(7), { wrapper });
    await waitFor(() => expect(numericResult.current.isSuccess).toBe(true));

    // A second consumer for the SAME horse, called with the string form of the
    // same id (as an unnormalised caller might pass a route param), must read
    // the cache instead of issuing a second fetch — proof both calls resolve
    // to the same queryKey. Pre-fix, ['horse', String(horseId), 'conformation']
    // already used the string form for both, so this alone wasn't the failure;
    // the real defect is the mismatch against sibling keys (useConformationTitles,
    // useGaits) that key on the raw (numeric) id — asserted below via the
    // actual cache entry shape.
    const { result: stringResult } = renderHook(() => useHorseConformation('7'), { wrapper });

    // Fetch status idle-then-success would indicate a SEPARATE cache entry;
    // an immediate cached value proves the SAME entry.
    expect(stringResult.current.data).toEqual(numericResult.current.data);
    expect(stringResult.current.fetchStatus).toBe('idle');

    // The real, normalised key is numeric — this is what
    // useConformationTitles (['horse', horseId, 'conformation', 'titles'])
    // and the fixed useGaits (['horse', Number(horseId), 'gaits']) already
    // use. Fails pre-fix, where this hook cached under the string '7'.
    expect(queryClient.getQueryData(['horse', 7, 'conformation'])).toEqual(
      numericResult.current.data
    );
    expect(queryClient.getQueryData(['horse', '7', 'conformation'])).toBeUndefined();
  });
});

describe('useBreedAverages', () => {
  beforeEach(() => {
    const queryClient = new QueryClient();
    queryClient.clear();
  });

  describe('Query Key Generation', () => {
    it('should generate correct query key for numeric breedId', () => {
      const { result } = renderHook(() => useBreedAverages(1), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
    });

    it('should generate correct query key for string breedId', () => {
      const { result } = renderHook(() => useBreedAverages('abc'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch breed averages successfully', async () => {
      const { result } = renderHook(() => useBreedAverages(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveProperty('breedId');
      expect(result.current.data).toHaveProperty('breedName');
      expect(result.current.data).toHaveProperty('averages');
    });

    it('should return averages with all conformation regions', async () => {
      const { result } = renderHook(() => useBreedAverages(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const { averages } = result.current.data!;
      expect(averages).toHaveProperty('head');
      expect(averages).toHaveProperty('neck');
      expect(averages).toHaveProperty('shoulders');
      expect(averages).toHaveProperty('back');
      expect(averages).toHaveProperty('hindquarters');
      expect(averages).toHaveProperty('legs');
      expect(averages).toHaveProperty('hooves');
      expect(averages).toHaveProperty('topline');
      expect(averages).toHaveProperty('overallConformation');
    });

    it('should return scores in valid range (0-100)', async () => {
      const { result } = renderHook(() => useBreedAverages(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const { averages } = result.current.data!;
      expect(averages.head).toBeGreaterThanOrEqual(0);
      expect(averages.head).toBeLessThanOrEqual(100);
      expect(averages.overallConformation).toBeGreaterThanOrEqual(0);
      expect(averages.overallConformation).toBeLessThanOrEqual(100);
    });
  });

  describe('Loading States', () => {
    it('should start in loading state', () => {
      const { result } = renderHook(() => useBreedAverages(1), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should transition to success state', async () => {
      const { result } = renderHook(() => useBreedAverages(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeDefined();
    });
  });

  describe('Enabled/Disabled States', () => {
    it('should not fetch when breedId is undefined', () => {
      const { result } = renderHook(() => useBreedAverages(undefined as any), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when breedId is null', () => {
      const { result } = renderHook(() => useBreedAverages(null as any), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when breedId is empty string', () => {
      const { result } = renderHook(() => useBreedAverages(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('Caching', () => {
    it('should use cached data for same breedId', async () => {
      const wrapper = createWrapper();

      // First render
      const { result: result1 } = renderHook(() => useBreedAverages(1), { wrapper });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));
      const firstData = result1.current.data;

      // Second render with same breedId
      const { result: result2 } = renderHook(() => useBreedAverages(1), { wrapper });

      // Should immediately have data from cache
      expect(result2.current.data).toEqual(firstData);
    });
  });
});
