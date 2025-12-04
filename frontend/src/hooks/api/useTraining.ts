import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  DisciplineStatus,
  TrainableHorse,
  TrainingEligibility,
  TrainingRequest,
  TrainingResult,
  trainingApi,
} from '@/lib/api-client';

const trainingKeys = {
  all: ['training'] as const,
  trainable: (userId: string | number) => ['training', 'trainable-horses', userId] as const,
  overview: (horseId: number) => ['training', horseId, 'status'] as const,
  status: (horseId: number, discipline: string) =>
    ['training', horseId, 'status', discipline] as const,
};

export const useTrainableHorses = (userId: string | number = 'me') =>
  useQuery<TrainableHorse[], ApiError>({
    queryKey: trainingKeys.trainable(userId),
    queryFn: () => trainingApi.getTrainableHorses(typeof userId === 'number' ? String(userId) : userId),
    staleTime: 60 * 1000,
  });

export const useTrainingStatus = (horseId: number, discipline: string) =>
  useQuery<DisciplineStatus, ApiError>({
    queryKey: trainingKeys.status(horseId, discipline),
    queryFn: () => trainingApi.getDisciplineStatus(horseId, discipline),
    enabled: Boolean(horseId && discipline),
    staleTime: 30 * 1000,
  });

export const useTrainingOverview = (horseId: number) =>
  useQuery<DisciplineStatus[], ApiError>({
    queryKey: trainingKeys.overview(horseId),
    queryFn: async () => {
      const raw = await trainingApi.getHorseStatus(horseId);
      // Backend may return a record keyed by discipline; normalize to array
      if (Array.isArray(raw)) {
        return raw;
      }
      return Object.entries(raw as Record<string, Omit<DisciplineStatus, 'discipline'>>).map(
        ([discipline, status]) => ({
          discipline,
          ...status,
        })
      );
    },
    enabled: Boolean(horseId),
    staleTime: 30 * 1000,
  });

export const useTrainingEligibility = () =>
  useMutation<TrainingEligibility, ApiError, TrainingRequest>({
    mutationFn: (payload) => trainingApi.checkEligibility(payload),
  });

export const useTrainingSession = (userIdForInvalidate: string | number = 'me') => {
  const queryClient = useQueryClient();

  return useMutation<TrainingResult, ApiError, TrainingRequest>({
    mutationFn: (payload) => trainingApi.train(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.overview(variables.horseId) });
      queryClient.invalidateQueries({ queryKey: trainingKeys.trainable(userIdForInvalidate) });
      queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      queryClient.invalidateQueries({ queryKey: ['horses'] });
    },
  });
};

export const trainingQueryKeys = trainingKeys;
