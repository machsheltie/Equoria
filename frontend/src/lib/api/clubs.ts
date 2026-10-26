/**
 * Clubs API client (Equoria-rfsml).
 *
 *   GET    /api/v1/clubs                               → { clubs: Club[] }
 *   GET    /api/v1/clubs/mine                          → { memberships: ClubMembership[] }
 *   GET    /api/v1/clubs/:id                           → { club: Club & members }
 *   POST   /api/v1/clubs                               → { club: Club }
 *   POST   /api/v1/clubs/:id/join                      → { membership: ClubMembership }
 *   DELETE /api/v1/clubs/:id/leave                     → void
 *   GET    /api/v1/clubs/:id/elections                 → { elections: ClubElection[] }
 *   GET    /api/v1/clubs/elections/open-count          → { count: number }
 *   POST   /api/v1/clubs/:id/elections                 → { election: ClubElection }
 *   POST   /api/v1/clubs/elections/:id/nominate        → void
 *   POST   /api/v1/clubs/elections/:id/vote            → void
 *   GET    /api/v1/clubs/elections/:id/results         → { election, candidates }
 *   PATCH  /api/v1/clubs/:id/transfer-leadership       → { success: true }
 */

import { apiClient } from '../http/apiClient.js';

export type ClubType = 'discipline' | 'breed';
export type ClubRole = 'member' | 'officer' | 'president';
export type ElectionStatus = 'upcoming' | 'open' | 'closed';

export interface Club {
  id: number;
  name: string;
  type: ClubType;
  category: string;
  description: string;
  leader: { id: string; username: string };
  memberCount: number;
  createdAt: string;
}

export interface ClubMembership {
  id: number;
  club: Club;
  role: ClubRole;
  joinedAt: string;
}

/** Shape of a single member entry inside a club's member list (GET /api/v1/clubs/:id). */
export interface ClubMember {
  id: number;
  user: { id: string; username: string };
  role: ClubRole;
  joinedAt: string;
}

export interface ClubElection {
  id: number;
  clubId: number;
  position: string;
  status: ElectionStatus;
  startsAt: string;
  endsAt: string;
}

export interface ElectionCandidate {
  id: number;
  user: { id: string; username: string };
  statement: string;
  voteCount: number;
}

/**
 * The lists answer at most 100 at a time (Equoria-cmw85.22). `nextCursor` is the
 * server's own cursor for the following page, null on the last one.
 */
export interface ClubPageInfo {
  nextCursor: string | null;
  hasMore: boolean;
}

const withCursor = (params: URLSearchParams, cursor?: string) => {
  if (cursor) params.set('cursor', cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export const clubsApi = {
  getClubs: (type?: ClubType, category?: string, cursor?: string) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (category) params.set('category', category);
    return apiClient.get<{ clubs: Club[]; pageInfo?: ClubPageInfo }>(
      `/api/v1/clubs${withCursor(params, cursor)}`
    );
  },
  getMyClubs: (cursor?: string) =>
    apiClient.get<{ memberships: ClubMembership[]; pageInfo?: ClubPageInfo }>(
      `/api/v1/clubs/mine${withCursor(new URLSearchParams(), cursor)}`
    ),
  getClub: (id: number) =>
    apiClient.get<{ club: Club & { members: ClubMember[] } }>(`/api/v1/clubs/${id}`),
  createClub: (payload: { name: string; type: ClubType; category: string; description: string }) =>
    apiClient.post<{ club: Club }>('/api/v1/clubs', payload),
  joinClub: (id: number) =>
    apiClient.post<{ membership: ClubMembership }>(`/api/v1/clubs/${id}/join`, {}),
  leaveClub: (id: number) => apiClient.delete<void>(`/api/v1/clubs/${id}/leave`),
  getElections: (clubId: number, cursor?: string) =>
    apiClient.get<{ elections: ClubElection[]; pageInfo?: ClubPageInfo }>(
      `/api/v1/clubs/${clubId}/elections${withCursor(new URLSearchParams(), cursor)}`
    ),
  /** Count of open elections across the caller's clubs — Equoria-r4cyk. */
  getOpenElectionsCount: () =>
    apiClient.get<{ count: number }>('/api/v1/clubs/elections/open-count'),
  createElection: (
    clubId: number,
    payload: { position: string; startsAt: string; endsAt: string }
  ) => apiClient.post<{ election: ClubElection }>(`/api/v1/clubs/${clubId}/elections`, payload),
  nominate: (electionId: number, statement: string) =>
    apiClient.post<void>(`/api/v1/clubs/elections/${electionId}/nominate`, { statement }),
  vote: (electionId: number, candidateId: number) =>
    apiClient.post<void>(`/api/v1/clubs/elections/${electionId}/vote`, { candidateId }),
  getResults: (electionId: number) =>
    apiClient.get<{ election: ClubElection; candidates: ElectionCandidate[] }>(
      `/api/v1/clubs/elections/${electionId}/results`
    ),
  transferLeadership: (clubId: number, newPresidentId: string) =>
    apiClient.patch<{ success: true }>(`/api/v1/clubs/${clubId}/transfer-leadership`, {
      newPresidentId,
    }),
};
