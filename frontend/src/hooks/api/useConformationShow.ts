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
 * There is no hook to settle a show (Equoria-mwjst): the nightly show job
 * settles a conformation show once its closing date has passed.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  conformationShowsApi,
  type ConformationShowEntryPayload,
  type ConformationShowEntryResult,
  type ConformationShowEligibilityResult,
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
 * balance (the show's entry fee is debited on entry — Equoria-mwjst), and the
 * eligibility cache for the entered horse.
 */
export function useEnterConformationShow() {
  const queryClient = useQueryClient();

  return useMutation<ConformationShowEntryResult, Error, ConformationShowEntryPayload>({
    mutationFn: (payload) => conformationShowsApi.enter(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      // Equoria-bvddn.33: the balance lives under ['profile'] (useAuth.ts) —
      // ['user', 'balance'] only matched the dead useUserBalance hook, which
      // no component reads (see Equoria-bvddn.41). Kept symmetric with
      // useEnterCompetition's real ['profile'] invalidation.
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({
        queryKey: ['competitions', 'conformation', 'eligibility', variables.horseId],
      });
    },
  });
}

/**
 * GET /api/v1/competition/conformation/titles/:horseId (Equoria-349l)
 *
 * Reads titlePoints / currentTitle / breedingValueBoost. Cached for 2 minutes
 * (titles only change when the nightly job settles a show, so we don't need real-time freshness
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
