/**
 * CompetitionResultsList Component
 *
 * Displays a list of completed competitions with user's participation and results.
 * Features:
 * - Filter controls (status, discipline)
 * - Sort options (recent, prize, placement)
 * - Competition cards with placement badges
 * - Loading skeleton and error states
 * - Responsive grid layout (1/2/3 columns)
 * - WCAG 2.1 AA accessibility compliant
 *
 * Story 5-2: Competition Results Display
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Trophy,
  Medal,
  Star,
  Calendar,
  DollarSign,
  Filter,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { DISCIPLINES } from '@/lib/utils/training-utils';

/**
 * User result for a single horse in a competition
 */
export interface UserResult {
  horseId: number;
  horseName: string;
  rank: number;
  score: number;
  prizeWon: number;
  xpGained: number;
}

/**
 * Competition result summary data structure
 */
export interface CompetitionResultSummary {
  competitionId: number;
  competitionName: string;
  discipline: string;
  date: string;
  totalParticipants: number;
  prizePool: number;
  userResults: UserResult[];
}

/**
 * Status filter type
 */
export type StatusFilter = 'all' | 'wins' | 'top3' | 'participated';

/**
 * Filter options for competition results
 */
export interface CompetitionResultsFilters {
  status?: StatusFilter;
  discipline?: string;
}

/**
 * Sort options for competition results
 */
export type SortOption = 'recent' | 'prize' | 'placement';

/**
 * CompetitionResultsList component props
 */
