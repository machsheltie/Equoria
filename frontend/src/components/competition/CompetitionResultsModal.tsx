/**
 * CompetitionResultsModal Component
 *
 * A modal dialog for displaying full competition results with rankings table:
 * - Competition name, discipline, date, and participant count
 * - Prize pool and distribution breakdown (50%/30%/20%)
 * - Full rankings table with all participants
 * - User's horse(s) highlighted with different background
 * - Top 3 rows with gold/silver/bronze placement badges
 * - Sortable columns (rank, score, horse name, owner name)
 * - Your own horses' rows highlighted (no score breakdown: owner ruling R5, Equoria-q4uem.10)
 * - PrizeSummaryCard showing user's prizes when applicable (Story 5-3)
 * - PrizeNotificationModal for first-time prize notifications (Story 5-3)
 * - Link to prize history page in footer (Story 5-3)
 *
 * Owner ruling R7 (2026-10-15, Equoria-q4uem.10) removed the invented Story 5-4
 * parts: the XP Progress column, horse level badges, the prize-derived "XP",
 * the XP gain notification and the level-up celebration.
 *
 * Features:
 * - Migrated from BaseModal → GameDialog (Equoria-o5hub.13, DECISIONS.md §8)
 * - Focus trap, scroll lock, Escape close, and focus restoration from Radix Dialog
 * - Responsive design (table collapses to cards on mobile)
 * - WCAG 2.1 AA compliance
 * - Virtual scrolling ready for large datasets
 *
 * Story 5-2: Competition Results Display
 * Story 5-3: Competition History - Task 7 (Integration with Results Display)
 */

import React, { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router';
import {
  Trophy,
  Medal,
  Calendar,
  Users,
  AlertCircle,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  History,
} from 'lucide-react';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import PrizeSummaryCard, { type HorsePrize } from './PrizeSummaryCard';
import PrizeNotificationModal, { type PrizeData } from './PrizeNotificationModal';
import { useCompetitionResults } from '@/hooks/api/useCompetitionResults';
import type { CompetitionResults } from '@/lib/api/competitionResults';

/**
 * CompetitionResultsModal component props
 */
export interface CompetitionResultsModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Competition ID to fetch results for */
  competitionId: number | null;
  /** Callback for retrying data fetch on error */
  onRetry?: () => void;
  /** Callback when modal first opened with prizes (Story 5-3) */
  onFirstView?: () => void;
  /** Control prize notification display (Story 5-3) */
  showPrizeNotification?: boolean;
  /** Callback when prize notification is closed (Story 5-3) */
  onPrizeNotificationClose?: () => void;
  /** Test prop for injecting results data */
  _testResults?: CompetitionResults | null;
  /** Test prop for loading state */
  _testLoading?: boolean;
  /** Test prop for error state */
  _testError?: string | null;
}

/** Sort field options */
type SortField = 'rank' | 'score' | 'horse' | 'owner';

/** Sort direction */
type SortDirection = 'asc' | 'desc';

// Equoria-2dnd2: date formatting + honest invalid-date fallback now live in the
// shared util (was a duplicated, unguarded component-local formatDate).
import { formatDate } from '@/lib/formatDate';

/**
 * Get placement badge styling based on rank
 */
const getPlacementBadgeClasses = (rank: number): string => {
  switch (rank) {
    case 1:
      return 'bg-yellow-400 text-yellow-900'; // Gold
    case 2:
      return 'bg-slate-400/30 text-[rgb(220,235,255)]'; // Silver
    case 3:
      return 'bg-orange-400 text-orange-900'; // Bronze
    default:
      return 'bg-[rgba(15,35,70,0.5)] text-slate-400'; // Other
  }
};

/**
 * Placement badge component for top 3 finishers
 */
const PlacementBadge = memo(({ rank }: { rank: number }) => {
  if (rank > 3) return null;

  const badgeClasses = getPlacementBadgeClasses(rank);
  const Icon = rank === 1 ? Trophy : Medal;
  const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : 'rd';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClasses}`}
      data-testid={`placement-badge-${rank}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {rank}
      {suffix}
    </span>
  );
});

PlacementBadge.displayName = 'PlacementBadge';

/**
 * Loading skeleton component for table rows
 */
