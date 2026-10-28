/**
 * Stud breeding hooks (Equoria-q4uem.9): the visitor view of a horse, the
 * stallion's standing at stud, breeding to a stallion, and breeding requests.
 *
 * Every breeding or money move invalidates the horses (a mare goes in foal),
 * the requests and ['profile'] (the coin balance), so no consumer shows a stale
 * mare state or balance. A stud standing change also refreshes the Marketplace
 * search, and a 409 (the stud fee or the mare changed) refreshes the stallion
 * and the search so the button shows the current terms (Equoria-e7tgc.9). There is no toast: each control reports its own
 * failure in place (FRONTEND_ASYNC_STATE_DOCTRINE §3).
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/lib/api-client';
import {
  studsApi,
  type HorseVisit,
  type StudMode,
  type StudRequestList,
  type StudRequestQuery,
} from '@/lib/api/studs';
import { refreshOnConflict } from '@/lib/http/conflict';

export const studKeys = {
  visit: (horseId: number) => ['horses', horseId, 'visit'] as const,
  requests: (query: StudRequestQuery) => ['stud-requests', query] as const,
  allRequests: ['stud-requests'] as const,
};

function refreshAfterBreeding(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['horses'] });
  qc.invalidateQueries({ queryKey: studKeys.allRequests });
  qc.invalidateQueries({ queryKey: ['profile'] });
}

/** Another player's horse (or any horse) as a visitor sees it. */
export const useHorseVisit = (horseId: number, enabled = true) =>
  useQuery<HorseVisit, ApiError>({
    queryKey: studKeys.visit(horseId),
    queryFn: () => studsApi.visit(horseId),
    enabled: enabled && Boolean(horseId),
    staleTime: 60 * 1000,
    retry: false,
  });

/** One stallion's (incoming) or one mare's (outgoing) breeding requests. */
export const useStudRequests = (query: StudRequestQuery, enabled = true) =>
  useQuery<StudRequestList, ApiError>({
    queryKey: studKeys.requests(query),
    queryFn: () => studsApi.listRequests(query),
    enabled,
    staleTime: 30 * 1000,
  });

export type StudStanding = 'none' | StudMode;

/** Not at stud / Public Stud / Private Stud, with the fee beside the mode. */
export function useSetStudStanding(horseId: number) {
  const qc = useQueryClient();
  return useMutation<unknown, ApiError, { standing: StudStanding; fee: number }>({
    mutationFn: ({ standing, fee }) =>
      standing === 'none'
        ? studsApi.takeOffStud(horseId)
        : studsApi.standAtStud(horseId, fee, standing),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['horses'] });
      qc.invalidateQueries({ queryKey: studKeys.allRequests });
      // The Marketplace search lists stallions at stud with their terms.
      qc.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

/** How the stallion takes mares: her own, a Public Stud or a Private Stud. */
export type BreedingKind = 'own' | StudMode;

export interface BreedToStallionVars {
  kind: BreedingKind;
  sireId: number;
  damId: number;
  fee: number;
}

/** The one click: her own pair, a Public Stud booking, or a Private Stud request. */
export function useBreedToStallion() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiError, BreedToStallionVars>({
    mutationFn: ({ kind, sireId, damId, fee }) => {
      if (kind === 'own') return studsApi.breedOwnPair(sireId, damId);
      if (kind === 'public') return studsApi.bookPublicStud(sireId, damId, fee);
      return studsApi.requestPrivateStud(sireId, damId, fee);
    },
    onSuccess: () => refreshAfterBreeding(qc),
    onError: (error) => refreshOnConflict(qc, error, [['horses'], ['marketplace']]),
  });
}

/** Accept or reject a request (stallion owner), or withdraw one (mare owner). */
export function useAnswerStudRequest() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    ApiError,
    { requestId: number; answer: 'approve' | 'reject' | 'cancel' }
  >({
    mutationFn: ({ requestId, answer }) => studsApi.answerRequest(requestId, answer),
    onSuccess: () => refreshAfterBreeding(qc),
    // A 409 means the request already ended (answered, withdrawn, or declined
    // because it could not go ahead): fetch its true state (Equoria-e7tgc.10).
    onError: (error) =>
      refreshOnConflict(qc, error, [studKeys.allRequests, ['horses'], ['profile']]),
  });
}
