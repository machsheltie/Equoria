/**
 * PrizeTransactionHistory Component
 *
 * Displays a comprehensive history of prize transactions with filtering,
 * sorting, and pagination capabilities.
 * Features:
 * - Table layout on desktop, responsive on mobile
 * - Date range, horse, and discipline filters
 * - Sort by date, prize money, XP, or placement
 * - Pagination with configurable page size
 * - Loading skeleton states
 * - Empty state handling for no transactions and filtered results
 * - WCAG 2.1 AA accessibility compliant
 *
 * Story 5-3: Competition History Display - Task 3
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Calendar,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Trophy,
  Award,
} from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/state';
import { EmptyState as EmptyStatePrimitive } from '@/components/ui/EmptyState';
import PrizeTransactionRow, { type PrizeTransaction } from './PrizeTransactionRow';

// Re-export the PrizeTransaction type for external use
export type { PrizeTransaction };

/**
 * Filter options for transactions
 */
export interface TransactionFilters {
  dateRange?: 'all' | '7days' | '30days' | '90days' | 'custom';
  customStartDate?: string;
  customEndDate?: string;
  horseId?: number | 'all';
  discipline?: string | 'all';
}

/**
 * Sort configuration
 */
export interface SortConfig {
  field: 'date' | 'prize' | 'xp' | 'placement';
  direction: 'asc' | 'desc';
}

/**
 * Horse option for filter dropdown
 */
interface HorseOption {
  id: number;
  name: string;
}

/**
 * PrizeTransactionHistory component props
 */
