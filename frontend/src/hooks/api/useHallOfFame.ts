/**
 * Hall of Fame hooks (Equoria-vb1n0).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/lib/api-client';
import {
  hallOfFameApi,
  type HallOfFameData,
  type HorseHallOfFameStatus,
} from '@/lib/api/hallOfFame';

export const hallOfFameKeys = {
  all: ['hall-of-fame'] as const,
  horse: (horseId: number) => ['hall-of-fame', 'horse', horseId] as const,
};

export const useHallOfFame = () =>
  useQuery<HallOfFameData, ApiError>({
    queryKey: hallOfFameKeys.all,
    queryFn: hallOfFameApi.get,
    staleTime: 60 * 1000,
    // Owner ruling 2026-10-23 (Equoria-m00gp, option a): offline ends in an
    // error with Try again, never a paused (endless) loading state.
    networkMode: 'always',
  });

export const useHorseHallOfFameStatus = (horseId: number, enabled: boolean) =>
  useQuery<HorseHallOfFameStatus, ApiError>({
    queryKey: hallOfFameKeys.horse(horseId),
    queryFn: () => hallOfFameApi.horseStatus(horseId),
    enabled: enabled && Boolean(horseId),
    staleTime: 60 * 1000,
  });

export const useNominateHorse = (horseId: number) => {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, void>({
    mutationFn: () => hallOfFameApi.nominate(horseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hallOfFameKeys.all }),
  });
};

export const useHallOfFameVote = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, number>({
    mutationFn: (candidateId) => hallOfFameApi.vote(candidateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hallOfFameKeys.all }),
  });
};
