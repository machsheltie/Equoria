/**
 * Training API client (Equoria-jog8w, Equoria-aodym slice 2).
 *
 * Path registry:
 *   GET  /api/v1/training/trainable/:userId            → TrainableHorse[]
 *   POST /api/v1/training/check-eligibility            → TrainingEligibility
 *   POST /api/v1/training/train                        → TrainingResult
 *   GET  /api/v1/training/status/:horseId/:discipline  → DisciplineStatus
 *   GET  /api/v1/training/status/:horseId              → DisciplineStatus[] | map
 */

import { apiClient } from '../http/apiClient.js';
import type {
  DisciplineStatus,
  TrainableHorse,
  TrainingEligibility,
  TrainingRequest,
  TrainingResult,
} from './types.js';

export const trainingApi = {
  /**
   * Get trainable horses for a user
   * @param userId - UUID of the user (must be authenticated user's UUID)
   */
  getTrainableHorses: (userId: string) => {
    return apiClient.get<TrainableHorse[]>(`/api/v1/training/trainable/${userId}`);
  },
  checkEligibility: (payload: TrainingRequest) => {
    return apiClient.post<TrainingEligibility>('/api/v1/training/check-eligibility', payload);
  },
  train: async (payload: TrainingRequest): Promise<TrainingResult> => {
    const result = await apiClient.post<TrainingResult>('/api/v1/training/train', payload);

    // Add backward-compatible fields for existing components
    if (result.updatedHorse && result.updatedHorse.discipline_scores) {
      const score = result.updatedHorse.discipline_scores[payload.discipline];
      return {
        ...result,
        updatedScore: score ?? 0,
        nextEligibleDate: result.nextEligible ?? '',
        discipline: payload.discipline,
        horseId: payload.horseId,
      };
    }

    // Fallback if no updated horse or scores
    return {
      ...result,
      updatedScore: 0,
      nextEligibleDate: result.nextEligible ?? '',
      discipline: payload.discipline,
      horseId: payload.horseId,
    };
  },
  getDisciplineStatus: (horseId: number, discipline: string) => {
    return apiClient.get<DisciplineStatus>(
      `/api/v1/training/status/${horseId}/${encodeURIComponent(discipline)}`
    );
  },
  getHorseStatus: (horseId: number) => {
    return apiClient.get<DisciplineStatus[] | Record<string, Omit<DisciplineStatus, 'discipline'>>>(
      `/api/v1/training/status/${horseId}`
    );
  },
};