export interface PrizeTransactionHistoryProps {
  transactions: PrizeTransaction[];
  horses?: HorseOption[];
  disciplines?: string[];
  filters?: TransactionFilters;
  sortConfig?: SortConfig;
  currentPage?: number;
  pageSize?: number;
  onFilterChange?: (_filters: TransactionFilters) => void;
  onSortChange?: (_sort: SortConfig) => void;
  onPageChange?: (_page: number) => void;
  onViewCompetition?: (_competitionId: number) => void;
  onViewHorse?: (_horseId: number) => void;
  /**
   * Equoria-bx52 — claim handler forwarded to each PrizeTransactionRow.
   * When provided, unclaimed rows render a Claim button that invokes
   * this callback with the row's competitionId.
   */
  onClaim?: (_competitionId: number) => void;
  /** Disables every Claim button while a claim mutation is in flight. */
  isClaiming?: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * Default page size for pagination
 */
const DEFAULT_PAGE_SIZE = 20;

/**
 * Default filters
 */
const DEFAULT_FILTERS: TransactionFilters = {
  dateRange: 'all',
  horseId: 'all',
  discipline: 'all',
};

/**
 * Default sort configuration
 */
const DEFAULT_SORT: SortConfig = {
  field: 'date',
  direction: 'desc',
};

/**
 * Get date threshold for date range filter
 */
const getDateThreshold = (dateRange: string): Date | null => {
  const now = new Date();

  switch (dateRange) {
    case '7days':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30days':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90days':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
};

/**
 * Loading skeleton row component
 */
const SkeletonRow = memo(() => (
  <tr className="border-b border-[var(--glass-border)]" data-testid="transaction-skeleton">
    <td className="px-4 py-3">
      <Skeleton.Rect className="h-4 w-24" />
    </td>
    <td className="px-4 py-3">
      <Skeleton.Rect className="h-4 w-40" />
    </td>
    <td className="px-4 py-3">
      <Skeleton.Rect className="h-4 w-28" />
    </td>
    <td className="px-4 py-3">
      <Skeleton.Rect className="h-4 w-20" />
    </td>
    <td className="px-4 py-3 text-center">
      <Skeleton.Rect className="h-6 w-12 mx-auto" rounded="full" />
    </td>
    <td className="px-4 py-3 text-right">
      <Skeleton.Rect className="h-4 w-16 ml-auto" />
    </td>
    <td className="px-4 py-3 text-right">
      <Skeleton.Rect className="h-4 w-12 ml-auto" />
    </td>
  </tr>
));

SkeletonRow.displayName = 'SkeletonRow';

/**
 * Empty state component when no transactions
 */
const EmptyState = memo(() => (
  <div data-testid="empty-state">
    <EmptyStatePrimitive
      variant="first-use"
      icon={<Trophy className="h-8 w-8" aria-hidden="true" />}
      title="No transactions yet"
      description="Compete in events to start earning prizes. Your transaction history will appear here."
    />
  </div>
));

EmptyState.displayName = 'EmptyState';

/**
 * Filtered empty state component
 */
const FilteredEmptyState = memo(() => (
  <div data-testid="filtered-empty-state">
    <EmptyStatePrimitive
      variant="filtered"
      icon={<Filter className="h-8 w-8" aria-hidden="true" />}
      title="No transactions match your filters"
      description="Try adjusting your filters to see more results."
    />
  </div>
));

FilteredEmptyState.displayName = 'FilteredEmptyState';

/**
 * Sort button component for column headers
 */
const SortButton = memo(
  ({
    field,
    label,
    currentSort,
    onSort,
    testId,
  }: {
    field: SortConfig['field'];
    label: string;
    currentSort?: SortConfig;
    onSort: (_field: SortConfig['field']) => void;
    testId: string;
  }) => {
    const isActive = currentSort?.field === field;
    const direction = isActive ? currentSort.direction : null;

    const handleClick = useCallback(() => {
      onSort(field);
    }, [field, onSort]);

    return (
      <button
        onClick={handleClick}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
          isActive
            ? 'text-[var(--gold-light)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        } focus:outline-none focus:ring-2 focus:ring-[var(--gold-bright)] rounded`}
        data-testid={testId}
        aria-label={`Sort by ${label} ${direction === 'asc' ? 'descending' : 'ascending'}`}
      >
        {label}
        {isActive && direction === 'asc' && (
          <TrendingUp className="h-3 w-3" aria-hidden="true" data-testid="sort-asc-indicator" />
        )}
        {isActive && direction === 'desc' && (
          <TrendingDown className="h-3 w-3" aria-hidden="true" data-testid="sort-desc-indicator" />
        )}
      </button>
    );
  }
);

SortButton.displayName = 'SortButton';

/**
 * Filter controls component
 */
const FilterControls = memo(
  ({
    filters,
    horses,
    disciplines,
    hasActiveFilters,
    onFilterChange,
    onClearFilters,
  }: {
    filters: TransactionFilters;
    horses?: HorseOption[];
    disciplines?: string[];
    hasActiveFilters: boolean;
    onFilterChange: (_key: keyof TransactionFilters, _value: string | number) => void;
    onClearFilters: () => void;
  }) => {
    const handleDateRangeChange = useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        onFilterChange('dateRange', e.target.value);
      },
      [onFilterChange]
    );

    const handleHorseChange = useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        onFilterChange('horseId', value === 'all' ? 'all' : parseInt(value, 10));
      },
      [onFilterChange]
    );

    const handleDisciplineChange = useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        onFilterChange('discipline', e.target.value);
      },
      [onFilterChange]
    );

    return (
      <Surface variant="subtle" className="p-4 mb-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Date Range Filter */}
          <div>
            <label
              htmlFor="filter-date-range"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              <Calendar className="inline h-4 w-4 mr-1" aria-hidden="true" />
              Filter by Date
            </label>
            <Select
              id="filter-date-range"
              value={filters.dateRange || 'all'}
              onChange={handleDateRangeChange}
              data-testid="filter-date-range"
              aria-label="Filter by date range"
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
            </Select>
          </div>

          {/* Horse Filter */}
          <div>
            <label
              htmlFor="filter-horse"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              <Award className="inline h-4 w-4 mr-1" aria-hidden="true" />
              Filter by Horse
            </label>
            <Select
              id="filter-horse"
              value={filters.horseId === 'all' ? 'all' : String(filters.horseId || 'all')}
              onChange={handleHorseChange}
              data-testid="filter-horse"
              aria-label="Filter by horse"
            >
              <option value="all">All Horses</option>
              {horses?.map((horse) => (
                <option key={horse.id} value={horse.id}>
                  {horse.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Discipline Filter */}
          <div>
            <label
              htmlFor="filter-discipline"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              <Trophy className="inline h-4 w-4 mr-1" aria-hidden="true" />
              Filter by Discipline
            </label>
            <Select
              id="filter-discipline"
              value={filters.discipline || 'all'}
              onChange={handleDisciplineChange}
              data-testid="filter-discipline"
              aria-label="Filter by discipline"
            >
              <option value="all">All Disciplines</option>
              {disciplines?.map((discipline) => (
                <option key={discipline} value={discipline}>
                  {discipline}
                </option>
              ))}
            </Select>
          </div>

          {/* Clear Filters — supporting action, never gold (DECISIONS.md §5) */}
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClearFilters}
              disabled={!hasActiveFilters}
              className="w-full"
              data-testid="clear-filters"
              aria-label="Clear all filters"
            >
              <X className="inline h-4 w-4 mr-1" aria-hidden="true" />
              Clear Filters
            </Button>
          </div>
        </div>
      </Surface>
    );
  }
);

FilterControls.displayName = 'FilterControls';

/**
 * Pagination controls component
 */
