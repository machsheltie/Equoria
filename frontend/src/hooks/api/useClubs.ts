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
 *   - useElectionResults()→ { data: { election, candidates }, isLoading }
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clubsApi, ClubType } from '@/lib/api-client';

export function useClubs(type?: ClubType, category?: string) {
  return useQuery({
    queryKey: ['clubs', type, category],
    queryFn: () => clubsApi.getClubs(type, category),
    staleTime: 5 * 60_000,
  });
}

export function useMyClubs() {
  return useQuery({
    queryKey: ['clubs', 'mine'],
    queryFn: () => clubsApi.getMyClubs(),
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
  return useQuery({
    queryKey: ['clubs', clubId, 'elections'],
    queryFn: () => clubsApi.getElections(clubId),
    enabled: !!clubId,
    staleTime: 2 * 60_000,
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