const LoadingSkeletons = memo(() => (
  <>
    {Array.from({ length: 8 }).map((_, index) => (
      <tr key={`skeleton-${index}`} data-testid="skeleton-row" className="animate-pulse">
        <td className="px-4 py-3">
          <div className="h-4 bg-[rgba(37,99,235,0.2)] rounded w-8" />
        </td>
        <td className="px-4 py-3">
          <div className="h-4 bg-[rgba(37,99,235,0.2)] rounded w-32" />
        </td>
        <td className="px-4 py-3">
          <div className="h-4 bg-[rgba(37,99,235,0.2)] rounded w-24" />
        </td>
        <td className="px-4 py-3">
          <div className="h-4 bg-[rgba(37,99,235,0.2)] rounded w-16" />
        </td>
        <td className="px-4 py-3">
          <div className="h-4 bg-[rgba(37,99,235,0.2)] rounded w-20" />
        </td>
      </tr>
    ))}
  </>
));

LoadingSkeletons.displayName = 'LoadingSkeletons';

/**
 * Empty state component
 */
const EmptyState = memo(() => (
  <div className="py-12 text-center" data-testid="empty-state">
    <Trophy className="mx-auto h-12 w-12 text-slate-400 mb-4" aria-hidden="true" />
    <h3 className="text-lg font-medium text-[rgb(220,235,255)] mb-2">No results available</h3>
    <p className="text-sm text-slate-400">Results for this competition are not yet available.</p>
  </div>
));

EmptyState.displayName = 'EmptyState';

/**
 * Error state component
 */
const ErrorState = memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="py-12 text-center" data-testid="error-state">
    <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" aria-hidden="true" />
    <h3 className="text-lg font-medium text-[rgb(220,235,255)] mb-2">Unable to load results</h3>
    <p className="text-sm text-slate-400 mb-4">{message}</p>
    {onRetry && (
      <Button type="button" variant="secondary" onClick={onRetry} data-testid="retry-button">
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Retry
      </Button>
    )}
  </div>
));

ErrorState.displayName = 'ErrorState';

/**
 * Sort header button component
 */
