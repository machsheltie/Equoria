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

    // Normalize the backend response into the canonical TrainingResult shape
    // consumed across the training UI (Equoria-pw7d0).
    //
    // The real backend route (trainRouteHandler) emits a FLAT body using the
    // deprecated `nextEligibleDate` field (ISO string) plus a flat
    // `updatedScore`, and does NOT send `nextEligible` or `updatedHorse`. The
    // previous mapping read `result.nextEligible` (always absent on the real
    // path) and so overwrote the real `nextEligibleDate` with '' — which
    // TrainingResultsDisplay then rendered as "Invalid Date". Derive the
    // canonical `nextEligible` from whichever field is actually present and
    // NEVER clobber a real value.
    const nextEligible = result.nextEligible ?? result.nextEligibleDate ?? null;

    // Real backend (trainRouteHandler) sends a flat `updatedScore`. The former
    // `updatedHorse.discipline_scores` fallback was dead and casing-mismatched
    // (Equoria-xfdcg): nothing ever emits `updatedHorse`, and the internal
    // service result uses camelCase `disciplineScores`, never the snake_case
    // `discipline_scores` the dead type claimed. Read the flat field directly.
    const updatedScore = result.updatedScore ?? 0;

    return {
      ...result,
      nextEligible,
      nextEligibleDate: nextEligible ?? '',
      updatedScore,
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
