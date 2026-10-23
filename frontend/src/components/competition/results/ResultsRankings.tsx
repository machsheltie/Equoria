/**
 * The rankings area of CompetitionResultsModal (Equoria-a1thh): the loading
 * skeleton, error, empty and sortable results-table states. Presentational only;
 * the view model (useCompetitionResultsModal) owns the data and sort state.
 */

import { memo } from 'react';
import {
  Trophy,
  Medal,
  AlertCircle,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import type { ParticipantResult } from '@/lib/api/competitionResults';
import type { SortDirection, SortField } from './useCompetitionResultsModal';

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

interface ResultsRankingsProps {
  isLoading: boolean;
  error: string | null;
  /** Callback for retrying data fetch on error */
  onRetry?: () => void;
  rows: ParticipantResult[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

/**
 * Render the rankings area based on state
 */
const ResultsRankings = memo(function ResultsRankings({
  isLoading,
  error,
  onRetry,
  rows,
  sortField,
  sortDirection,
  onSort,
}: ResultsRankingsProps) {
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

  // No competition, no results, or empty results
  if (rows.length === 0) {
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
                onSort={onSort}
              />
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wider">
              <SortHeader
                label="Horse"
                field="horse"
                currentField={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wider">
              <SortHeader
                label="Owner"
                field="owner"
                currentField={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wider">
              <SortHeader
                label="Score"
                field="score"
                currentField={sortField}
                direction={sortDirection}
                onSort={onSort}
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
          {rows.map((result, index) => {
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
                    <span data-testid="rank-value" className="font-medium text-[rgb(220,235,255)]">
                      {result.rank ?? '—'}
                    </span>
                    {result.rank !== null && <PlacementBadge rank={result.rank} />}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span data-testid="horse-name" className="font-medium text-[rgb(220,235,255)]">
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
});

export default ResultsRankings;
