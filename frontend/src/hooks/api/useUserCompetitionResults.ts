/**
 * useUserCompetitionResults Hook (Equoria-oey96.5)
 *
 * Fetches the authenticated users competition results across all of
 * their horses, pre-grouped by show and ordered newest-first, ready to
 * drop into CompetitionResultsList as its `results` prop.
 *
 * Ownership scoping is enforced server-side (req.user.id) - callers do
 * NOT pass a userId. Passing one to the endpoint would be an IDOR bug;
 * this hook does not expose that surface.
 *
 * Cache strategy (mirrors useUserCompetitionStats):
 *   - staleTime 2 min: results change whenever a horse finishes a show.
 *   - gcTime    5 min: keep briefly after unmount for tab switches.
 *   - enabled gated on the user being logged in (userId truthy);
 *     otherwise the query stays idle instead of hammering with 401s.
 *
 * @example
 *   const { user } = useAuth();
 *   const { data: results = [], isLoading, error }
 *     = useUserCompetitionResults(user?.id ?? null);
 *   return <CompetitionResultsList results={results} ... />;
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchUserCompetitionResults,
  UserCompetitionResultSummary,
  CompetitionResultsApiError,
} from '@/lib/api/competitionResults';

/**
 * Query key factory for user competition results queries.
 *
 * Structure:
 *   all:     ["user-competition-results"]
 *   results: ["user-competition-results", userId]
 *
 * The userId is included so that switching accounts (or logging out
 * and back in as a different user) does not surface stale results from
 * the previous session.
 */
export const userCompetitionResultsQueryKeys = {
  all: ['user-competition-results'] as const,
  results: (userId: string) => [...userCompetitionResultsQueryKeys.all, userId] as const,
};

/**
 * Fetch the current users competition results.
 *
 * @param userId - Authenticated user id. Passed as the query key namespace
 *   only (the endpoint derives owner from req.user.id). Pass null when the
 *   user is not logged in yet; the query stays disabled.
 * @returns React Query result: { data, isLoading, isError, error, refetch }.
 */
export function useUserCompetitionResults(userId: string | null) {
  return useQuery<UserCompetitionResultSummary[], CompetitionResultsApiError>({
    queryKey: userCompetitionResultsQueryKeys.results(userId ?? 'anonymous'),
    queryFn: fetchUserCompetitionResults,
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export type { UserCompetitionResultSummary };