const SortHeader = memo(
  ({
    label,
    field,
    currentField,
    direction,
    onSort,
  }: {
    label: string;
    field: SortField;
    currentField: SortField;
    direction: SortDirection;
    onSort: (_field: SortField) => void;
  }) => {
    const isActive = currentField === field;
    const Icon = isActive ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

    return (
      <button
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 font-semibold text-left hover:text-blue-400 transition-colors ${
          isActive ? 'text-blue-400' : 'text-[rgb(220,235,255)]'
        }`}
        data-testid={`sort-by-${field}`}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }
);

SortHeader.displayName = 'SortHeader';

/**
 * CompetitionResultsModal Component
 *
 * Displays full competition results with a sortable rankings table.
 * Portal, focus trap, scroll lock, and keyboard handling come from Radix Dialog.
 */
const CompetitionResultsModal = memo(function CompetitionResultsModal(
  props: CompetitionResultsModalProps
) {
  const {
    isOpen,
    onClose,
    competitionId,
    onRetry,
    onFirstView,
    showPrizeNotification = false,
    onPrizeNotificationClose,
    _testResults,
    _testLoading = false,
    _testError = null,
  } = props;

  // Sort state
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Prize summary expansion state
  const [isPrizeExpanded, setIsPrizeExpanded] = useState(false);

  // Equoria-55bo.3 — REAL production data fetch.
  // Previously this modal rendered ONLY from `_testResults`, so a beta tester
  // clicking a result row got an empty/broken modal (no fetch in production).
  // Now the production default fetches real results via useCompetitionResults.
  // `_testResults`/`_testLoading`/`_testError` remain ONLY as an explicit
  // test-injection seam: they take precedence ONLY when the prop is actually
  // passed (so a test injecting `null` still works), never as the prod default.
  const usingTestSeam = '_testResults' in props;

  const {
    data: fetchedResults,
    isLoading: fetchLoading,
    isError: fetchIsError,
    error: fetchError,
  } = useCompetitionResults(usingTestSeam ? null : competitionId);

  // Equoria-q4uem.6: the hook and this modal share the one canonical
  // CompetitionResults DTO (lib/api/competitionResults), so no cast.
  const results: CompetitionResults | null = usingTestSeam
    ? (_testResults ?? null)
    : (fetchedResults ?? null);
  const isLoading = usingTestSeam ? _testLoading : fetchLoading;
  const error = usingTestSeam
    ? _testError
    : fetchIsError
      ? (fetchError?.message ?? 'Failed to load competition results')
      : null;

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

  // Check if user has any prizes
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

  // Handle prize notification close
  const handlePrizeNotificationClose = useCallback(() => {
    onPrizeNotificationClose?.();
  }, [onPrizeNotificationClose]);

  // Handle prize summary toggle
  const handlePrizeSummaryToggle = useCallback(() => {
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
  const sortedResults = useMemo(() => {
    if (!results?.results) return [];

    const sorted = [...results.results];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
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
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [results?.results, sortField, sortDirection]);

  // Render content based on state
  const renderContent = () => {
    // Loading state
    if (isLoading) {
      return (
        <div className="overflow-x-auto" role="status" aria-label="Loading results">
          <table className="min-w-full" role="table" aria-busy="true">
            <thead className="sticky top-0 bg-[rgba(15,35,70,0.5)] z-[var(--z-raised)]">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-[rgb(220,235,255)] uppercase tracking-wider"
                >
                  Rank
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-[rgb(220,235,255)] uppercase tracking-wider"
                >
                  Horse
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-[rgb(220,235,255)] uppercase tracking-wider"
                >
                  Owner
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-[rgb(220,235,255)] uppercase tracking-wider"
                >
                  Score
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-[rgb(220,235,255)] uppercase tracking-wider"
                >
                  Prize
                </th>
              </tr>
            </thead>
            <tbody>
              <LoadingSkeletons />
            </tbody>
          </table>
        </div>
      );
    }

    // Error state
    if (error) {
      return <ErrorState message={error} onRetry={onRetry} />;
    }

    // No competition ID
    if (!competitionId || !results) {
      return <EmptyState />;
    }

    // Empty results
    if (sortedResults.length === 0) {
      return <EmptyState />;
    }

    // Results table
    return (
      <div className="overflow-x-auto" data-testid="results-table">
        <table className="min-w-full divide-y divide-[rgba(37,99,235,0.2)]" role="table">
          <thead className="sticky top-0 bg-[rgba(15,35,70,0.5)] z-[var(--z-raised)] shadow-sm">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wider">
                <SortHeader
                  label="Rank"
                  field="rank"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wider">
                <SortHeader
                  label="Horse"
                  field="horse"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wider">
                <SortHeader
                  label="Owner"
                  field="owner"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wider">
                <SortHeader
                  label="Score"
                  field="score"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold text-[rgb(220,235,255)] uppercase tracking-wider"
              >
                Prize
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(37,99,235,0.2)]">
            {sortedResults.map((result, index) => {
              const isUserHorse = result.isCurrentUser;
              const rowClasses = `
                ${isUserHorse ? 'bg-[rgba(37,99,235,0.1)]' : index % 2 === 0 ? 'bg-[rgba(15,35,70,0.4)]' : 'bg-[rgba(15,35,70,0.5)]'}
                transition-colors
              `;

              return (
                <tr
                  key={result.horseId}
                  className={rowClasses}
                  data-testid={`result-row-${result.horseId}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        data-testid="rank-value"
                        className="font-medium text-[rgb(220,235,255)]"
                      >
                        {result.rank ?? '—'}
                      </span>
                      {result.rank !== null && <PlacementBadge rank={result.rank} />}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        data-testid="horse-name"
                        className="font-medium text-[rgb(220,235,255)]"
                      >
                        {result.horseName ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span data-testid="owner-name" className="text-slate-400">
                      {result.ownerName ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span data-testid="score-value" className="font-medium text-[rgb(220,235,255)]">
                      {result.finalScore.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      data-testid="prize-value"
                      className={
                        result.prizeWon !== null && result.prizeWon > 0
                          ? 'font-semibold text-emerald-400'
                          : 'text-slate-400'
                      }
                    >
                      {/* Unknown (null) renders as an em dash labelled "unknown amount". */}
                      <Currency amount={result.prizeWon ?? Number.NaN} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const footerContent = (
    <div className="flex justify-between items-center w-full">
      {/* Prize History Link - Story 5-3 */}
      <Link
        to="/prizes"
        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
      >
        <History className="h-4 w-4" aria-hidden="true" />
        Prize History
      </Link>
      <Button type="button" variant="secondary" onClick={onClose}>
        Close
      </Button>
    </div>
  );

  return (
    <>
      <GameDialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
      >
        <GameDialogContent
          size="xl"
          data-testid="competition-results-modal"
          aria-describedby={undefined}
        >
          <GameDialogHeader>
            <GameDialogTitle>{results?.competitionName ?? 'Competition Results'}</GameDialogTitle>
          </GameDialogHeader>

          <GameDialogBody>
            <div className="space-y-6">
              {/* Subtitle row: discipline, date, participants */}
              <div className="flex items-center gap-4 flex-wrap -mt-2">
                <span
                  className="inline-block px-3 py-1 bg-[rgba(37,99,235,0.1)] text-blue-400 text-sm font-medium rounded-full border border-blue-500/30"
                  data-testid="competition-discipline"
                >
                  {results?.discipline || '—'}
                </span>
                <div
                  className="flex items-center text-sm text-slate-400"
                  data-testid="competition-date"
                >
                  <Calendar className="h-4 w-4 mr-1" aria-hidden="true" />
                  {results?.date ? formatDate(results.date) : '—'}
                </div>
                <div className="flex items-center text-sm text-slate-400">
                  <Users className="h-4 w-4 mr-1" aria-hidden="true" />
                  <span data-testid="total-participants">{results?.totalParticipants || 0}</span>
                  <span className="ml-1">participants</span>
                </div>
              </div>

              {/* Prize Distribution */}
              {/* Shows that pay no prize money (conformation) have no pool to show. */}
              {results && results.prizePool !== null && results.prizeDistribution && (
                <div
                  className="bg-[var(--alpha-gold-primary-10)] border border-amber-500/20 rounded-lg p-4"
                  data-testid="prize-distribution"
                >
                  <div className="flex items-center mb-3">
                    <Trophy className="h-5 w-5 text-amber-500 mr-2" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-[rgb(220,235,255)]">
                      Prize Pool: <Currency amount={results.prizePool} />
                    </h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center" data-testid="prize-1st">
                      <div className="text-lg font-bold text-amber-400">1st</div>
                      <div className="text-sm text-slate-400">50%</div>
                      <div className="font-semibold text-[rgb(220,235,255)]">
                        <Currency amount={results.prizeDistribution.first ?? Number.NaN} />
                      </div>
                    </div>
                    <div className="text-center" data-testid="prize-2nd">
                      <div className="text-lg font-bold text-slate-400">2nd</div>
                      <div className="text-sm text-slate-400">30%</div>
                      <div className="font-semibold text-[rgb(220,235,255)]">
                        <Currency amount={results.prizeDistribution.second ?? Number.NaN} />
                      </div>
                    </div>
                    <div className="text-center" data-testid="prize-3rd">
                      <div className="text-lg font-bold text-orange-600">3rd</div>
                      <div className="text-sm text-slate-400">20%</div>
                      <div className="font-semibold text-orange-600">
                        <Currency amount={results.prizeDistribution.third ?? Number.NaN} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Results table / loading / error / empty */}
              {renderContent()}

              {/* Prize Summary Card - Story 5-3: Show when user has prizes */}
              {hasUserPrizes && results?.competitionName && results.date && (
                <div className="mt-2">
                  <PrizeSummaryCard
                    competitionId={results.competitionId}
                    competitionName={results.competitionName}
                    date={results.date}
                    prizes={userPrizes}
                    isExpanded={isPrizeExpanded}
                    onToggleExpand={handlePrizeSummaryToggle}
                  />
                </div>
              )}
            </div>
          </GameDialogBody>

          <GameDialogFooter>{footerContent}</GameDialogFooter>
        </GameDialogContent>
      </GameDialog>

      {/* Prize Notification Modal - Story 5-3 */}
      {showPrizeNotification && bestPrize && (
        <PrizeNotificationModal
          isOpen={showPrizeNotification}
          onClose={handlePrizeNotificationClose}
          prizeData={bestPrize}
          autoDismiss={false}
        />
      )}
    </>
  );
});

export default CompetitionResultsModal;
