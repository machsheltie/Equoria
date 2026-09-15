import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    staleTime: 2 * 60 * 1000, // 2 minutes — core entity, moderate update frequency
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

export const useUpdateHorse = () => {
  const queryClient = useQueryClient();
  return useMutation<
    HorseSummary,
    ApiError,
    { horseId: number; data: { sex?: string; dateOfBirth?: string } }
  >({
    mutationFn: ({ horseId, data }) => horsesApi.update(horseId, data),
    onSuccess: (_result, { horseId }) => {
      queryClient.invalidateQueries({ queryKey: horseKeys.detail(horseId) });
      queryClient.invalidateQueries({ queryKey: horseKeys.all });
      queryClient.invalidateQueries({ queryKey: ['next-actions'] });
    },
  });
};

/**
 * Rename a horse through the dedicated endpoint (Equoria-4fnro).
 *
 * WHY NOT `useUpdateHorse`: renaming used to ride on PUT /horses/:id, a
 * mass-assignment route that also takes sex, dateOfBirth and parentage. The
 * owner ruled that the form uses the dedicated rename endpoint and the older
 * route stops renaming, so this is the only mutation in the frontend that can
 * change a horse's name.
 *
 * Every surface that shows a horse's name is invalidated, because the name is
 * on all of them — the horse's own page, the roster, and the next-actions
 * prompts that call horses by name.
 */
export const useRenameHorse = () => {
  const queryClient = useQueryClient();
  return useMutation<{ id: number; name: string }, ApiError, { horseId: number; name: string }>({
    mutationFn: ({ horseId, name }) => horsesApi.rename(horseId, name),
    onSuccess: (_result, { horseId }) => {
      queryClient.invalidateQueries({ queryKey: horseKeys.detail(horseId) });
      queryClient.invalidateQueries({ queryKey: horseKeys.all });
      queryClient.invalidateQueries({ queryKey: ['next-actions'] });
    },
  });
};

export const horseQueryKeys = horseKeys;