const PaginationControls = memo(
  ({
    currentPage,
    totalPages,
    totalTransactions,
    onPageChange,
  }: {
    currentPage: number;
    totalPages: number;
    totalTransactions: number;
    onPageChange: (_page: number) => void;
  }) => {
    const handlePrevious = useCallback(() => {
      if (currentPage > 1) {
        onPageChange(currentPage - 1);
      }
    }, [currentPage, onPageChange]);

    const handleNext = useCallback(() => {
      if (currentPage < totalPages) {
        onPageChange(currentPage + 1);
      }
    }, [currentPage, totalPages, onPageChange]);

    return (
      <div
        className="flex items-center justify-between px-4 py-3 bg-[var(--glass-surface-subtle-bg)] border-t border-[var(--glass-border)]"
        data-testid="pagination-controls"
      >
        <div className="text-sm text-role-muted">
          <span data-testid="total-transactions">{totalTransactions}</span> transactions total
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-role-muted" data-testid="page-info">
            Page {currentPage} of {totalPages}
          </span>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              disabled={currentPage <= 1}
              data-testid="prev-page-btn"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleNext}
              disabled={currentPage >= totalPages}
              data-testid="next-page-btn"
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

PaginationControls.displayName = 'PaginationControls';

/**
 * PrizeTransactionHistory Component
 *
 * Displays a comprehensive history of prize transactions with filtering,
 * sorting, and pagination capabilities.
 */
const PrizeTransactionHistory: React.FC<PrizeTransactionHistoryProps> = ({
  transactions,
  horses,
  disciplines,
  filters: controlledFilters,
  sortConfig: controlledSortConfig,
  currentPage: controlledCurrentPage,
  pageSize = DEFAULT_PAGE_SIZE,
  onFilterChange,
  onSortChange,
  onPageChange,
  onViewCompetition,
  onViewHorse,
  onClaim,
  isClaiming,
  isLoading = false,
  className = '',
}) => {
  // Internal state for uncontrolled mode
  const [internalFilters, setInternalFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [internalSortConfig, setInternalSortConfig] = useState<SortConfig>(DEFAULT_SORT);
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);

  // Determine if controlled or uncontrolled
  const filters = controlledFilters ?? internalFilters;
  const sortConfig = controlledSortConfig ?? internalSortConfig;
  const currentPage = controlledCurrentPage ?? internalCurrentPage;

  // Check if any filters are active
  const hasActiveFilters = useMemo(
    () =>
      (filters.dateRange && filters.dateRange !== 'all') ||
      (filters.horseId && filters.horseId !== 'all') ||
      (filters.discipline && filters.discipline !== 'all'),
    [filters]
  );

  // Handle filter change
  const handleFilterChange = useCallback(
    (key: keyof TransactionFilters, value: string | number) => {
      const newFilters = { ...filters, [key]: value };

      if (onFilterChange) {
        onFilterChange(newFilters);
      } else {
        setInternalFilters(newFilters);
      }

      // Reset to first page when filters change
      if (onPageChange) {
        onPageChange(1);
      } else {
        setInternalCurrentPage(1);
      }
    },
    [filters, onFilterChange, onPageChange]
  );

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    const clearedFilters: TransactionFilters = {
      dateRange: 'all',
      horseId: 'all',
      discipline: 'all',
    };

    if (onFilterChange) {
      onFilterChange(clearedFilters);
    } else {
      setInternalFilters(clearedFilters);
    }

    // Reset to first page
    if (onPageChange) {
      onPageChange(1);
    } else {
      setInternalCurrentPage(1);
    }
  }, [onFilterChange, onPageChange]);

  // Handle sort change
  const handleSortChange = useCallback(
    (field: SortConfig['field']) => {
      const newDirection =
        sortConfig.field === field && sortConfig.direction === 'desc' ? 'asc' : 'desc';
      const newSort: SortConfig = { field, direction: newDirection };

      if (onSortChange) {
        onSortChange(newSort);
      } else {
        setInternalSortConfig(newSort);
      }
    },
    [sortConfig, onSortChange]
  );

  // Handle page change
  const handlePageChange = useCallback(
    (page: number) => {
      if (onPageChange) {
        onPageChange(page);
      } else {
        setInternalCurrentPage(page);
      }
    },
    [onPageChange]
  );

  // Filter and sort transactions
  const processedTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Apply date range filter
    if (filters.dateRange && filters.dateRange !== 'all') {
      const dateThreshold = getDateThreshold(filters.dateRange);
      if (dateThreshold) {
        filtered = filtered.filter((t) => new Date(t.date) >= dateThreshold);
      }
    }

    // Apply horse filter
    if (filters.horseId && filters.horseId !== 'all') {
      filtered = filtered.filter((t) => t.horseId === filters.horseId);
    }

    // Apply discipline filter
    if (filters.discipline && filters.discipline !== 'all') {
      filtered = filtered.filter((t) => t.discipline === filters.discipline);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortConfig.field) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'prize':
          comparison = a.prizeMoney - b.prizeMoney;
          break;
        case 'xp':
          comparison = a.xpGained - b.xpGained;
          break;
        case 'placement':
          comparison = a.placement - b.placement;
          break;
        default:
          comparison = 0;
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [transactions, filters, sortConfig]);

  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(processedTransactions.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTransactions = processedTransactions.slice(startIndex, startIndex + pageSize);

  // Check if filtered results are empty but there are transactions
  const isFilteredEmpty =
    hasActiveFilters && transactions.length > 0 && processedTransactions.length === 0;

  // Render loading state
  if (isLoading) {
    return (
      <Surface
        variant="panel"
        className={className}
        data-testid="prize-transaction-history"
        role="region"
        aria-label="Prize transaction history"
      >
        <div className="p-6">
          <h2 className="type-section-heading mb-4">Prize Transaction History</h2>

          <FilterControls
            filters={filters}
            horses={horses}
            disciplines={disciplines}
            hasActiveFilters={false}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />

          <div className="overflow-x-auto">
            <table className="w-full" data-testid="transactions-table">
              <thead className="bg-[var(--glass-surface-subtle-bg)] border-b border-[var(--glass-border)]">
                <tr>
                  <th className="px-4 py-3 text-left" data-testid="column-date">
                    <span className="text-xs font-semibold text-role-muted uppercase">Date</span>
                  </th>
                  <th className="px-4 py-3 text-left" data-testid="column-competition">
                    <span className="text-xs font-semibold text-role-muted uppercase">
                      Competition
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left" data-testid="column-horse">
                    <span className="text-xs font-semibold text-role-muted uppercase">Horse</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-semibold text-role-muted uppercase">
                      Discipline
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center" data-testid="column-placement">
                    <span className="text-xs font-semibold text-role-muted uppercase">Place</span>
                  </th>
                  <th className="px-4 py-3 text-right" data-testid="column-prize">
                    <span className="text-xs font-semibold text-role-muted uppercase">Prize</span>
                  </th>
                  <th className="px-4 py-3 text-right" data-testid="column-xp">
                    <span className="text-xs font-semibold text-role-muted uppercase">XP</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={`skeleton-${i}`} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Surface>
    );
  }

  // Render empty state
  if (transactions.length === 0) {
    return (
      <Surface
        variant="panel"
        className={className}
        data-testid="prize-transaction-history"
        role="region"
        aria-label="Prize transaction history"
      >
        <div className="p-6">
          <h2 className="type-section-heading mb-4">Prize Transaction History</h2>
          <EmptyState />
        </div>
      </Surface>
    );
  }

  return (
    <Surface
      variant="panel"
      className={className}
      data-testid="prize-transaction-history"
      role="region"
      aria-label="Prize transaction history"
    >
      <div className="p-6">
        <h2 className="type-section-heading mb-4">Prize Transaction History</h2>

        <FilterControls
          filters={filters}
          horses={horses}
          disciplines={disciplines}
          hasActiveFilters={hasActiveFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

        {isFilteredEmpty ? (
          <FilteredEmptyState />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="transactions-table">
                <thead className="bg-[var(--glass-surface-subtle-bg)] border-b border-[var(--glass-border)]">
                  <tr>
                    <th className="px-4 py-3 text-left" data-testid="column-date">
                      <SortButton
                        field="date"
                        label="Date"
                        currentSort={sortConfig}
                        onSort={handleSortChange}
                        testId="sort-date"
                      />
                    </th>
                    <th className="px-4 py-3 text-left" data-testid="column-competition">
                      <span className="text-xs font-semibold text-role-muted uppercase">
                        Competition
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left" data-testid="column-horse">
                      <span className="text-xs font-semibold text-role-muted uppercase">Horse</span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-semibold text-role-muted uppercase">
                        Discipline
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center" data-testid="column-placement">
                      <SortButton
                        field="placement"
                        label="Place"
                        currentSort={sortConfig}
                        onSort={handleSortChange}
                        testId="sort-placement"
                      />
                    </th>
                    <th className="px-4 py-3 text-right" data-testid="column-prize">
                      <SortButton
                        field="prize"
                        label="Prize"
                        currentSort={sortConfig}
                        onSort={handleSortChange}
                        testId="sort-prize"
                      />
                    </th>
                    <th className="px-4 py-3 text-right" data-testid="column-xp">
                      <SortButton
                        field="xp"
                        label="XP"
                        currentSort={sortConfig}
                        onSort={handleSortChange}
                        testId="sort-xp"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((transaction) => (
                    <PrizeTransactionRow
                      key={transaction.transactionId}
                      transaction={transaction}
                      onViewCompetition={onViewCompetition}
                      onViewHorse={onViewHorse}
                      onClaim={onClaim}
                      isClaiming={isClaiming}
                      layout="table"
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalTransactions={processedTransactions.length}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </Surface>
  );
};

export default memo(PrizeTransactionHistory);
