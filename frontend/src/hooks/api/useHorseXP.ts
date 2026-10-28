import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, HorseXP, HorseXPHistory, horsesApi } from '@/lib/api-client';
import type { AllocateStatResult } from '@/lib/api/horses';

const xpKeys = {
  all: ['xp'] as const,
  detail: (horseId: number) => ['xp', horseId] as const,
  history: (horseId: number, options?: { limit?: number; offset?: number }) =>
    ['xp', horseId, 'history', options] as const,
};

export const useHorseXP = (horseId: number) =>
  useQuery<HorseXP, ApiError>({
    queryKey: xpKeys.detail(horseId),
    queryFn: () => horsesApi.getXP(horseId),
    enabled: Boolean(horseId),
    staleTime: 60 * 1000, // 1 minute
  });

export const useHorseXPHistory = (horseId: number, options?: { limit?: number; offset?: number }) =>
  useQuery<HorseXPHistory, ApiError>({
    queryKey: xpKeys.history(horseId, options),
    queryFn: () => horsesApi.getXPHistory(horseId, options),
    enabled: Boolean(horseId),
    staleTime: 30 * 1000, // 30 seconds
  });

/**
 * Spend one earned stat allocation (Equoria-a0fim; bible Vol 13: every 1,000
 * Horse Points earns one player-directed stat allocation). On success the
 * horse's Points status and everything under its ['horses', id] prefix (its
 * page, its Discipline Scores) refresh, since the stat changed.
 */
export const useAllocateStat = (horseId: number) => {
  const queryClient = useQueryClient();
  return useMutation<AllocateStatResult, ApiError, string>({
    mutationFn: (statName) => horsesApi.allocateStat(horseId, statName),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: xpKeys.detail(horseId) });
      void queryClient.invalidateQueries({ queryKey: ['horses', horseId] });
    },
  });
};

export const xpQueryKeys = xpKeys;
