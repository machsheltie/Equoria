/**
 * React Query Hooks — Conformation Show Entry & Eligibility (Equoria-1vkm)
 *
 * Wraps `conformationShowsApi` from api-client.ts with typed React Query
 * primitives. Mutation invalidates competition + balance caches so the UI
 * updates after a successful entry; eligibility query is cached briefly
 * (1 minute) because the underlying signals — groom assignment, displayed
 * health, age class — can shift between sessions and we want a fresh read
 * when the user opens the entry surface.
 *
 * Mirrors the cache-invalidation contract documented in
 * `.claude/rules/PATTERN_LIBRARY.md` § React Query Mutation Pattern.
 *
 * Sibling file: useConformationShowExecution.ts (Equoria-349l) covers the
 * host-only /execute + /titles endpoints.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  conformationShowsApi,
  type ConformationShowEntryPayload,
  type ConformationShowEntryResult,
  type ConformationShowEligibilityResult,
  type ConformationShowExecuteResult,
  type ConformationShowTitlesResult,
} from '@/lib/api-client';

/**
 * GET /api/v1/competition/conformation/eligibility/:horseId
 *
 * Returns the eligibility envelope (eligible flag, errors, warnings, ageClass,
 * groomAssigned). Disabled when horseId is missing.
 */
export function useConformationEligibility(
  horseId: number | null | undefined
): UseQueryResult<ConformationShowEligibilityResult, Error> {
  return useQuery({
    queryKey: ['competitions', 'conformation', 'eligibility', horseId],
    queryFn: () => conformationShowsApi.getEligibility(horseId as number),
    enabled: typeof horseId === 'number' && horseId > 0,
    staleTime: 60 * 1000, // 1 minute — eligibility shifts with grooming + health
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * POST /api/v1/competition/conformation/enter
 *
 * Invalidates: competitions cache (entry list / participant counts), user
 * balance (no entry fee today, but kept symmetric with `useEnterCompetition`
 * for forward compatibility), and the eligibility cache for the entered horse.
 */
export function useEnterConformationShow() {
  const queryClient = useQueryClient();

  return useMutation<ConformationShowEntryResult, Error, ConformationShowEntryPayload>({
    mutationFn: (payload) => conformationShowsApi.enter(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'balance'] });
      queryClient.invalidateQueries({
        queryKey: ['competitions', 'conformation', 'eligibility', variables.horseId],
      });
    },
  });
}

/**
 * POST /api/v1/competition/conformation/execute (Equoria-349l)
 *
 * Host-only: backend gates by hostUserId and returns 404 to non-host callers
 * (Equoria-dmec / CWE-639 doctrine). On success the show's entries are scored
 * and titlePoints / breedingValueBoost are written to each entered horse —
 * we invalidate competitions and the broad horses cache so callers see the
 * fresh titles immediately.
 */
export function useExecuteConformationShow() {
  const queryClient = useQueryClient();

  return useMutation<ConformationShowExecuteResult, Error, { showId: number }>({
    mutationFn: ({ showId }) => conformationShowsApi.execute(showId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      queryClient.invalidateQueries({ queryKey: ['horse'] });
    },
  });
}

/**
 * GET /api/v1/competition/conformation/titles/:horseId (Equoria-349l)
 *
 * Reads titlePoints / currentTitle / breedingValueBoost. Cached for 2 minutes
 * (titles only change after /execute runs, so we don't need real-time freshness
 * on the read side).
 */
export function useConformationTitles(
  horseId: number | null | undefined
): UseQueryResult<ConformationShowTitlesResult, Error> {
  return useQuery({
    queryKey: ['horse', horseId, 'conformation', 'titles'],
    queryFn: () => conformationShowsApi.getTitles(horseId as number),
    enabled: typeof horseId === 'number' && horseId > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
