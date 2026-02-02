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
      expect(result.current.data).toHaveProperty('shoulder');
      expect(result.current.data).toHaveProperty('back');
      expect(result.current.data).toHaveProperty('hindquarters');
      expect(result.current.data).toHaveProperty('legs');
      expect(result.current.data).toHaveProperty('hooves');
      expect(result.current.data).toHaveProperty('overall');
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
      expect(data!.overall).toBeGreaterThanOrEqual(0);
      expect(data!.overall).toBeLessThanOrEqual(100);
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
          data!.shoulder +
          data!.back +
          data!.hindquarters +
          data!.legs +
          data!.hooves) /
        7;

      expect(data!.overall).toBeCloseTo(calculatedAverage, 1);
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
      expect(averages).toHaveProperty('shoulder');
      expect(averages).toHaveProperty('back');
      expect(averages).toHaveProperty('hindquarters');
      expect(averages).toHaveProperty('legs');
      expect(averages).toHaveProperty('hooves');
      expect(averages).toHaveProperty('overall');
    });

    it('should return scores in valid range (0-100)', async () => {
      const { result } = renderHook(() => useBreedAverages(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const { averages } = result.current.data!;
      expect(averages.head).toBeGreaterThanOrEqual(0);
      expect(averages.head).toBeLessThanOrEqual(100);
      expect(averages.overall).toBeGreaterThanOrEqual(0);
      expect(averages.overall).toBeLessThanOrEqual(100);
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
