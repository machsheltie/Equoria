/**
 * View model for CompetitionResultsModal (Equoria-a1thh).
 *
 * Owns everything the results dialog knows that is not markup: the production
 * fetch (useCompetitionResults), the sort state and sorted rows, the player's
 * own podium prizes, the best prize for the notification, and the first-view
 * callback. The container wires it to the presentational parts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCompetitionResults } from '@/hooks/api/useCompetitionResults';
import type { CompetitionResults, ParticipantResult } from '@/lib/api/competitionResults';
import type { HorsePrize } from '../PrizeSummaryCard';
import type { PrizeData } from '../PrizeNotificationModal';

/** Sort field options */
export type SortField = 'rank' | 'score' | 'horse' | 'owner';

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

interface UseCompetitionResultsModalArgs {
  isOpen: boolean;
  competitionId: number | null;
  /** Called when the dialog is open and the player has podium prizes (Story 5-3). */
  onFirstView?: () => void;
}

/** Order the rows by the active sort; unplaced horses sort last by rank. */
function sortRows(
  rows: ParticipantResult[],
  field: SortField,
  direction: SortDirection
): ParticipantResult[] {
  const sorted = [...rows];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'rank':
        // Ascending: 1, 2, 3... (lower rank is better; unplaced last)
        comparison = (a.rank ?? Infinity) - (b.rank ?? Infinity);
        break;
      case 'score':
        // Ascending: low to high; Descending (default): high to low
        comparison = a.finalScore - b.finalScore;
        break;
      case 'horse':
        comparison = (a.horseName ?? '').localeCompare(b.horseName ?? '');
        break;
      case 'owner':
        comparison = (a.ownerName ?? '').localeCompare(b.ownerName ?? '');
        break;
    }

    // For ascending, keep comparison as-is; for descending, flip it
    return direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

export function useCompetitionResultsModal({
  isOpen,
  competitionId,
  onFirstView,
}: UseCompetitionResultsModalArgs) {
  // Sort state
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Prize summary expansion state
  const [isPrizeExpanded, setIsPrizeExpanded] = useState(false);

  // Equoria-55bo.3 — the real production data fetch. The hook and the modal
  // share the one canonical CompetitionResults DTO (lib/api/competitionResults).
  const {
    data: fetchedResults,
    isLoading,
    isError,
    error: fetchError,
  } = useCompetitionResults(competitionId);

  const results: CompetitionResults | null = fetchedResults ?? null;
  const error = isError ? (fetchError?.message ?? 'Failed to load competition results') : null;

  // Calculate user prizes for PrizeSummaryCard (Story 5-3)
  const userPrizes: HorsePrize[] = useMemo(() => {
    if (!results?.results) return [];

    // Only placings that were actually paid prize money (conformation pays none).
    return results.results.flatMap((r) =>
      r.isCurrentUser && r.rank !== null && r.rank <= 3 && r.prizeWon !== null
        ? [
            {
              horseId: r.horseId,
              horseName: r.horseName ?? '—',
              placement: r.rank,
              prizeMoney: r.prizeWon,
              horsePointsAwarded: r.horsePointsAwarded,
            },
          ]
        : []
    );
  }, [results]);

  const hasUserPrizes = userPrizes.length > 0;

  // Get the best prize for notification modal (highest placement)
  const bestPrize = useMemo(() => {
    if (!hasUserPrizes || !results) return null;
    const { competitionName, discipline, date } = results;
    if (competitionName === null || discipline === null || date === null) return null;

    const sortedByPlacement = [...userPrizes].sort((a, b) => a.placement - b.placement);
    const best = sortedByPlacement[0];

    const prize: PrizeData = {
      horseName: best.horseName,
      competitionName,
      discipline,
      date,
      placement: best.placement as 1 | 2 | 3,
      prizeMoney: best.prizeMoney,
    };
    return prize;
  }, [hasUserPrizes, userPrizes, results]);

  // Call onFirstView when modal opens with prizes (Story 5-3)
  useEffect(() => {
    if (isOpen && hasUserPrizes && onFirstView) {
      onFirstView();
    }
  }, [isOpen, hasUserPrizes, onFirstView]);

  // Handle prize summary toggle
  const togglePrizeSummary = useCallback(() => {
    setIsPrizeExpanded((prev) => !prev);
  }, []);

  // Handle sort toggle
  const handleSort = useCallback((field: SortField) => {
    setSortField((prevField) => {
      if (prevField === field) {
        // Toggle direction if same field
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      // Default directions for different fields
      setSortDirection(field === 'score' ? 'desc' : 'asc');
      return field;
    });
  }, []);

  // Sort results based on current sort state
  const sortedResults = useMemo(
    () => (results?.results ? sortRows(results.results, sortField, sortDirection) : []),
    [results?.results, sortField, sortDirection]
  );

  // Without a competition there is nothing to list, whatever the cache holds.
  const rows = competitionId && results ? sortedResults : [];

  return {
    results,
    isLoading,
    error,
    rows,
    sortField,
    sortDirection,
    handleSort,
    userPrizes,
    hasUserPrizes,
    bestPrize,
    isPrizeExpanded,
    togglePrizeSummary,
  };
}
