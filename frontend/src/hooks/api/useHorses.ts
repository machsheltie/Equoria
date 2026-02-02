import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  HorseSummary,
  HorseTrainingHistoryEntry,
  HorseTrainingAnalytics,
  horsesApi,
} from '@/lib/api-client';

const horseKeys = {
  all: ['horses'] as const,
  detail: (horseId: number) => ['horses', horseId] as const,
  trainingHistory: (horseId: number) => ['horses', horseId, 'training-history'] as const,
};

export const useHorses = () =>
  useQuery<HorseSummary[], ApiError>({
    queryKey: horseKeys.all,
    queryFn: horsesApi.list,
    staleTime: 0, // Always refetch on mount to ensure fresh data
  });

export const useHorse = (horseId: number) =>
  useQuery<HorseSummary, ApiError>({
    queryKey: horseKeys.detail(horseId),
    queryFn: () => horsesApi.get(horseId),
    enabled: Boolean(horseId),
    staleTime: 60 * 1000,
  });

export const useHorseTrainingHistory = (horseId: number) =>
  useQuery<HorseTrainingAnalytics, ApiError, HorseTrainingHistoryEntry[]>({
    queryKey: horseKeys.trainingHistory(horseId),
    queryFn: () => horsesApi.getTrainingHistory(horseId),
    enabled: Boolean(horseId),
    staleTime: 30 * 1000,
    select: (data) => data.trainingHistory, // Extract the array from the analytics object
  });

export const horseQueryKeys = horseKeys;
