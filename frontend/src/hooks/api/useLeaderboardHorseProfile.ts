/**
 * useLeaderboardHorseProfile Hook
 *
 * Leaderboard System - Real horse profile query for the horse-detail modal
 * (Equoria-8nfc).
 *
 * Fetches the real persisted horse profile (breed, age, sex, stats, earnings,
 * competition tallies) backing a leaderboard entry, replacing the previously
 * fabricated placeholder data (age:0, hardcoded sex/stats) shown in the
 * leaderboard detail modal.
 *
 * Features:
 * - Conditional fetching (disabled until a valid horseId is supplied — the
 *   modal only opens for entries that carry a real horseId)
 * - 2 minute staleTime (horse stats change at training/competition cadence,
 *   not real-time) — matches the Horse Details cache policy in
 *   PATTERN_LIBRARY.md
 * - 10 minute gcTime for cache retention
 *
 * @example
 * const { data, isLoading, error } = useLeaderboardHorseProfile(horseId);
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchLeaderboardHorseProfile,
  LeaderboardHorseProfile,
  LeaderboardApiError,
} from '@/lib/api/leaderboards';

/**
 * Query keys for leaderboard horse-profile queries.
 */
export const leaderboardHorseProfileQueryKeys = {
  all: ['leaderboards', 'horse-profile'] as const,
  horse: (horseId: number) => ['leaderboards', 'horse-profile', horseId] as const,
};

/**
 * Fetch the real horse profile backing a leaderboard entry.
 *
 * @param horseId - Horse id from the leaderboard entry. When null/undefined
 *   or <= 0 the query is disabled (no entry selected / no real horse).
 * @param enabled - Optional override to gate the query (e.g. modal closed).
 * @returns React Query result with data, loading states, error, refetch
 */
export function useLeaderboardHorseProfile(horseId: number | null | undefined, enabled = true) {
  const validId = typeof horseId === 'number' && horseId > 0;

  return useQuery<LeaderboardHorseProfile, LeaderboardApiError>({
    queryKey: leaderboardHorseProfileQueryKeys.horse(validId ? (horseId as number) : 0),
    queryFn: () => fetchLeaderboardHorseProfile(horseId as number),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    enabled: enabled && validId,
  });
}

export type { LeaderboardHorseProfile };
