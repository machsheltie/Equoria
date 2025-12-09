import { useQuery } from '@tanstack/react-query';
import { ApiError, HorseStats, horsesApi } from '@/lib/api-client';

const statsKeys = {
  all: ['horse-stats'] as const,
  detail: (horseId: number) => ['horse-stats', horseId] as const,
};

export const useHorseStats = (horseId: number) =>
  useQuery<HorseStats, ApiError>({
    queryKey: statsKeys.detail(horseId),
    queryFn: () => horsesApi.getStats(horseId),
    enabled: Boolean(horseId),
    staleTime: 60 * 1000, // 1 minute
  });

export const statsQueryKeys = statsKeys;
