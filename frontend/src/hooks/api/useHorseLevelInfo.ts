/**
 * useHorseLevelInfo Hook
 *
 * XP System - Horse level and XP progress query
 *
 * Fetches a horse's current level, XP progress, and level thresholds including:
 * - Current level and XP amounts
 * - XP earned within current level and XP to next level
 * - Total lifetime XP and progress percentage
 * - Level threshold map for progression display
 *
 * Features:
 * - Conditional fetching (disabled when horseId is 0 or negative)
 * - 2 minute staleTime (XP may change frequently from competitions/training)
 * - 5 minute gcTime for cache retention
 * - Auto-updates when horse ID changes
 *
 * @example
 * // Fetch horse level info
 * const { data, isLoading, error } = useHorseLevelInfo(123);
 *
 * // Access level data
 * if (data) {
 *   console.log(`Level ${data.currentLevel}: ${data.progressPercent}% to next`);
 * }
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchHorseLevelInfo,
  HorseLevelInfo,
  XpApiError,
} from '@/lib/api/xp';

/**
 * Query keys for horse level info queries
 *
 * Structure:
 * - all: ['horseLevelInfo'] - Base key for all level info queries
 * - horse: ['horseLevelInfo', horseId] - Specific horse level info by ID
 *
 * Used for:
 * - Cache management
 * - Query invalidation after XP gains
 * - Prefetching horse data
 */
export const horseLevelInfoQueryKeys = {
  all: ['horseLevelInfo'] as const,
  horse: (horseId: number) => ['horseLevelInfo', horseId] as const,
};

/**
 * Fetch a horse's level and XP progress information
 *
 * @param horseId - Horse ID (0 or negative disables the query)
 * @returns Query result with data, loading states, error, and refetch function
 *
 * Query Options:
 * - enabled: Only fetches when horseId > 0
 * - staleTime: 2 minutes - XP may change frequently
 * - gcTime: 5 minutes - Cache retained for 5 minutes after unmount
 */
export function useHorseLevelInfo(horseId: number) {
  return useQuery<HorseLevelInfo, XpApiError>({
    queryKey: horseLevelInfoQueryKeys.horse(horseId),
    queryFn: () => fetchHorseLevelInfo(horseId),
    staleTime: 2 * 60 * 1000, // 2 minutes - may change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes - cache retention
    enabled: horseId > 0, // Only run if valid horseId
  });
}

/**
 * Export types for external use
 */
export type { HorseLevelInfo };
