import { useQuery } from '@tanstack/react-query';
import { ApiError, HorseXP, HorseXPHistory, horsesApi } from '@/lib/api-client';

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

export const xpQueryKeys = xpKeys;
