/**
 * TrainingHistoryTable Component
 *
 * Displays training history in a sortable, paginated table.
 * Features:
 * - Semantic HTML table structure
 * - Sortable columns (Date, Discipline, Gain)
 * - Pagination with configurable page size
 * - Color-coded score gains (green/red)
 * - Loading state with skeleton rows
 * - Empty state message
 * - Responsive design with mobile stacking
 * - Full accessibility support
 *
 * Story 4-2: Training History Display - Task 2
 */

import React, { useState, useMemo } from 'react';
import { formatDisciplineName } from '@/lib/utils/training-utils';
import { formatDate } from '@/lib/formatDate';

/**
 * Training history entry interface
 */
export interface TrainingHistoryEntry {
  id: number;
  date: string; // ISO 8601 format
  discipline: string; // discipline ID
  previousScore: number;
  newScore: number;
  scoreGain: number;
  traits?: string[];
}

/**
 * TrainingHistoryTable component props
 */
export interface TrainingHistoryTableProps {
  history: TrainingHistoryEntry[];
  loading?: boolean;
  onSort?: (_column: string, _direction: 'asc' | 'desc') => void;
  pageSize?: number; // default: 10
  className?: string;
}

// Equoria-2dnd2: date formatting consolidated into the shared util. The local
// helper was UNGUARDED (Intl.DateTimeFormat of an unparseable date renders
// "Invalid Date"); routing through formatDate adds the honest fallback. The
// "MMM DD" format (e.g. "Jan 30") is reproduced via the { month:'short',
// day:'2-digit' } options at the call site.

/**
 * Format score gain with appropriate prefix and styling
 */
function formatGain(gain: number): { text: string; className: string } {
  if (gain > 0) {
    return { text: `+${gain}`, className: 'text-[var(--role-success-text)]' };
  }
  if (gain < 0) {
    return { text: `${gain}`, className: 'text-[var(--role-danger-text)]' };
  }
  return { text: '0', className: 'text-role-secondary' };
}

/**
 * Skeleton row component for loading state
 */
function SkeletonRow({ index }: { index: number }) {
  return (
    <tr data-testid={`skeleton-row-${index}`} className="animate-pulse">
      <td className="px-4 py-3">
        <div className="h-4 w-16 rounded bg-[var(--role-neutral-bg)]" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-24 rounded bg-[var(--role-neutral-bg)]" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-12 rounded bg-[var(--role-neutral-bg)]" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-12 rounded bg-[var(--role-neutral-bg)]" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-10 rounded bg-[var(--role-neutral-bg)]" />
      </td>
    </tr>
  );
}

/**
 * Sortable column header component
 */
