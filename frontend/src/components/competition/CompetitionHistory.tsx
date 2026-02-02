/**
 * CompetitionHistory Component
 *
 * Displays a horse's full competition history with statistics and filtering.
 * Features:
 * - Statistics summary card (total competitions, wins, top 3, win rate, etc.)
 * - Filter controls (discipline, date range, placement)
 * - Chronological competition history list with entry details
 * - Loading, empty, error, and filtered empty states
 * - WCAG 2.1 AA accessibility compliant
 *
 * Story 5-3: Competition History Display
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Trophy,
  Medal,
  Star,
  TrendingUp,
  Calendar,
  DollarSign,
  Zap,
  Filter,
  X,
  AlertCircle,
  RefreshCw,
  Award,
  Target,
  BarChart3,
  Eye,
} from 'lucide-react';
import { DISCIPLINES } from '@/lib/utils/training-utils';

/**
 * Competition entry data structure
 */
export interface CompetitionEntry {
  competitionId: number;
  competitionName: string;
  discipline: string;
  date: string;
  rank: number;
  totalParticipants: number;
  score: number;
  prizeWon: number;
  xpGained: number;
}

/**
 * Competition statistics data structure
 */
export interface CompetitionStatistics {
  totalCompetitions: number;
  wins: number;
  top3Finishes: number;
  winRate: number;
  totalPrizeMoney: number;
  averagePlacement: number;
  bestPlacement: number;
}

/**
 * Full competition history data structure
 */
export interface CompetitionHistoryData {
  horseId: number;
  horseName: string;
  statistics: CompetitionStatistics;
  competitions: CompetitionEntry[];
}

/**
 * Date range filter options
 */
export type DateRangeFilter = 'all' | 'last-week' | 'last-month' | 'last-3-months' | 'last-year';

/**
 * Placement filter options
 */
export type PlacementFilter = 'all' | 'wins' | 'top3' | 'top10';

/**
 * CompetitionHistory component props
 */
export interface CompetitionHistoryProps {
  horseId: number;
  horseName: string;
  data?: CompetitionHistoryData;
  onViewResults?: (competitionId: number) => void;
  onViewPerformance?: (competitionId: number, horseId: number) => void;
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
      return 'bg-yellow-400 text-yellow-900';
    case 2:
      return 'bg-gray-300 text-gray-900';
    case 3:
      return 'bg-orange-400 text-orange-900';
    default:
      return 'bg-gray-200 text-gray-700';
  }
};

/**
 * Get ordinal suffix for a number
 */
