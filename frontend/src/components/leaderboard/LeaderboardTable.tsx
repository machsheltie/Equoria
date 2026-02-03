/**
 * LeaderboardTable Component
 *
 * Displays a ranked list of leaderboard entries in a table layout with
 * pagination controls, loading skeletons, and empty state handling.
 *
 * Features:
 * - Column headers (Rank, Change, Name, Score, Stats)
 * - Renders LeaderboardEntry rows for each entry
 * - Pagination controls (Previous/Next, page indicator)
 * - Loading state with animated skeleton rows
 * - Empty state with descriptive message
 * - Entry click propagation to parent
 * - Full ARIA accessibility (table role, labeled buttons)
 *
 * Story 5-5: Leaderboards - Task 2
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import LeaderboardEntryComponent from './LeaderboardEntry';
import type { LeaderboardEntryData } from './LeaderboardEntry';
import type { LeaderboardCategory } from './LeaderboardCategorySelector';

/**
 * Props for the LeaderboardTable component.
 */
export interface LeaderboardTableProps {
  entries: LeaderboardEntryData[];
  category: LeaderboardCategory;
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (_page: number) => void;
  onEntryClick?: (_entry: LeaderboardEntryData) => void;
  className?: string;
}

/**
 * Number of skeleton rows displayed during loading.
 */
const SKELETON_ROW_COUNT = 10;

/**
 * Animated skeleton row placeholder shown during loading.
 */
const SkeletonRow = () => (
  <div
    className="flex items-center gap-4 px-4 py-3 animate-pulse"
    data-testid="skeleton-row"
  >
    <div className="w-10 h-10 rounded-full bg-gray-200" />
    <div className="w-12 h-4 rounded bg-gray-200" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
    <div className="w-16 h-6 bg-gray-200 rounded" />
    <div className="hidden md:block w-40 h-4 bg-gray-200 rounded" />
  </div>
);

/**
 * Empty state displayed when there are no leaderboard entries.
 */
const EmptyState = () => (
  <div
    className="flex flex-col items-center justify-center py-16 text-gray-500"
    data-testid="empty-state"
  >
    <p className="text-lg font-medium">No entries found</p>
    <p className="text-sm mt-1">There are no entries for this leaderboard yet.</p>
  </div>
);

/**
 * LeaderboardTable renders a complete leaderboard with headers, entry rows,
 * pagination, loading skeletons, and an empty state.
 */
const LeaderboardTable = ({
  entries,
  category,
  isLoading = false,
  currentPage,
  totalPages,
  onPageChange,
  onEntryClick,
  className = '',
}: LeaderboardTableProps) => {
  const isClickable = Boolean(onEntryClick);

  return (
    <div
      className={`bg-white rounded-lg shadow ${className}`}
      data-testid="leaderboard-table"
    >
      {/* Table with ARIA role */}
      <div role="table" aria-label="Leaderboard rankings">
        {/* Column Headers */}
        <div
          className="flex items-center gap-4 px-4 py-2 bg-gray-100 rounded-t-lg font-bold text-sm text-gray-700"
          data-testid="table-header"
          role="row"
        >
          <div className="flex-shrink-0 w-10" role="columnheader">
            Rank
          </div>
          <div className="flex-shrink-0 w-12" role="columnheader">
            Change
          </div>
          <div className="flex-1" role="columnheader">
            Name
          </div>
          <div className="flex-shrink-0 w-16 text-right" role="columnheader">
            Score
          </div>
          <div className="hidden md:block flex-shrink-0 w-40 text-right" role="columnheader">
            Stats
          </div>
        </div>

        {/* Loading Skeleton Rows */}
        {isLoading && (
          <div>
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
              <SkeletonRow key={`skeleton-${i}`} />
            ))}
          </div>
        )}

        {/* Entry Rows */}
        {!isLoading && entries.length > 0 && (
          <div>
            {entries.map((entry) => (
              <LeaderboardEntryComponent
                key={`${entry.rank}-${entry.ownerId}`}
                entry={entry}
                category={category}
                isClickable={isClickable}
                onClick={onEntryClick ? () => onEntryClick(entry) : undefined}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && entries.length === 0 && <EmptyState />}
      </div>

      {/* Pagination Controls */}
      <div
        className="flex items-center justify-between px-4 py-3 border-t border-gray-200"
        data-testid="pagination"
      >
        <button
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          data-testid="pagination-prev"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Previous
        </button>

        <span className="text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </span>

        <button
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          data-testid="pagination-next"
          aria-label="Next page"
        >
          Next
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default LeaderboardTable;
