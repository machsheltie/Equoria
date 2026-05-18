/**
 * useShowField (Equoria-lfkw1)
 *
 * Fetches the REAL entered field for an open show (scouting, UX-spec
 * 11.3.5 / Journey 4) from GET /api/v1/competition/show/:showId/entries.
 * Powers CompetitionFieldPreview's "Scout the Field" — no fabricated data.
 *
 * Disabled when showId is null so it doesn't fire until a show is selected.
 */

import { useQuery } from '@tanstack/react-query';
import { ApiError, competitionsApi, type ShowFieldResponse } from '@/lib/api-client';

export const showFieldQueryKeys = {
  all: ['show-field'] as const,
  byShow: (showId: number) => ['show-field', showId] as const,
};

export const useShowField = (showId: number | null) =>
  useQuery<ShowFieldResponse, ApiError>({
    queryKey: showFieldQueryKeys.byShow(showId ?? 0),
    queryFn: () => competitionsApi.getShowField(showId as number),
    enabled: showId !== null && showId > 0,
    // Entries change during the 7-day window but not second-to-second.
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
  });
