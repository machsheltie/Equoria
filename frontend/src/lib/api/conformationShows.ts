/**
 * Conformation Show API client (Equoria-rfsml).
 *
 * Backend routes mounted at /api/v1/competition/conformation/* (Equoria-pety wired
 * the sub-router into competitionRoutes.mjs). All three endpoints require an
 * authenticated session; mutations also acquire a CSRF token via the standard
 * fetchWithAuth path.
 *
 * Endpoints (controller: backend/modules/competition/controllers/conformationShowController.mjs):
 *   POST /enter                  — enter a horse + groom; debits the show's entry fee
 *   GET  /eligibility/:horseId   — check whether a horse can enter conformation shows
 *   GET  /titles/:horseId        — query a horse's accumulated title points + current title
 *
 * There is no settle/execute endpoint (Equoria-mwjst): the nightly show job
 * settles a conformation show once its closing date has passed.
 */

import { apiClient } from '../http/apiClient.js';

export interface ConformationShowEntryPayload {
  horseId: number;
  groomId: number;
  showId: number;
  className: string;
}

export interface ConformationShowEntryResult {
  entryId: number;
  horseId: number;
  showId: number;
  ageClass: string;
  className: string;
  /** The entry fee actually debited (the show's configured fee). */
  feePaid: number;
  warnings: string[];
}

export interface ConformationShowEligibilityResult {
  horseId: number;
  horseName: string;
  eligible: boolean;
  errors: string[];
  warnings: string[];
  ageClass: string;
  groomAssigned: boolean;
}

export interface ConformationShowTitlesResult {
  horseId: number;
  horseName: string;
  titlePoints: number;
  currentTitle: string | null;
  breedingValueBoost: number;
}

export const conformationShowsApi = {
  /**
   * Enter a horse in a conformation show.
   * Equoria-1vkm — wires the POST /enter endpoint behind a typed wrapper.
   */
  enter: (payload: ConformationShowEntryPayload) =>
    apiClient.post<ConformationShowEntryResult>('/api/v1/competition/conformation/enter', payload),

  /**
   * Check eligibility of a horse for conformation shows.
   * Equoria-1vkm — wires GET /eligibility/:horseId.
   */
  getEligibility: (horseId: number) =>
    apiClient.get<ConformationShowEligibilityResult>(
      `/api/v1/competition/conformation/eligibility/${horseId}`
    ),

  /**
   * Query a horse's accumulated title data.
   * Equoria-349l — wires GET /titles/:horseId.
   */
  getTitles: (horseId: number) =>
    apiClient.get<ConformationShowTitlesResult>(
      `/api/v1/competition/conformation/titles/${horseId}`
    ),
};