const getOrdinalSuffix = (n: number): string => {
  if (n === 0) return '-';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
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

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${badgeClasses}`}
      data-testid={`placement-badge-${rank}`}
    >
      <PlacementIcon rank={rank} />
      {getOrdinalSuffix(rank)}
    </span>
  );
});

PlacementBadge.displayName = 'PlacementBadge';

/**
 * Statistics card component
 */
const StatisticsCard = memo(({ statistics }: { statistics: CompetitionStatistics }) => {
  // Determine win rate color
  const winRateColorClass = statistics.winRate > 30 ? 'text-green-600' : 'text-blue-600';

  return (
    <div
      className="bg-white rounded-lg shadow p-6 mb-6"
      data-testid="statistics-card"
    >
      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-blue-500" aria-hidden="true" />
        Performance Statistics
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Competitions */}
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total</p>
          <p
            className="text-2xl font-bold text-slate-800"
            data-testid="stat-total-competitions"
          >
            {statistics.totalCompetitions}
          </p>
        </div>

        {/* Wins */}
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Wins</p>
          <p
            className="text-2xl font-bold text-yellow-600"
            data-testid="stat-wins"
          >
            {statistics.wins}
          </p>
        </div>

        {/* Top 3 Finishes */}
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Top 3</p>
          <p
            className="text-2xl font-bold text-orange-600"
            data-testid="stat-top3"
          >
            {statistics.top3Finishes}
          </p>
        </div>

        {/* Win Rate */}
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Win Rate</p>
          <p
            className={`text-2xl font-bold ${winRateColorClass}`}
            data-testid="stat-win-rate"
          >
            {statistics.winRate.toFixed(1)}%
          </p>
        </div>

        {/* Total Prize Money */}
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Prize Money</p>
          <p
            className="text-2xl font-bold text-purple-600"
            data-testid="stat-total-prize"
          >
            {formatCurrency(statistics.totalPrizeMoney)}
          </p>
        </div>

        {/* Average/Best Placement */}
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <div className="flex justify-between mb-1">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Avg</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Best</p>
          </div>
          <div className="flex justify-between">
            <p
              className="text-lg font-bold text-slate-700"
              data-testid="stat-avg-placement"
            >
              {statistics.averagePlacement > 0 ? statistics.averagePlacement.toFixed(1) : '-'}
            </p>
            <p
              className="text-lg font-bold text-green-600"
              data-testid="stat-best-placement"
            >
              {statistics.bestPlacement > 0 ? statistics.bestPlacement : '-'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

StatisticsCard.displayName = 'StatisticsCard';

/**
 * Loading skeletons component
 */
const LoadingSkeletons = memo(() => (
  <>
    {/* Statistics skeleton */}
    <div className="bg-white rounded-lg shadow p-6 mb-6 animate-pulse">
      <div className="h-6 bg-slate-200 rounded w-1/4 mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`stat-skeleton-${i}`} className="bg-slate-100 rounded-lg p-3">
            <div className="h-3 bg-slate-200 rounded w-12 mx-auto mb-2" />
            <div className="h-8 bg-slate-200 rounded w-16 mx-auto" />
          </div>
        ))}
      </div>
    </div>

    {/* Entry skeletons */}
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={`skeleton-${index}`}
        className="bg-white rounded-lg shadow p-4 mb-3 animate-pulse"
        data-testid="entry-skeleton"
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="h-5 bg-slate-200 rounded w-48 mb-2" />
            <div className="h-4 bg-slate-200 rounded w-24" />
          </div>
          <div className="h-6 bg-slate-200 rounded-full w-16" />
        </div>
        <div className="flex gap-4">
          <div className="h-4 bg-slate-200 rounded w-20" />
          <div className="h-4 bg-slate-200 rounded w-16" />
          <div className="h-4 bg-slate-200 rounded w-12" />
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
    <Trophy className="mx-auto h-16 w-16 text-slate-300 mb-4" aria-hidden="true" />
    <h3 className="text-lg font-medium text-slate-900 mb-2">No competition history yet</h3>
    <p className="text-sm text-slate-600 max-w-sm mx-auto">
      Enter your first competition to start building your record. Every journey begins with a single step!
    </p>
  </div>
));

EmptyState.displayName = 'EmptyState';

/**
 * Filtered empty state component
 */
const FilteredEmptyState = memo(() => (
  <div className="py-12 text-center" data-testid="filtered-empty-state">
    <Filter className="mx-auto h-12 w-12 text-slate-300 mb-4" aria-hidden="true" />
    <h3 className="text-lg font-medium text-slate-900 mb-2">No competitions match your filters</h3>
    <p className="text-sm text-slate-600">
      Try adjusting your filters to see more results.
    </p>
  </div>
));

FilteredEmptyState.displayName = 'FilteredEmptyState';

/**
 * Error state component
 */
const ErrorState = memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="py-12 text-center" data-testid="error-state">
    <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" aria-hidden="true" />
    <h3 className="text-lg font-medium text-slate-900 mb-2">Unable to load history</h3>
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
 * Competition entry card component
 */
const CompetitionEntryCard = memo(({
  entry,
  horseId,
  onViewResults,
  onViewPerformance,
}: {
  entry: CompetitionEntry;
  horseId: number;
  onViewResults?: (competitionId: number) => void;
  onViewPerformance?: (competitionId: number, horseId: number) => void;
}) => {
  const handleClick = useCallback(() => {
    onViewResults?.(entry.competitionId);
  }, [onViewResults, entry.competitionId]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onViewResults?.(entry.competitionId);
    }
  }, [onViewResults, entry.competitionId]);

  const handleViewPerformance = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onViewPerformance?.(entry.competitionId, horseId);
  }, [onViewPerformance, entry.competitionId, horseId]);

  // Get discipline display name
  const disciplineInfo = DISCIPLINES.find((d) => d.id === entry.discipline);
  const disciplineName = disciplineInfo?.name || entry.discipline;

  return (
    <div
      className="bg-white rounded-lg shadow p-4 mb-3 cursor-pointer transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      data-testid="competition-entry"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`View details for ${entry.competitionName}`}
    >
      {/* Header Row */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="text-lg font-semibold text-slate-900">{entry.competitionName}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
              data-testid="discipline-badge"
            >
              {disciplineName}
            </span>
            <span className="text-sm text-slate-500 flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {formatDate(entry.date)}
            </span>
          </div>
        </div>
        <PlacementBadge rank={entry.rank} />
      </div>

      {/* Details Row */}
      <div className="flex flex-wrap items-center gap-4 text-sm border-t border-slate-100 pt-3">
        {/* Score */}
        <div className="flex items-center gap-1">
          <Target className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <span className="text-slate-600">Score:</span>
          <span className="font-medium text-slate-800">{entry.score.toFixed(1)}</span>
        </div>

        {/* Prize */}
        <div className="flex items-center gap-1">
          <DollarSign className="h-4 w-4 text-green-500" aria-hidden="true" />
          <span className="font-medium text-slate-800">{formatCurrency(entry.prizeWon)}</span>
        </div>

        {/* XP */}
        <div className="flex items-center gap-1">
          <Zap className="h-4 w-4 text-purple-500" aria-hidden="true" />
          <span className="font-medium text-slate-800">{entry.xpGained}</span>
          <span className="text-slate-600">XP</span>
        </div>

        {/* Participants */}
        <div className="flex items-center gap-1 text-slate-500">
          <span>({entry.rank}/{entry.totalParticipants})</span>
        </div>

        {/* View Performance Button */}
        {onViewPerformance && (
          <button
            onClick={handleViewPerformance}
            className="ml-auto inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="view-performance-btn"
            aria-label={`View performance breakdown for ${entry.competitionName}`}
          >
            <Eye className="h-3 w-3" aria-hidden="true" />
            View Performance
          </button>
        )}
      </div>
    </div>
  );
});

CompetitionEntryCard.displayName = 'CompetitionEntryCard';

/**
 * Filter controls component
 */
const FilterControls = memo(({
  disciplineFilter,
  dateRangeFilter,
  placementFilter,
  onDisciplineChange,
  onDateRangeChange,
  onPlacementChange,
  onClearFilters,
  hasActiveFilters,
}: {
  disciplineFilter: string;
  dateRangeFilter: DateRangeFilter;
  placementFilter: PlacementFilter;
  onDisciplineChange: (value: string) => void;
  onDateRangeChange: (value: DateRangeFilter) => void;
  onPlacementChange: (value: PlacementFilter) => void;
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

        {/* Date Range Filter */}
        <div>
          <label
            htmlFor="date-range-filter"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            <Calendar className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Filter by Date Range
          </label>
          <select
            id="date-range-filter"
            value={dateRangeFilter}
            onChange={(e) => onDateRangeChange(e.target.value as DateRangeFilter)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid="filter-date-range"
            aria-label="Filter by date range"
          >
            <option value="all">All Time</option>
            <option value="last-week">Last Week</option>
            <option value="last-month">Last Month</option>
            <option value="last-3-months">Last 3 Months</option>
            <option value="last-year">Last Year</option>
          </select>
        </div>

        {/* Placement Filter */}
        <div>
          <label
            htmlFor="placement-filter"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            <Award className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Filter by Placement
          </label>
          <select
            id="placement-filter"
            value={placementFilter}
            onChange={(e) => onPlacementChange(e.target.value as PlacementFilter)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid="filter-placement"
            aria-label="Filter by placement"
          >
            <option value="all">All Placements</option>
            <option value="wins">Wins (1st Place)</option>
            <option value="top3">Top 3</option>
            <option value="top10">Top 10</option>
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
 * Get date threshold for date range filter
 */
const getDateThreshold = (dateRange: DateRangeFilter): Date | null => {
  const now = new Date();

  switch (dateRange) {
    case 'last-week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'last-month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'last-3-months':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'last-year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
};

/**
 * CompetitionHistory Component
 *
 * Displays a horse's full competition history with statistics, filtering,
 * and chronological competition entries.
 */
const CompetitionHistory: React.FC<CompetitionHistoryProps> = ({
  horseId,
  horseName,
  data,
  onViewResults,
  onViewPerformance,
  isLoading = false,
  error = null,
  onRetry,
  className = '',
}) => {
  // Local state for filters
  const [disciplineFilter, setDisciplineFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('all');
  const [placementFilter, setPlacementFilter] = useState<PlacementFilter>('all');

  // Check if any filters are active
  const hasActiveFilters = useMemo(
    () => disciplineFilter !== 'all' || dateRangeFilter !== 'all' || placementFilter !== 'all',
    [disciplineFilter, dateRangeFilter, placementFilter]
  );

  // Clear all filters handler
  const handleClearFilters = useCallback(() => {
    setDisciplineFilter('all');
    setDateRangeFilter('all');
    setPlacementFilter('all');
  }, []);

  // Filter competitions based on current filters
  const filteredCompetitions = useMemo(() => {
    if (!data?.competitions) return [];

    let filtered = [...data.competitions];

    // Apply discipline filter
    if (disciplineFilter !== 'all') {
      filtered = filtered.filter((c) => c.discipline === disciplineFilter);
    }

    // Apply date range filter
    const dateThreshold = getDateThreshold(dateRangeFilter);
    if (dateThreshold) {
      filtered = filtered.filter((c) => new Date(c.date) >= dateThreshold);
    }

    // Apply placement filter
    if (placementFilter === 'wins') {
      filtered = filtered.filter((c) => c.rank === 1);
    } else if (placementFilter === 'top3') {
      filtered = filtered.filter((c) => c.rank <= 3);
    } else if (placementFilter === 'top10') {
      filtered = filtered.filter((c) => c.rank <= 10);
    }

    // Sort by date (most recent first)
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return filtered;
  }, [data?.competitions, disciplineFilter, dateRangeFilter, placementFilter]);

  // Determine if filtered empty
  const isFilteredEmpty = useMemo(
    () => hasActiveFilters && data?.competitions && data.competitions.length > 0 && filteredCompetitions.length === 0,
    [hasActiveFilters, data?.competitions, filteredCompetitions]
  );

  // Render loading state
  if (isLoading) {
    return (
      <div
        className={`bg-slate-50 rounded-lg p-4 ${className}`}
        data-testid="competition-history"
        role="region"
        aria-label="Competition history"
      >
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{horseName}</h2>
        <p className="text-slate-600 mb-6">Competition History</p>
        <LoadingSkeletons />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div
        className={`bg-slate-50 rounded-lg p-4 ${className}`}
        data-testid="competition-history"
        role="region"
        aria-label="Competition history"
      >
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{horseName}</h2>
        <p className="text-slate-600 mb-6">Competition History</p>
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    );
  }

  // Render empty state (no data at all)
  if (!data || data.competitions.length === 0) {
    return (
      <div
        className={`bg-slate-50 rounded-lg p-4 ${className}`}
        data-testid="competition-history"
        role="region"
        aria-label="Competition history"
      >
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{horseName}</h2>
        <p className="text-slate-600 mb-6">Competition History</p>

        {/* Show empty statistics card */}
        {data && <StatisticsCard statistics={data.statistics} />}

        <EmptyState />
      </div>
    );
  }

  // Render main content
  return (
    <div
      className={`bg-slate-50 rounded-lg p-4 ${className}`}
      data-testid="competition-history"
      role="region"
      aria-label="Competition history"
    >
      {/* Header */}
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{horseName}</h2>
      <p className="text-slate-600 mb-6">Competition History</p>

      {/* Statistics Card */}
      <StatisticsCard statistics={data.statistics} />

      {/* Filter Controls */}
      <FilterControls
        disciplineFilter={disciplineFilter}
        dateRangeFilter={dateRangeFilter}
        placementFilter={placementFilter}
        onDisciplineChange={setDisciplineFilter}
        onDateRangeChange={setDateRangeFilter}
        onPlacementChange={setPlacementFilter}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Filtered empty state */}
      {isFilteredEmpty ? (
        <FilteredEmptyState />
      ) : (
        <>
          {/* Results Count */}
          <div className="mb-3">
            <p className="text-sm text-slate-600">
              {filteredCompetitions.length} {filteredCompetitions.length === 1 ? 'competition' : 'competitions'} found
            </p>
          </div>

          {/* Competition List */}
          <div data-testid="competition-list">
            {filteredCompetitions.map((entry) => (
              <CompetitionEntryCard
                key={entry.competitionId}
                entry={entry}
                horseId={horseId}
                onViewResults={onViewResults}
                onViewPerformance={onViewPerformance}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default memo(CompetitionHistory);
