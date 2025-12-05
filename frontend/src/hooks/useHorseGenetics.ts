/**
 * React Query hooks for Horse Genetics Data
 *
 * Provides hooks for fetching advanced genetics data including:
 * - Trait interactions
 * - Epigenetic insights
 * - Trait timeline/history
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/**
 * TypeScript interfaces for genetics API responses
 */

export interface TraitInteraction {
  trait1: string;
  trait2: string;
  effect: string;
  strength: number; // 0-100 scale
}

export interface TraitInteractionsResponse {
  interactions: TraitInteraction[];
}

export interface EpigeneticTrait {
  name: string;
  type: 'genetic' | 'epigenetic';
  description: string;
  source?: 'sire' | 'dam' | 'mutation';
  discoveryDate?: string;
  isActive?: boolean;
  rarity: 'common' | 'rare' | 'legendary';
  strength: number; // 0-100 scale
  impact: {
    stats?: Record<string, number>;
    disciplines?: Record<string, number>;
  };
}

export interface EpigeneticInsightsResponse {
  traits: EpigeneticTrait[];
}

export interface TraitTimelineEntry {
  id: number;
  traitName: string;
  eventType: 'discovered' | 'activated' | 'deactivated' | 'mutated' | 'inherited';
  timestamp: string;
  description?: string;
  source?: 'sire' | 'dam' | 'environment' | 'training' | 'mutation';
}

export interface TraitTimelineResponse {
  timeline: TraitTimelineEntry[];
}

/**
 * Genetics API surface
 * Extends the base API client with genetics-specific endpoints
 */
export const geneticsApi = {
  /**
   * Get trait interactions for a horse
   * Shows which traits work together (synergies) or conflict
   */
  getTraitInteractions: (horseId: number) => {
    return apiClient.get<TraitInteractionsResponse>(`/api/horses/${horseId}/trait-interactions`);
  },

  /**
   * Get comprehensive epigenetic insights for a horse
   * Includes both genetic and epigenetic traits with full details
   */
  getEpigeneticInsights: (horseId: number) => {
    return apiClient.get<EpigeneticInsightsResponse>(`/api/horses/${horseId}/epigenetic-insights`);
  },

  /**
   * Get trait timeline showing discovery and activation history
   * Useful for understanding how traits developed over time
   */
  getTraitTimeline: (horseId: number) => {
    return apiClient.get<TraitTimelineResponse>(`/api/horses/${horseId}/trait-timeline`);
  },
};

/**
 * React Query hook for fetching trait interactions
 *
 * @param horseId - The ID of the horse
 * @param options - React Query options (enabled, refetchInterval, etc.)
 * @returns UseQueryResult with trait interactions data
 *
 * @example
 * const { data, isLoading, error } = useHorseTraitInteractions(123);
 * if (data) {
 *   data.interactions.forEach(interaction => {
 *     console.log(`${interaction.trait1} + ${interaction.trait2} = ${interaction.effect}`);
 *   });
 * }
 */
export function useHorseTraitInteractions(
  horseId: number,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
    staleTime?: number;
  }
): UseQueryResult<TraitInteractionsResponse, Error> {
  return useQuery({
    queryKey: ['horse', horseId, 'trait-interactions'],
    queryFn: () => geneticsApi.getTraitInteractions(horseId),
    enabled: options?.enabled !== false && !!horseId,
    refetchInterval: options?.refetchInterval,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // Default: 5 minutes
  });
}

/**
 * React Query hook for fetching epigenetic insights
 *
 * @param horseId - The ID of the horse
 * @param options - React Query options (enabled, refetchInterval, etc.)
 * @returns UseQueryResult with comprehensive trait data
 *
 * @example
 * const { data, isLoading, error } = useHorseEpigeneticInsights(123);
 * if (data) {
 *   const legendaryTraits = data.traits.filter(t => t.rarity === 'legendary');
 *   const activeEpigenetic = data.traits.filter(t => t.type === 'epigenetic' && t.isActive);
 * }
 */
export function useHorseEpigeneticInsights(
  horseId: number,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
    staleTime?: number;
  }
): UseQueryResult<EpigeneticInsightsResponse, Error> {
  return useQuery({
    queryKey: ['horse', horseId, 'epigenetic-insights'],
    queryFn: () => geneticsApi.getEpigeneticInsights(horseId),
    enabled: options?.enabled !== false && !!horseId,
    refetchInterval: options?.refetchInterval,
    staleTime: options?.staleTime ?? 10 * 60 * 1000, // Default: 10 minutes (traits change slowly)
  });
}

/**
 * React Query hook for fetching trait timeline
 *
 * @param horseId - The ID of the horse
 * @param options - React Query options (enabled, refetchInterval, etc.)
 * @returns UseQueryResult with trait history timeline
 *
 * @example
 * const { data, isLoading, error } = useHorseTraitTimeline(123);
 * if (data) {
 *   const discoveries = data.timeline.filter(e => e.eventType === 'discovered');
 *   const mutations = data.timeline.filter(e => e.eventType === 'mutated');
 * }
 */
export function useHorseTraitTimeline(
  horseId: number,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
    staleTime?: number;
  }
): UseQueryResult<TraitTimelineResponse, Error> {
  return useQuery({
    queryKey: ['horse', horseId, 'trait-timeline'],
    queryFn: () => geneticsApi.getTraitTimeline(horseId),
    enabled: options?.enabled !== false && !!horseId,
    refetchInterval: options?.refetchInterval,
    staleTime: options?.staleTime ?? 15 * 60 * 1000, // Default: 15 minutes (historical data changes rarely)
  });
}