function SortableHeader({
  column,
  sortKey,
  label,
  currentSort,
  currentDirection,
  onSort,
}: {
  column: string;
  sortKey: string;
  label: string;
  currentSort: string | null;
  currentDirection: 'asc' | 'desc';
  onSort?: (_column: string, _direction: 'asc' | 'desc') => void;
}) {
  const isActive = currentSort === sortKey;

  const handleClick = () => {
    if (!onSort) return;

    const newDirection = isActive && currentDirection === 'asc' ? 'desc' : 'asc';
    onSort(sortKey, newDirection);
  };

  return (
    <th
      scope="col"
      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-role-secondary"
    >
      {onSort ? (
        <button
          type="button"
          data-testid={`sort-${column}`}
          aria-label={`Sort by ${label.toLowerCase()}`}
          onClick={handleClick}
          className="flex items-center gap-1 hover:text-[var(--text-primary)]"
        >
          {label}
          {isActive && (
            <span data-testid={`sort-indicator-${column}`} className="text-sm">
              {currentDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

/**
 * TrainingHistoryTable Component
 *
 * Renders a table of training history with sorting and pagination
 */
const TrainingHistoryTable: React.FC<TrainingHistoryTableProps> = ({
  history,
  loading = false,
  onSort,
  pageSize = 10,
  className = '',
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Calculate total pages
  const totalPages = Math.ceil(history.length / pageSize);
  const showPagination = history.length > pageSize;

  // Get current page data
  const paginatedHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return history.slice(startIndex, endIndex);
  }, [history, currentPage, pageSize]);

  // Handle sort
  const handleSort = (column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
    onSort?.(column, direction);
  };

  // Handle pagination
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Shared table header cells (non-sortable)
  const staticHeaderCellClass =
    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-role-secondary';

  // Loading state
  if (loading) {
    return (
      <div data-testid="training-history-table" className={className}>
        <div data-testid="table-container" className="overflow-x-auto">
          <table className="min-w-full table-auto divide-y divide-[var(--glass-border)]">
            <caption className="sr-only">
              Training history showing date, discipline, and score changes
            </caption>
            <thead data-testid="history-thead" className="bg-[var(--role-neutral-bg)]">
              <tr>
                <th scope="col" className={staticHeaderCellClass}>
                  Date
                </th>
                <th scope="col" className={staticHeaderCellClass}>
                  Discipline
                </th>
                <th scope="col" className={staticHeaderCellClass}>
                  Before
                </th>
                <th scope="col" className={staticHeaderCellClass}>
                  After
                </th>
                <th scope="col" className={staticHeaderCellClass}>
                  Gain
                </th>
              </tr>
            </thead>
            <tbody
              data-testid="history-tbody"
              className="divide-y divide-[var(--glass-border)] bg-[var(--role-neutral-bg)]"
            >
              {[0, 1, 2, 3, 4].map((index) => (
                <SkeletonRow key={index} index={index} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Empty state
  if (history.length === 0) {
    return (
      <div data-testid="training-history-table" className={className}>
        <div data-testid="table-container" className="overflow-x-auto">
          <table className="min-w-full table-auto divide-y divide-[var(--glass-border)]">
            <caption className="sr-only">
              Training history showing date, discipline, and score changes
            </caption>
            <thead data-testid="history-thead" className="bg-[var(--role-neutral-bg)]">
              <tr>
                <th scope="col" className={staticHeaderCellClass}>
                  Date
                </th>
                <th scope="col" className={staticHeaderCellClass}>
                  Discipline
                </th>
                <th scope="col" className={staticHeaderCellClass}>
                  Before
                </th>
                <th scope="col" className={staticHeaderCellClass}>
                  After
                </th>
                <th scope="col" className={staticHeaderCellClass}>
                  Gain
                </th>
              </tr>
            </thead>
            <tbody
              data-testid="history-tbody"
              className="divide-y divide-[var(--glass-border)] bg-[var(--role-neutral-bg)]"
            >
              <tr>
                <td colSpan={5}>
                  <div data-testid="empty-state" className="py-8 text-center text-role-secondary">
                    No training history found
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="training-history-table" className={className}>
      <div data-testid="table-container" className="overflow-x-auto">
        <table className="min-w-full table-auto divide-y divide-[var(--glass-border)]">
          <caption className="sr-only">
            Training history showing date, discipline, and score changes
          </caption>
          <thead data-testid="history-thead" className="bg-[var(--role-neutral-bg)]">
            <tr>
              <SortableHeader
                column="date"
                sortKey="date"
                label="Date"
                currentSort={sortColumn}
                currentDirection={sortDirection}
                onSort={onSort ? handleSort : undefined}
              />
              <SortableHeader
                column="discipline"
                sortKey="discipline"
                label="Discipline"
                currentSort={sortColumn}
                currentDirection={sortDirection}
                onSort={onSort ? handleSort : undefined}
              />
              <th scope="col" className={staticHeaderCellClass}>
                Before
              </th>
              <th scope="col" className={staticHeaderCellClass}>
                After
              </th>
              <SortableHeader
                column="gain"
                sortKey="scoreGain"
                label="Gain"
                currentSort={sortColumn}
                currentDirection={sortDirection}
                onSort={onSort ? handleSort : undefined}
              />
            </tr>
          </thead>
          <tbody
            data-testid="history-tbody"
            className="divide-y divide-[var(--glass-border)] bg-[var(--role-neutral-bg)]"
          >
            {paginatedHistory.map((entry) => {
              const gainFormatted = formatGain(entry.scoreGain);
              return (
                <tr key={entry.id} className="even:bg-[var(--role-neutral-bg)]">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-primary)]">
                    {formatDate(entry.date, { month: 'short', day: '2-digit' })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-primary)]">
                    {formatDisciplineName(entry.discipline)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-primary)]">
                    {entry.previousScore}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-primary)]">
                    {entry.newScore}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-sm font-medium ${gainFormatted.className}`}
                  >
                    {gainFormatted.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="mt-4 flex items-center justify-between px-4">
          <button
            type="button"
            data-testid="pagination-previous"
            aria-label="Go to previous page"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className="rounded bg-[var(--role-neutral-bg)] px-3 py-1.5 text-sm text-role-secondary hover:bg-[var(--glass-bg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span data-testid="pagination-info" className="text-sm text-role-secondary">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            data-testid="pagination-next"
            aria-label="Go to next page"
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            className="rounded bg-[var(--role-neutral-bg)] px-3 py-1.5 text-sm text-role-secondary hover:bg-[var(--glass-bg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default TrainingHistoryTable;
