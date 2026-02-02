/**
 * Training API Hooks
 *
 * Story 4-1: Training UI Components - Task 2
 *
 * Centralized hooks for training-related API calls:
 * - Train horse (mutation)
 * - Get training status (query)
 * - Training eligibility checks
 * - Discipline status tracking
 *
 * Phase 1: Mock implementation for frontend-first development
 * Phase 2: Will connect to real backend API
 */

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
import { horseQueryKeys } from './useHorses';

// Query Keys
const trainingKeys = {
  all: ['training'] as const,
  trainable: (userId: string) => ['training', 'trainable-horses', userId] as const,
  overview: (horseId: number) => ['training', horseId, 'status'] as const,
  status: (horseId: number, discipline: string) =>
    ['training', horseId, 'status', discipline] as const,
  eligibility: (horseId: number, discipline: string) =>
    ['training', horseId, 'eligibility', discipline] as const,
};

/**
 * Get trainable horses for a user
 * @param userId - UUID of the user (must be authenticated user's UUID from auth context)
 * @example
 * const { user } = useAuth();
 * const { data: horses } = useTrainableHorses(user?.id);
 */
export const useTrainableHorses = (userId: string) =>
  useQuery<TrainableHorse[], ApiError>({
    queryKey: trainingKeys.trainable(userId),
    queryFn: () => trainingApi.getTrainableHorses(userId),
    enabled: Boolean(userId),
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

/**
 * Training Eligibility Check Hook
 *
 * Checks if a horse is eligible to train in a specific discipline
 * Returns eligibility status and reason if not eligible
 */
export const useTrainingEligibility = (horseId: number, discipline: string) =>
  useQuery<TrainingEligibility, ApiError>({
    queryKey: trainingKeys.eligibility(horseId, discipline),
    queryFn: () => trainingApi.checkEligibility({ horseId, discipline }),
    enabled: Boolean(horseId && discipline),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });

/**
 * Train Horse Mutation Hook
 *
 * Executes a training session for a horse in a specific discipline.
 * On success:
 * - Invalidates horse queries to refresh horse data
 * - Invalidates training status queries
 * - Returns training result with stat gains and XP
 *
 * @param userIdForInvalidate - UUID of the user (for cache invalidation after training)
 */
export const useTrainHorse = (userIdForInvalidate?: string) => {
  const queryClient = useQueryClient();

  return useMutation<TrainingResult, ApiError, TrainingRequest>({
    mutationFn: (payload) => trainingApi.train(payload),
    onSuccess: (_data, variables) => {
      // Invalidate horse queries to refresh updated stats
      queryClient.invalidateQueries({
        queryKey: horseQueryKeys.detail(variables.horseId),
      });
      queryClient.invalidateQueries({
        queryKey: horseQueryKeys.all,
      });

      // Invalidate training status queries
      queryClient.invalidateQueries({
        queryKey: trainingKeys.overview(variables.horseId),
      });
      queryClient.invalidateQueries({
        queryKey: trainingKeys.status(variables.horseId, variables.discipline),
      });

      // Invalidate eligibility queries
      queryClient.invalidateQueries({
        queryKey: trainingKeys.eligibility(variables.horseId, variables.discipline),
      });

      // Invalidate trainable horses if userId provided
      if (userIdForInvalidate) {
        queryClient.invalidateQueries({
          queryKey: trainingKeys.trainable(userIdForInvalidate),
        });
      }

      // Invalidate all training queries as fallback
      queryClient.invalidateQueries({ queryKey: trainingKeys.all });
    },
  });
};

/**
 * Legacy alias for backward compatibility
 * @deprecated Use useTrainHorse instead
 */
export const useTrainingSession = useTrainHorse;

export const trainingQueryKeys = trainingKeys;
