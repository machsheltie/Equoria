/**
 * Hall of Fame API (Equoria-vb1n0, owner rulings 2026-10-28).
 *
 *   GET  /api/v1/hall-of-fame                 nominees (open rounds) + inducted horses
 *   GET  /api/v1/hall-of-fame/horses/:horseId  the owner's standing for one horse
 *   POST /api/v1/hall-of-fame/nominations      { horseId } nominate, once ever
 *   POST /api/v1/hall-of-fame/votes            { candidateId } one vote per round
 */

import { apiClient } from '../http/apiClient.js';

export interface HallOfFameHorse {
  horseId: number;
  horseName: string;
  breedName: string | null;
  ownerName: string | null;
}

export interface HallOfFameNominee extends HallOfFameHorse {
  candidateId: number;
}

/** One voting round: the week's round, or a one-day run-off of a tie. */
export interface HallOfFameRound {
  roundId: number;
  isRunoff: boolean;
  endsAt: string;
  /** The nominee this player voted for in this round, or null. */
  myVoteCandidateId: number | null;
  nominees: HallOfFameNominee[];
}

export interface HallOfFameInductee extends HallOfFameHorse {
  inductedAt: string;
}

export interface HallOfFameData {
  rounds: HallOfFameRound[];
  inductees: HallOfFameInductee[];
}

export interface HorseHallOfFameStatus {
  canNominate: boolean;
  nominated: boolean;
  inducted: boolean;
}

export const hallOfFameApi = {
  get: () => apiClient.get<HallOfFameData>('/api/v1/hall-of-fame'),
  horseStatus: (horseId: number) =>
    apiClient.get<HorseHallOfFameStatus>(`/api/v1/hall-of-fame/horses/${horseId}`),
  nominate: (horseId: number) =>
    apiClient.post<{ id: number; horseId: number }>('/api/v1/hall-of-fame/nominations', {
      horseId,
    }),
  vote: (candidateId: number) =>
    apiClient.post<{ id: number; roundId: number; candidateId: number }>(
      '/api/v1/hall-of-fame/votes',
      { candidateId }
    ),
};
