import { useQuery } from '@tanstack/react-query';
import { ApiError, HorseAge, horsesApi } from '@/lib/api-client';

const ageKeys = {
  all: ['age'] as const,
  detail: (horseId: number) => ['age', horseId] as const,
};

export const useHorseAge = (horseId: number) =>
  useQuery<HorseAge, ApiError>({
    queryKey: ageKeys.detail(horseId),
    queryFn: () => horsesApi.getAge(horseId),
    enabled: Boolean(horseId),
    staleTime: 60 * 1000, // 1 minute
  });

export const ageQueryKeys = ageKeys;
