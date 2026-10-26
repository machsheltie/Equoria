/**
 * useClubs hooks (Epic 19B-3)
 *
 * React Query hooks for the clubs and elections system.
 *   - useClubs()          → { data: { clubs: Club[] }, isLoading, error }
 *   - useMyClubs()        → { data: { memberships: ClubMembership[] }, isLoading }
 *   - useClub(id)         → { data: { club: Club }, isLoading }
 *   - useJoinClub()       → mutation(clubId)
 *   - useLeaveClub()      → mutation(clubId)
 *   - useCreateClub()     → mutation(payload)
 *   - useClubElections()  → { data: { elections }, isLoading }
 *   - useOpenElectionsCount() → { data: { count }, isLoading }
 *   - useElectionResults()→ { data: { election, candidates }, isLoading }
 */

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clubsApi, ClubType } from '@/lib/api-client';
import type { ClubPageInfo } from '@/lib/api/clubs';

/**
 * The club lists come 100 at a time. Each list hook reads the server's cursor
 * (pageInfo.nextCursor) and joins the pages loaded so far into the one list the
 * screens already read; `hasNextPage` / `fetchNextPage` bring in the next page.
 */
const nextCursorOf = <T extends { pageInfo?: ClubPageInfo }>(last: T) =>
  last.pageInfo?.nextCursor ?? undefined;

export function useClubs(type?: ClubType, category?: string) {
  return useInfiniteQuery({
    queryKey: ['clubs', 'list', type, category],
    queryFn: ({ pageParam }) => clubsApi.getClubs(type, category, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursorOf,
    select: (data) => ({ clubs: data.pages.flatMap((p) => p.clubs) }),
    staleTime: 5 * 60_000,
    // Owner ruling 2026-10-23 (Equoria-m00gp, option a): the community hub shows
    // an honest error with Try again when this cannot load. The default
    // networkMode 'online' pauses an offline query (no data, no error) instead.
    networkMode: 'always',
  });
}

export function useMyClubs() {
  return useInfiniteQuery({
    queryKey: ['clubs', 'mine'],
    queryFn: ({ pageParam }) => clubsApi.getMyClubs(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursorOf,
    select: (data) => ({ memberships: data.pages.flatMap((p) => p.memberships) }),
    staleTime: 2 * 60_000,
  });
}

export function useClub(id: number) {
  return useQuery({
    queryKey: ['clubs', id],
    queryFn: () => clubsApi.getClub(id),
    enabled: !!id,
    staleTime: 2 * 60_000,
  });
}

export function useJoinClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => clubsApi.joinClub(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useLeaveClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => clubsApi.leaveClub(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useCreateClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      type: ClubType;
      category: string;
      description: string;
    }) => clubsApi.createClub(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useClubElections(clubId: number) {
  return useInfiniteQuery({
    queryKey: ['clubs', clubId, 'elections'],
    queryFn: ({ pageParam }) => clubsApi.getElections(clubId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursorOf,
    select: (data) => ({ elections: data.pages.flatMap((p) => p.elections) }),
    enabled: !!clubId,
    staleTime: 2 * 60_000,
  });
}

/**
 * Count of elections currently open across the caller's clubs
 * (Equoria-r4cyk: gates the community-hub "Elections open" badge on real
 * election state — the badge renders only when this count is > 0).
 */
export function useOpenElectionsCount() {
  return useQuery({
    queryKey: ['clubs', 'elections', 'open-count'],
    queryFn: () => clubsApi.getOpenElectionsCount(),
    staleTime: 60_000,
    // Owner ruling 2026-10-23 (Equoria-m00gp, option a): the community hub shows
    // an honest error with Try again when this cannot load. The default
    // networkMode 'online' pauses an offline query (no data, no error) instead.
    networkMode: 'always',
  });
}

export function useNominate(electionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (statement: string) => clubsApi.nominate(electionId, statement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elections', electionId, 'results'] });
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useVote(electionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateId: number) => clubsApi.vote(electionId, candidateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elections', electionId, 'results'] });
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useElectionResults(electionId: number) {
  return useQuery({
    queryKey: ['elections', electionId, 'results'],
    queryFn: () => clubsApi.getResults(electionId),
    enabled: !!electionId,
    staleTime: 60_000,
  });
}

export function useTransferLeadership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clubId, newPresidentId }: { clubId: number; newPresidentId: string }) =>
      clubsApi.transferLeadership(clubId, newPresidentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}