export interface CompetitionResultsListProps {
  userId: string;
  results?: CompetitionResultSummary[];
  filters?: CompetitionResultsFilters;
  sortBy?: SortOption;
  onResultClick: (competitionId: number) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

/**
 * Format currency for display
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format date for display
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Get placement badge styling based on rank
 */
const getPlacementBadgeClasses = (rank: number): string => {
  switch (rank) {
    case 1:
      return 'bg-yellow-400 text-yellow-900'; // Gold
    case 2:
      return 'bg-gray-300 text-gray-900'; // Silver
    case 3:
      return 'bg-orange-400 text-orange-900'; // Bronze
    default:
      return 'bg-gray-200 text-gray-700'; // Other
  }
};

/**
 * Get placement icon based on rank
 */
const PlacementIcon = memo(({ rank }: { rank: number }) => {
  if (rank === 1) return <Trophy className="h-3 w-3" aria-hidden="true" />;
  if (rank <= 3) return <Medal className="h-3 w-3" aria-hidden="true" />;
  return <Star className="h-3 w-3" aria-hidden="true" />;
});

PlacementIcon.displayName = 'PlacementIcon';

/**
 * Placement badge component
 */
const PlacementBadge = memo(({ rank }: { rank: number }) => {
  const badgeClasses = getPlacementBadgeClasses(rank);
  const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${badgeClasses}`}
      data-testid={`placement-badge-${rank}`}
    >
      <PlacementIcon rank={rank} />
      {rank}{suffix}
    </span>
  );
});

PlacementBadge.displayName = 'PlacementBadge';

/**
 * Loading skeleton component
 */
const LoadingSkeletons = memo(() => (
  <>
    {Array.from({ length: 6 }).map((_, index) => (
      <div
        key={`skeleton-${index}`}
        className="bg-white rounded-lg shadow p-4 animate-pulse"
        data-testid="result-card-skeleton"
      >
        <div className="h-6 bg-slate-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded w-2/3" />
          <div className="h-4 bg-slate-200 rounded w-1/2" />
          <div className="h-4 bg-slate-200 rounded w-3/5" />
        </div>
      </div>
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
    <h3 className="text-lg font-medium text-slate-900 mb-2">No competition results found</h3>
    <p className="text-sm text-slate-600">
      Enter competitions to see your results here.
    </p>
  </div>
));

EmptyState.displayName = 'EmptyState';

/**
 * Error state component
 */
const ErrorState = memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="py-12 text-center" data-testid="error-state">
    <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" aria-hidden="true" />
    <h3 className="text-lg font-medium text-slate-900 mb-2">Unable to load results</h3>
    <p className="text-sm text-slate-600 mb-4">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        data-testid="retry-button"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Retry
      </button>
    )}
  </div>
));

ErrorState.displayName = 'ErrorState';

/**
 * Competition result card component
 */
const ResultCard = memo(({
  result,
  onClick,
}: {
  result: CompetitionResultSummary;
  onClick: (competitionId: number) => void;
}) => {
  const handleClick = useCallback(() => {
    onClick(result.competitionId);
  }, [onClick, result.competitionId]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(result.competitionId);
    }
  }, [onClick, result.competitionId]);

  // Get discipline display name
  const disciplineInfo = DISCIPLINES.find((d) => d.id === result.discipline);
  const disciplineName = disciplineInfo?.name || result.discipline;

  // Calculate total prize and XP won
  const totalPrize = result.userResults.reduce((sum, r) => sum + r.prizeWon, 0);
  const totalXp = result.userResults.reduce((sum, r) => sum + r.xpGained, 0);
  const bestRank = Math.min(...result.userResults.map((r) => r.rank));

  return (
    <div
      className="bg-white rounded-lg shadow p-4 cursor-pointer transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      data-testid="result-card"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`View details for ${result.competitionName}`}
    >
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-slate-900 truncate">
          {result.competitionName}
        </h3>
        <p className="text-sm text-slate-600">{disciplineName}</p>
      </div>

      {/* Date */}
      <div className="flex items-center mb-2 text-sm">
        <Calendar className="h-4 w-4 text-slate-400 mr-2" aria-hidden="true" />
        <span className="text-slate-700">{formatDate(result.date)}</span>
      </div>

      {/* Horse Results */}
      <div className="space-y-2 mb-3">
        {result.userResults.map((userResult) => (
          <div
            key={userResult.horseId}
            className="flex items-center justify-between bg-slate-50 rounded p-2"
          >
            <span className="text-sm font-medium text-slate-800 truncate">
              {userResult.horseName}
            </span>
            <PlacementBadge rank={userResult.rank} />
          </div>
        ))}
      </div>

      {/* Summary Row */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
        <div className="flex items-center">
          <DollarSign className="h-4 w-4 text-green-500 mr-1" aria-hidden="true" />
          <span className="text-slate-700">{formatCurrency(totalPrize)}</span>
        </div>
        <div className="flex items-center">
          <Star className="h-4 w-4 text-purple-500 mr-1" aria-hidden="true" />
          <span className="text-slate-700">{totalXp} XP</span>
        </div>
      </div>
    </div>
  );
});

ResultCard.displayName = 'ResultCard';

/**
 * Filter controls component
 */
const FilterControls = memo(({
  statusFilter,
  disciplineFilter,
  sortBy,
  onStatusChange,
  onDisciplineChange,
  onSortChange,
  onClearFilters,
  hasActiveFilters,
}: {
  statusFilter: string;
  disciplineFilter: string;
  sortBy: SortOption;
  onStatusChange: (value: StatusFilter) => void;
  onDisciplineChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}) => {
  // Group disciplines by category
  const disciplinesByCategory = useMemo(() => {
    const grouped: Record<string, typeof DISCIPLINES> = {};
    DISCIPLINES.forEach((discipline) => {
      if (!grouped[discipline.category]) {
        grouped[discipline.category] = [];
      }
      grouped[discipline.category].push(discipline);
    });
    return grouped;
  }, []);

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4 sticky top-0 z-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Status Filter */}
        <div>
          <label
            htmlFor="status-filter"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            <Filter className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Filter by Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid="filter-status"
            aria-label="Filter by status"
          >
            <option value="all">All Results</option>
            <option value="wins">Wins (1st Place)</option>
            <option value="top3">Top 3</option>
            <option value="participated">All Participated</option>
          </select>
        </div>

        {/* Discipline Filter */}
        <div>
          <label
            htmlFor="discipline-filter"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            <Trophy className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Filter by Discipline
          </label>
          <select
            id="discipline-filter"
            value={disciplineFilter}
            onChange={(e) => onDisciplineChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid="filter-discipline"
            aria-label="Filter by discipline"
          >
            <option value="all">All Disciplines</option>
            {Object.entries(disciplinesByCategory).map(([category, disciplines]) => (
              <optgroup key={category} label={category}>
                {disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Sort Dropdown */}
        <div>
          <label
            htmlFor="sort-dropdown"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            <Star className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Sort Results
          </label>
          <select
            id="sort-dropdown"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid="sort-dropdown"
            aria-label="Sort results"
          >
            <option value="recent">Recent First</option>
            <option value="prize">Highest Prize</option>
            <option value="placement">Best Placement</option>
          </select>
        </div>

        {/* Clear Filters */}
        <div className="flex items-end">
          <button
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
            className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
              hasActiveFilters
                ? 'bg-red-100 text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
            data-testid="clear-filters"
            aria-label="Clear all filters"
          >
            <X className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
});

FilterControls.displayName = 'FilterControls';

/**
 * CompetitionResultsList component
 *
 * Displays a filterable, sortable list of competition results.
 */
const CompetitionResultsList = ({
  userId,
  results = [],
  filters: initialFilters,
  sortBy: initialSortBy = 'recent',
  onResultClick,
  isLoading = false,
  error = null,
  onRetry,
  className = '',
}: CompetitionResultsListProps) => {
  // Local state for filters and sorting
  const [statusFilter, setStatusFilter] = useState(initialFilters?.status || 'all');
  const [disciplineFilter, setDisciplineFilter] = useState(
    initialFilters?.discipline || 'all'
  );
  const [sortBy, setSortBy] = useState<SortOption>(initialSortBy);

  // Check if any filters are active
  const hasActiveFilters = useMemo(
    () => statusFilter !== 'all' || disciplineFilter !== 'all',
    [statusFilter, disciplineFilter]
  );

  // Clear all filters handler
  const handleClearFilters = useCallback(() => {
    setStatusFilter('all');
    setDisciplineFilter('all');
  }, []);

  // Filter results based on current filters
  const filteredResults = useMemo(() => {
    let filtered = [...results];

    // Apply status filter
    if (statusFilter === 'wins') {
      filtered = filtered.filter((r) =>
        r.userResults.some((ur) => ur.rank === 1)
      );
    } else if (statusFilter === 'top3') {
      filtered = filtered.filter((r) =>
        r.userResults.some((ur) => ur.rank <= 3)
      );
    }
    // 'participated' and 'all' show everything

    // Apply discipline filter
    if (disciplineFilter !== 'all') {
      filtered = filtered.filter((r) => r.discipline === disciplineFilter);
    }

    return filtered;
  }, [results, statusFilter, disciplineFilter]);

  // Sort results based on current sort option
  const sortedResults = useMemo(() => {
    const sorted = [...filteredResults];

    switch (sortBy) {
      case 'recent':
        return sorted.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      case 'prize':
        return sorted.sort((a, b) => {
          const aPrize = a.userResults.reduce((sum, r) => sum + r.prizeWon, 0);
          const bPrize = b.userResults.reduce((sum, r) => sum + r.prizeWon, 0);
          return bPrize - aPrize;
        });
      case 'placement':
        return sorted.sort((a, b) => {
          const aBestRank = Math.min(...a.userResults.map((r) => r.rank));
          const bBestRank = Math.min(...b.userResults.map((r) => r.rank));
          return aBestRank - bBestRank;
        });
      default:
        return sorted;
    }
  }, [filteredResults, sortBy]);

  // Render loading state
  if (isLoading) {
    return (
      <div
        className={`bg-slate-50 rounded-lg ${className}`}
        data-testid="competition-results-list"
        role="region"
        aria-label="Competition results"
      >
        <FilterControls
          statusFilter={statusFilter}
          disciplineFilter={disciplineFilter}
          sortBy={sortBy}
          onStatusChange={setStatusFilter}
          onDisciplineChange={setDisciplineFilter}
          onSortChange={setSortBy}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4"
          data-testid="results-grid"
        >
          <LoadingSkeletons />
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div
        className={`bg-slate-50 rounded-lg ${className}`}
        data-testid="competition-results-list"
        role="region"
        aria-label="Competition results"
      >
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    );
  }

  // Render empty state
  if (sortedResults.length === 0) {
    return (
      <div
        className={`bg-slate-50 rounded-lg ${className}`}
        data-testid="competition-results-list"
        role="region"
        aria-label="Competition results"
      >
        <FilterControls
          statusFilter={statusFilter}
          disciplineFilter={disciplineFilter}
          sortBy={sortBy}
          onStatusChange={setStatusFilter}
          onDisciplineChange={setDisciplineFilter}
          onSortChange={setSortBy}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
        <EmptyState />
      </div>
    );
  }

  // Render results list
  return (
    <div
      className={`bg-slate-50 rounded-lg ${className}`}
      data-testid="competition-results-list"
      role="region"
      aria-label="Competition results"
    >
      <FilterControls
        statusFilter={statusFilter}
        disciplineFilter={disciplineFilter}
        sortBy={sortBy}
        onStatusChange={setStatusFilter}
        onDisciplineChange={setDisciplineFilter}
        onSortChange={setSortBy}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Results Count */}
      <div className="px-4 pb-2">
        <p className="text-sm text-slate-600">
          {sortedResults.length} {sortedResults.length === 1 ? 'result' : 'results'} found
        </p>
      </div>

      {/* Results Grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pt-0"
        data-testid="results-grid"
      >
        {sortedResults.map((result) => (
          <ResultCard
            key={result.competitionId}
            result={result}
            onClick={onResultClick}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(CompetitionResultsList);
