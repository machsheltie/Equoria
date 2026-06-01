/**
 * Competitions API client (Equoria-jog8w, Equoria-aodym slice 2).
 *
 * NOTE: distinct from ./api/competitions.ts, which hosts the standalone
 * fetchCompetitions/fetchCompetitionDetails/... function surface used by the
 * competition-entry UI. This module hosts the `competitionsApi` object that
 * the api-client barrel re-exports.
 *
 * Path registry:
 *   GET  /api/v1/competition                        → Competition[]
 *   GET  /api/v1/competition/disciplines            → disciplines + details
 *   GET  /api/v1/competition/eligibility/:id/:disc  → eligibility
 *   POST /api/v1/competition/enter                  → entry
 *   GET  /api/v1/competitions/:id/entries           → entered horses (minimal)
 *   GET  /api/v1/competition/show/:showId/entries   → scouting field
 *   GET  /api/v1/horses/user/eligible               → eligible user horses
 */

import { apiClient } from '../http/apiClient.js';
import type { Competition, EligibilityResult } from './types.js';

/** Scouting field response — GET /api/v1/competition/show/:showId/entries */
export interface ShowFieldEntry {
  entryId: number;
  enteredAt: string;
  horseId: number;
  name: string;
  breed: string | null;
  level: number | null;
  ownerId: string | null;
  ownerName: string | null;
  topStats: Array<{ name: string; value: number }>;
}
export interface ShowFieldResponse {
  success: boolean;
  show: {
    id: number;
    name: string;
    discipline: string;
    entryFee: number;
    maxEntries: number | null;
    status: string;
    closeDate: string | null;
  };
  entryCount: number;
  maxEntries: number | null;
  daysRemaining: number | null;
  entries: ShowFieldEntry[];
}

export const competitionsApi = {
  list: () => apiClient.get<Competition[]>('/api/v1/competition'),
  getDisciplines: () =>
    apiClient.get<{ disciplines: string[]; disciplineDetails: Record<string, unknown>[] }>(
      '/api/v1/competition/disciplines'
    ),
  checkEligibility: (horseId: number, discipline: string) =>
    apiClient.get<{
      horseId: number;
      horseName: string;
      discipline: string;
      eligibility: EligibilityResult;
    }>(`/api/v1/competition/eligibility/${horseId}/${encodeURIComponent(discipline)}`),
  enter: (data: { horseId: number; competitionId: number }) =>
    apiClient.post<{ entryId: number; horseId: number; showId: number; entryFee: number }>(
      '/api/v1/competition/enter',
      {
        horseId: data.horseId,
        showId: data.competitionId,
      }
    ),
  /**
   * Get the list of horses already entered into a given competition.
   * Returns minimal entry data — used by HorseSelector to mark horses as
   * "already entered" so users can't double-enter the same competition.
   */
  getEntries: (competitionId: number) =>
    apiClient.get<Array<{ horseId: number; horseName: string }>>(
      `/api/v1/competitions/${competitionId}/entries`
    ),
  /**
   * Scouting (Equoria-lfkw1, UX-spec 11.3.5 / Journey 4). Returns the REAL
   * entered field for an open show: per entered horse breed / level /
   * top-3 stats / owner, plus header (entry count, max, days remaining,
   * status). Used by CompetitionFieldPreview.
   */
  getShowField: (showId: number) =>
    apiClient.get<ShowFieldResponse>(`/api/v1/competition/show/${showId}/entries`),
  /**
   * Get the current user's horses that are eligible for competition entry.
   * Eligibility filtering (age, health, etc.) is applied per-horse in the
   * HorseSelector UI; this endpoint returns the candidate set.
   */
  getEligibleUserHorses: () =>
    apiClient.get<
      Array<{
        id: number;
        name: string;
        age: number;
        sex: string;
        level: number;
        health: string;
        disciplines: Record<string, number>;
      }>
    >('/api/v1/horses/user/eligible'),
};
