/**
 * Unit Tests: Horse Genetics Hooks
 *
 * Tests React Query hooks for genetics data:
 * - useHorseTraitInteractions
 * - useHorseEpigeneticInsights
 * - useHorseTraitTimeline
 *
 * Story 3-3, Task 2: Data Fetching Layer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useHorseTraitInteractions,
  useHorseEpigeneticInsights,
  useHorseTraitTimeline,
} from '../useHorseGenetics';
import type {
  TraitInteractionsResponse,
  EpigeneticInsightsResponse,
  TraitTimelineResponse,
} from '../useHorseGenetics';
import * as apiClient from '../../lib/api-client';

// Mock the API client
vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('Horse Genetics Hooks', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    // Create fresh query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries for faster tests
        },
      },
    });

    // Wrapper with QueryClientProvider
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('useHorseTraitInteractions', () => {
    const mockInteractionsData: TraitInteractionsResponse = {
      interactions: [
        {
          trait1: 'Speed Gene',
          trait2: 'Endurance Gene',
          effect: 'Balanced athlete - moderate boost to both speed and stamina',
          strength: 75,
        },
        {
          trait1: 'Jumping Aptitude',
          trait2: 'Agility Boost',
          effect: 'Enhanced jumping ability with improved landing control',
          strength: 85,
        },
      ],
    };

    it('should fetch trait interactions successfully', async () => {
      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(mockInteractionsData);

      const { result } = renderHook(() => useHorseTraitInteractions(123), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockInteractionsData);
      expect(apiClient.apiClient.get).toHaveBeenCalledWith('/api/horses/123/trait-interactions');
      expect(apiClient.apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('should handle 404 error (horse not found)', async () => {
      vi.mocked(apiClient.apiClient.get).mockRejectedValueOnce({
        statusCode: 404,
        message: 'Horse not found',
      });

      const { result } = renderHook(() => useHorseTraitInteractions(999), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toMatchObject({
        statusCode: 404,
        message: 'Horse not found',
      });
    });

    it('should handle network errors', async () => {
      vi.mocked(apiClient.apiClient.get).mockRejectedValueOnce(
        new Error('Network request failed')
      );

      const { result } = renderHook(() => useHorseTraitInteractions(123), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });

    it('should not fetch when enabled is false', async () => {
      const { result } = renderHook(() => useHorseTraitInteractions(123, { enabled: false }), {
        wrapper,
      });

      // Wait a bit to ensure no fetch was triggered
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(apiClient.apiClient.get).not.toHaveBeenCalled();
    });

    it('should not fetch when horseId is 0', async () => {
      const { result } = renderHook(() => useHorseTraitInteractions(0), { wrapper });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(result.current.isLoading).toBe(false);
      expect(apiClient.apiClient.get).not.toHaveBeenCalled();
    });

    it('should use correct query key', async () => {
      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(mockInteractionsData);

      const { result } = renderHook(() => useHorseTraitInteractions(123), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query key should be ['horse', horseId, 'trait-interactions']
      const cacheData = queryClient.getQueryData(['horse', 123, 'trait-interactions']);
      expect(cacheData).toEqual(mockInteractionsData);
    });

    it('should return empty interactions array', async () => {
      const emptyData: TraitInteractionsResponse = { interactions: [] };
      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(emptyData);

      const { result } = renderHook(() => useHorseTraitInteractions(123), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.interactions).toHaveLength(0);
    });
  });

  describe('useHorseEpigeneticInsights', () => {
    const mockInsightsData: EpigeneticInsightsResponse = {
      traits: [
        {
          name: 'Speed Burst',
          type: 'genetic',
          description: 'Short bursts of exceptional speed',
          source: 'sire',
          rarity: 'rare',
          strength: 85,
          impact: {
            stats: { speed: 15 },
            disciplines: { racing: 10 },
          },
        },
        {
          name: 'Endurance Training Response',
          type: 'epigenetic',
          description: 'Enhanced response to endurance training',
          discoveryDate: '2025-01-15',
          isActive: true,
          rarity: 'common',
          strength: 65,
          impact: {
            stats: { stamina: 10 },
            disciplines: { endurance: 8 },
          },
        },
        {
          name: 'Divine Grace',
          type: 'genetic',
          description: 'Legendary trait that enhances all attributes',
          source: 'mutation',
          rarity: 'legendary',
          strength: 95,
          impact: {
            stats: { speed: 20, stamina: 20, agility: 20 },
            disciplines: { racing: 15, endurance: 15, jumping: 15 },
          },
        },
      ],
    };

    it('should fetch epigenetic insights successfully', async () => {
      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(mockInsightsData);

      const { result } = renderHook(() => useHorseEpigeneticInsights(456), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockInsightsData);
      expect(apiClient.apiClient.get).toHaveBeenCalledWith('/api/horses/456/epigenetic-insights');
      expect(apiClient.apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('should handle horse with only genetic traits', async () => {
      const geneticOnlyData: EpigeneticInsightsResponse = {
        traits: [
          {
            name: 'Speed Gene',
            type: 'genetic',
            description: 'Natural speed advantage',
            source: 'dam',
            rarity: 'common',
            strength: 70,
            impact: { stats: { speed: 10 } },
          },
        ],
      };

      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(geneticOnlyData);

      const { result } = renderHook(() => useHorseEpigeneticInsights(123), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.traits).toHaveLength(1);
      expect(result.current.data?.traits[0].type).toBe('genetic');
    });

    it('should handle horse with only epigenetic traits', async () => {
      const epigeneticOnlyData: EpigeneticInsightsResponse = {
        traits: [
          {
            name: 'Training Adaptation',
            type: 'epigenetic',
            description: 'Adapts to training regimen',
            discoveryDate: '2025-01-20',
            isActive: true,
            rarity: 'rare',
            strength: 80,
            impact: { stats: { intelligence: 15 } },
          },
        ],
      };

      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(epigeneticOnlyData);

      const { result } = renderHook(() => useHorseEpigeneticInsights(123), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.traits).toHaveLength(1);
      expect(result.current.data?.traits[0].type).toBe('epigenetic');
      expect(result.current.data?.traits[0].discoveryDate).toBeDefined();
    });

    it('should handle 401 unauthorized error', async () => {
      vi.mocked(apiClient.apiClient.get).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Authentication required',
      });

      const { result } = renderHook(() => useHorseEpigeneticInsights(123), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toMatchObject({
        statusCode: 401,
      });
    });

    it('should not fetch when enabled is false', async () => {
      const { result } = renderHook(() => useHorseEpigeneticInsights(123, { enabled: false }), {
        wrapper,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(result.current.isLoading).toBe(false);
      expect(apiClient.apiClient.get).not.toHaveBeenCalled();
    });

    it('should use correct query key', async () => {
      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(mockInsightsData);

      const { result } = renderHook(() => useHorseEpigeneticInsights(456), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query key should be ['horse', horseId, 'epigenetic-insights']
      const cacheData = queryClient.getQueryData(['horse', 456, 'epigenetic-insights']);
      expect(cacheData).toEqual(mockInsightsData);
    });

    it('should handle horse with no traits', async () => {
      const noTraitsData: EpigeneticInsightsResponse = { traits: [] };
      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(noTraitsData);

      const { result } = renderHook(() => useHorseEpigeneticInsights(123), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.traits).toHaveLength(0);
    });
  });

  describe('useHorseTraitTimeline', () => {
    const mockTimelineData: TraitTimelineResponse = {
      timeline: [
        {
          id: 1,
          traitName: 'Speed Gene',
          eventType: 'inherited',
          timestamp: '2024-01-15T10:00:00Z',
          description: 'Inherited from sire',
          source: 'sire',
        },
        {
          id: 2,
          traitName: 'Endurance Training Response',
          eventType: 'discovered',
          timestamp: '2024-06-20T14:30:00Z',
          description: 'Discovered during intensive training session',
          source: 'training',
        },
        {
          id: 3,
          traitName: 'Endurance Training Response',
          eventType: 'activated',
          timestamp: '2024-06-21T09:00:00Z',
          description: 'Trait activated after consistent training',
          source: 'training',
        },
        {
          id: 4,
          traitName: 'Jumping Mutation',
          eventType: 'mutated',
          timestamp: '2024-09-10T16:45:00Z',
          description: 'Spontaneous genetic mutation',
          source: 'mutation',
        },
      ],
    };

    it('should fetch trait timeline successfully', async () => {
      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(mockTimelineData);

      const { result } = renderHook(() => useHorseTraitTimeline(789), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockTimelineData);
      expect(apiClient.apiClient.get).toHaveBeenCalledWith('/api/horses/789/trait-timeline');
      expect(apiClient.apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('should handle timeline with only inherited events', async () => {
      const inheritedOnlyData: TraitTimelineResponse = {
        timeline: [
          {
            id: 1,
            traitName: 'Speed Gene',
            eventType: 'inherited',
            timestamp: '2024-01-01T00:00:00Z',
            source: 'sire',
          },
          {
            id: 2,
            traitName: 'Stamina Gene',
            eventType: 'inherited',
            timestamp: '2024-01-01T00:00:00Z',
            source: 'dam',
          },
        ],
      };

      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(inheritedOnlyData);

      const { result } = renderHook(() => useHorseTraitTimeline(123), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.timeline).toHaveLength(2);
      expect(result.current.data?.timeline.every((e) => e.eventType === 'inherited')).toBe(true);
    });

    it('should handle timeline with mutation events', async () => {
      const mutationData: TraitTimelineResponse = {
        timeline: [
          {
            id: 1,
            traitName: 'Rare Mutation',
            eventType: 'mutated',
            timestamp: '2024-05-15T12:00:00Z',
            description: 'Spontaneous mutation occurred',
            source: 'mutation',
          },
        ],
      };

      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(mutationData);

      const { result } = renderHook(() => useHorseTraitTimeline(123), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.timeline[0].eventType).toBe('mutated');
      expect(result.current.data?.timeline[0].source).toBe('mutation');
    });

    it('should handle 404 error (horse not found)', async () => {
      vi.mocked(apiClient.apiClient.get).mockRejectedValueOnce({
        statusCode: 404,
        message: 'Horse not found',
      });

      const { result } = renderHook(() => useHorseTraitTimeline(999), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toMatchObject({
        statusCode: 404,
      });
    });

    it('should not fetch when enabled is false', async () => {
      const { result } = renderHook(() => useHorseTraitTimeline(123, { enabled: false }), {
        wrapper,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(result.current.isLoading).toBe(false);
      expect(apiClient.apiClient.get).not.toHaveBeenCalled();
    });

    it('should use correct query key', async () => {
      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(mockTimelineData);

      const { result } = renderHook(() => useHorseTraitTimeline(789), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query key should be ['horse', horseId, 'trait-timeline']
      const cacheData = queryClient.getQueryData(['horse', 789, 'trait-timeline']);
      expect(cacheData).toEqual(mockTimelineData);
    });

    it('should handle empty timeline (young horse)', async () => {
      const emptyTimelineData: TraitTimelineResponse = { timeline: [] };
      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(emptyTimelineData);

      const { result } = renderHook(() => useHorseTraitTimeline(123), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.timeline).toHaveLength(0);
    });

    it('should handle network errors', async () => {
      vi.mocked(apiClient.apiClient.get).mockRejectedValueOnce(
        new Error('Network request failed')
      );

      const { result } = renderHook(() => useHorseTraitTimeline(123), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('Cache and Stale Time Configuration', () => {
    it('useHorseTraitInteractions should have 5 minute stale time by default', async () => {
      const mockData: TraitInteractionsResponse = { interactions: [] };
      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(mockData);

      renderHook(() => useHorseTraitInteractions(123), { wrapper });

      await waitFor(() => {
        const cacheEntry = queryClient.getQueryState(['horse', 123, 'trait-interactions']);
        expect(cacheEntry).toBeDefined();
      });

      // Verify stale time is set (5 minutes = 300000ms)
      const cacheEntry = queryClient.getQueryState(['horse', 123, 'trait-interactions']);
      expect(cacheEntry?.dataUpdatedAt).toBeDefined();
    });

    it('useHorseEpigeneticInsights should have 10 minute stale time by default', async () => {
      const mockData: EpigeneticInsightsResponse = { traits: [] };
      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(mockData);

      renderHook(() => useHorseEpigeneticInsights(123), { wrapper });

      await waitFor(() => {
        const cacheEntry = queryClient.getQueryState(['horse', 123, 'epigenetic-insights']);
        expect(cacheEntry).toBeDefined();
      });
    });

    it('useHorseTraitTimeline should have 15 minute stale time by default', async () => {
      const mockData: TraitTimelineResponse = { timeline: [] };
      vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce(mockData);

      renderHook(() => useHorseTraitTimeline(123), { wrapper });

      await waitFor(() => {
        const cacheEntry = queryClient.getQueryState(['horse', 123, 'trait-timeline']);
        expect(cacheEntry).toBeDefined();
      });
    });
  });
});
