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
 *        ?level=N (1-20) lists only the shows open to that level (Equoria-i33ow)
 *   GET  /api/v1/competition/disciplines            → disciplines + details
 *   GET  /api/v1/competition/eligibility/:id/:disc  → eligibility
 *   POST /api/v1/competition/enter                  → entry
 *   GET  /api/v1/competition/show/:showId/entries   → scouting field
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

/**
 * The list endpoint pages its open shows (100 at most per page). A page shorter
 * than the page size is the last one, so the list is walked until then and the
 * Arena filters see every open show, not the first twenty (Equoria-fyoca).
 */
const listPageSize = 100;
// A safety stop against a server that never answers a short page; 100 pages is
// 10,000 open shows, far past anything the game can hold open at once.
const listMaxPages = 100;

async function listAllOpenShows(level?: number): Promise<Competition[]> {
  const shows: Competition[] = [];
  const levelQuery = level === undefined ? '' : `&level=${level}`;
  for (let page = 1; page <= listMaxPages; page += 1) {
    const rows = await apiClient.get<Competition[]>(
      `/api/v1/competition?limit=${listPageSize}&page=${page}${levelQuery}`
    );
    shows.push(...rows);
    if (rows.length < listPageSize) break;
  }
  return shows;
}

export const competitionsApi = {
  list: listAllOpenShows,
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
   * Scouting (Equoria-lfkw1, UX-spec 11.3.5 / Journey 4). Returns the REAL
   * entered field for an open show: per entered horse breed / level /
   * top-3 stats / owner, plus header (entry count, max, days remaining,
   * status). Used by CompetitionFieldPreview.
   */
  getShowField: (showId: number) =>
    apiClient.get<ShowFieldResponse>(`/api/v1/competition/show/${showId}/entries`),
};
