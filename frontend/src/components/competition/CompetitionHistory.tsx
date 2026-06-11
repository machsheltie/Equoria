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
  Calendar,
  Coins,
  Zap,
  Filter,
  X,
  Award,
  Target,
  BarChart3,
  Eye,
} from 'lucide-react';
import Currency from '@/components/ui/Currency';
import { DISCIPLINES } from '@/lib/utils/training-utils';
import { Select } from '@/components/ui/form';
import { Skeleton, ErrorState } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';

/**
 * Competition entry data structure
 */
export interface CompetitionEntry {
  competitionId: number;
  competitionName: string;
  discipline: string;
  date: string;
  /** Final placement (1 = first). Aliased as `rank` for display convenience. */
  placement: number;
  totalParticipants: number;
  finalScore: number;
  prizeMoney: number;
  /** Not persisted in CompetitionResult schema; omitted by backend until Equoria-aenc migration lands. */
  xpGained?: number;
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
  onViewResults?: (_competitionId: number) => void;
  onViewPerformance?: (_competitionId: number, _horseId: number) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

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
      return 'bg-slate-400/30 text-[rgb(220,235,255)]';
    case 3:
      return 'bg-orange-400 text-orange-900';
    default:
      return 'bg-[rgba(15,35,70,0.5)] text-slate-400';
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
  // Determine win rate color — success role above 30%, info role otherwise
  const winRateColorClass =
    statistics.winRate > 30 ? 'text-[var(--role-success-text)]' : 'text-[var(--role-info-text)]';

  return (
    <div className="glass-panel rounded-lg p-6 mb-6" data-testid="statistics-card">
      <h3 className="text-lg font-semibold text-role-primary mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-[var(--role-info-text)]" aria-hidden="true" />
        Performance Statistics
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Competitions */}
        <div className="text-center p-3 bg-[var(--role-neutral-bg)] rounded-lg">
          <p className="text-xs text-role-secondary uppercase tracking-wide mb-1">Total</p>
          <p className="text-2xl font-bold text-role-primary" data-testid="stat-total-competitions">
            {statistics.totalCompetitions}
          </p>
        </div>

        {/* Wins */}
        <div className="text-center p-3 bg-[var(--role-neutral-bg)] rounded-lg">
          <p className="text-xs text-role-secondary uppercase tracking-wide mb-1">Wins</p>
          <p className="text-2xl font-bold text-[var(--role-accent-text)]" data-testid="stat-wins">
            {statistics.wins}
          </p>
        </div>

        {/* Top 3 Finishes */}
        <div className="text-center p-3 bg-[var(--role-neutral-bg)] rounded-lg">
          <p className="text-xs text-role-secondary uppercase tracking-wide mb-1">Top 3</p>
          <p className="text-2xl font-bold text-[var(--role-warning-text)]" data-testid="stat-top3">
            {statistics.top3Finishes}
          </p>
        </div>

        {/* Win Rate */}
        <div className="text-center p-3 bg-[var(--role-neutral-bg)] rounded-lg">
          <p className="text-xs text-role-secondary uppercase tracking-wide mb-1">Win Rate</p>
          <p className={`text-2xl font-bold ${winRateColorClass}`} data-testid="stat-win-rate">
            {statistics.winRate.toFixed(1)}%
          </p>
        </div>

        {/* Total Prize Money */}
        <div className="text-center p-3 bg-[var(--role-neutral-bg)] rounded-lg">
          <p className="text-xs text-role-secondary uppercase tracking-wide mb-1">Prize Money</p>
          <p
            className="text-2xl font-bold text-[var(--role-accent-text)]"
            data-testid="stat-total-prize"
          >
            <Currency amount={statistics.totalPrizeMoney} />
          </p>
        </div>

        {/* Average/Best Placement */}
        <div className="text-center p-3 bg-[var(--role-neutral-bg)] rounded-lg">
          <div className="flex justify-between mb-1">
            <p className="text-xs text-role-secondary uppercase tracking-wide">Avg</p>
            <p className="text-xs text-role-secondary uppercase tracking-wide">Best</p>
          </div>
          <div className="flex justify-between">
            <p className="text-lg font-bold text-role-primary" data-testid="stat-avg-placement">
              {statistics.averagePlacement > 0 ? statistics.averagePlacement.toFixed(1) : '-'}
            </p>
            <p
              className="text-lg font-bold text-[var(--role-success-text)]"
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
 * Loading skeletons — canonical Skeleton primitives (D-15 / §15).
 * Wrappers preserve the test-pinned `entry-skeleton` testid.
 */
const LoadingSkeletons = memo(() => (
  <>
    {/* Statistics skeleton */}
    <div className="glass-panel rounded-lg p-6 mb-6">
      <Skeleton.Rect className="h-6 w-1/4 mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`stat-skeleton-${i}`} className="bg-[var(--role-neutral-bg)] rounded-lg p-3">
            <Skeleton.Rect className="h-3 w-12 mx-auto mb-2" />
            <Skeleton.Rect className="h-8 w-16 mx-auto" />
          </div>
        ))}
      </div>
    </div>

    {/* Entry skeletons */}
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={`skeleton-${index}`}
        className="glass-panel rounded-lg p-4 mb-3"
        data-testid="entry-skeleton"
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <Skeleton.Rect className="h-5 w-48 mb-2" />
            <Skeleton.Rect className="h-4 w-24" />
          </div>
          <Skeleton.Rect className="h-6 w-16" rounded="full" />
        </div>
        <div className="flex gap-4">
          <Skeleton.Rect className="h-4 w-20" />
          <Skeleton.Rect className="h-4 w-16" />
          <Skeleton.Rect className="h-4 w-12" />
        </div>
      </div>
    ))}
  </>
));

LoadingSkeletons.displayName = 'LoadingSkeletons';

/**
 * Empty state — canonical EmptyState (D-17 / §15); wrapper preserves the
 * test-pinned `empty-state` testid and the encouraging copy.
 */
const HistoryEmptyState = memo(() => (
  <div data-testid="empty-state">
    <EmptyState
      variant="first-use"
      icon={<Trophy className="h-8 w-8" aria-hidden="true" />}
      title="No competition history yet"
      description="Enter your first competition to start building your record. Every journey begins with a single step!"
    />
  </div>
));

HistoryEmptyState.displayName = 'HistoryEmptyState';

/**
 * Filtered empty state — canonical EmptyState `filtered` variant (D-17 / §15);
 * wrapper preserves the test-pinned `filtered-empty-state` testid.
 */
const FilteredEmptyState = memo(() => (
  <div data-testid="filtered-empty-state">
    <EmptyState
      variant="filtered"
      icon={<Filter className="h-8 w-8" aria-hidden="true" />}
      title="No competitions match your filters"
      description="Try adjusting your filters to see more results."
    />
  </div>
));

FilteredEmptyState.displayName = 'FilteredEmptyState';

/**
 * Error state — canonical ErrorState (D-16 / §15); wrapper preserves the
 * test-pinned `error-state` testid and the retry behavior.
 */
const HistoryErrorState = memo(
  ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div data-testid="error-state">
      <ErrorState
        title="Unable to load history"
        message={message}
        retry={onRetry ? { label: 'Retry', onClick: onRetry } : undefined}
      />
    </div>
  )
);

HistoryErrorState.displayName = 'HistoryErrorState';

/**
 * Competition entry card component
 */
const CompetitionEntryCard = memo(
  ({
    entry,
    horseId,
    onViewResults,
    onViewPerformance,
  }: {
    entry: CompetitionEntry;
    horseId: number;
    onViewResults?: (_competitionId: number) => void;
    onViewPerformance?: (_competitionId: number, _horseId: number) => void;
  }) => {
    const handleClick = useCallback(() => {
      onViewResults?.(entry.competitionId);
    }, [onViewResults, entry.competitionId]);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onViewResults?.(entry.competitionId);
        }
      },
      [onViewResults, entry.competitionId]
    );

    const handleViewPerformance = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onViewPerformance?.(entry.competitionId, horseId);
      },
      [onViewPerformance, entry.competitionId, horseId]
    );

    // Get discipline display name
    const disciplineInfo = DISCIPLINES.find((d) => d.id === entry.discipline);
    const disciplineName = disciplineInfo?.name || entry.discipline;

    return (
      <div
        className="glass-panel glass-panel-interactive rounded-lg p-4 mb-3"
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
            <h4 className="text-lg font-semibold text-role-primary">{entry.competitionName}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--role-info-bg)] text-[var(--role-info-text)] border border-[var(--role-info-border)]"
                data-testid="discipline-badge"
              >
                {disciplineName}
              </span>
              <span className="text-sm text-role-secondary flex items-center gap-1">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                {formatDate(entry.date)}
              </span>
            </div>
          </div>
          <PlacementBadge rank={entry.placement} />
        </div>

        {/* Details Row */}
        <div className="flex flex-wrap items-center gap-4 text-sm border-t border-[var(--glass-border)] pt-3">
          {/* Score */}
          <div className="flex items-center gap-1">
            <Target className="h-4 w-4 text-role-secondary" aria-hidden="true" />
            <span className="text-role-secondary">Score:</span>
            <span className="font-medium text-role-primary">{entry.finalScore.toFixed(1)}</span>
          </div>

          {/* Prize */}
          <div className="flex items-center gap-1">
            <Coins className="h-4 w-4 text-[var(--role-success-text)]" aria-hidden="true" />
            <span className="font-medium text-role-primary">
              <Currency amount={entry.prizeMoney} showIcon={false} />
            </span>
          </div>

          {/* XP — field not yet persisted; hide when absent */}
          {entry.xpGained !== undefined && (
            <div className="flex items-center gap-1">
              <Zap className="h-4 w-4 text-[var(--role-accent-text)]" aria-hidden="true" />
              <span className="font-medium text-role-primary">{entry.xpGained}</span>
              <span className="text-role-secondary">XP</span>
            </div>
          )}

          {/* Participants */}
          <div className="flex items-center gap-1 text-role-secondary">
            <span>
              ({entry.placement}/{entry.totalParticipants})
            </span>
          </div>

          {/* View Performance Button */}
          {onViewPerformance && (
            <button
              onClick={handleViewPerformance}
              className="ml-auto inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-[var(--role-info-text)] bg-[var(--role-info-bg)] rounded hover:bg-[rgba(37,99,235,0.2)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-bright)]"
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
  }
);

CompetitionEntryCard.displayName = 'CompetitionEntryCard';

/**
 * Filter controls component
 */
const FilterControls = memo(
  ({
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
    onDisciplineChange: (_value: string) => void;
    onDateRangeChange: (_value: DateRangeFilter) => void;
    onPlacementChange: (_value: PlacementFilter) => void;
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
      <div className="glass-panel rounded-lg p-4 mb-4 sticky top-0 z-[var(--z-raised)]">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Discipline Filter */}
          <div>
            <label
              htmlFor="discipline-filter"
              className="block text-sm font-medium text-role-primary mb-1"
            >
              <Trophy className="inline h-4 w-4 mr-1" aria-hidden="true" />
              Filter by Discipline
            </label>
            <Select
              id="discipline-filter"
              value={disciplineFilter}
              onChange={(e) => onDisciplineChange(e.target.value)}
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
            </Select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label
              htmlFor="date-range-filter"
              className="block text-sm font-medium text-role-primary mb-1"
            >
              <Calendar className="inline h-4 w-4 mr-1" aria-hidden="true" />
              Filter by Date Range
            </label>
            <Select
              id="date-range-filter"
              value={dateRangeFilter}
              onChange={(e) => onDateRangeChange(e.target.value as DateRangeFilter)}
              data-testid="filter-date-range"
              aria-label="Filter by date range"
            >
              <option value="all">All Time</option>
              <option value="last-week">Last Week</option>
              <option value="last-month">Last Month</option>
              <option value="last-3-months">Last 3 Months</option>
              <option value="last-year">Last Year</option>
            </Select>
          </div>

          {/* Placement Filter */}
          <div>
            <label
              htmlFor="placement-filter"
              className="block text-sm font-medium text-role-primary mb-1"
            >
              <Award className="inline h-4 w-4 mr-1" aria-hidden="true" />
              Filter by Placement
            </label>
            <Select
              id="placement-filter"
              value={placementFilter}
              onChange={(e) => onPlacementChange(e.target.value as PlacementFilter)}
              data-testid="filter-placement"
              aria-label="Filter by placement"
            >
              <option value="all">All Placements</option>
              <option value="wins">Wins (1st Place)</option>
              <option value="top3">Top 3</option>
              <option value="top10">Top 10</option>
            </Select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={onClearFilters}
              disabled={!hasActiveFilters}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                hasActiveFilters
                  ? 'bg-[var(--role-danger-bg)] text-[var(--role-danger-text)] hover:bg-[rgba(239,68,68,0.25)] focus:outline-none focus:ring-2 focus:ring-[var(--role-danger-text)] focus:ring-offset-2'
                  : 'bg-[var(--role-neutral-bg)] text-role-secondary cursor-not-allowed'
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
  }
);

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
      filtered = filtered.filter((c) => c.placement === 1);
    } else if (placementFilter === 'top3') {
      filtered = filtered.filter((c) => c.placement <= 3);
    } else if (placementFilter === 'top10') {
      filtered = filtered.filter((c) => c.placement <= 10);
    }

    // Sort by date (most recent first)
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return filtered;
  }, [data?.competitions, disciplineFilter, dateRangeFilter, placementFilter]);

  // Determine if filtered empty
  const isFilteredEmpty = useMemo(
    () =>
      hasActiveFilters &&
      data?.competitions &&
      data.competitions.length > 0 &&
      filteredCompetitions.length === 0,
    [hasActiveFilters, data?.competitions, filteredCompetitions]
  );

  // Render loading state
  if (isLoading) {
    return (
      <div
        className={`bg-[rgba(15,35,70,0.4)] rounded-lg p-4 ${className}`}
        data-testid="competition-history"
        role="region"
        aria-label="Competition history"
      >
        <h2 className="text-2xl font-bold text-role-primary mb-2">{horseName}</h2>
        <p className="text-role-secondary mb-6">Competition History</p>
        <LoadingSkeletons />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div
        className={`bg-[rgba(15,35,70,0.4)] rounded-lg p-4 ${className}`}
        data-testid="competition-history"
        role="region"
        aria-label="Competition history"
      >
        <h2 className="text-2xl font-bold text-role-primary mb-2">{horseName}</h2>
        <p className="text-role-secondary mb-6">Competition History</p>
        <HistoryErrorState message={error} onRetry={onRetry} />
      </div>
    );
  }

  // Render empty state (no data at all)
  if (!data || data.competitions.length === 0) {
    return (
      <div
        className={`bg-[rgba(15,35,70,0.4)] rounded-lg p-4 ${className}`}
        data-testid="competition-history"
        role="region"
        aria-label="Competition history"
      >
        <h2 className="text-2xl font-bold text-role-primary mb-2">{horseName}</h2>
        <p className="text-role-secondary mb-6">Competition History</p>

        {/* Show empty statistics card */}
        {data && <StatisticsCard statistics={data.statistics} />}

        <HistoryEmptyState />
      </div>
    );
  }

  // Render main content
  return (
    <div
      className={`bg-[rgba(15,35,70,0.4)] rounded-lg p-4 ${className}`}
      data-testid="competition-history"
      role="region"
      aria-label="Competition history"
    >
      {/* Header */}
      <h2 className="text-2xl font-bold text-role-primary mb-2">{horseName}</h2>
      <p className="text-role-secondary mb-6">Competition History</p>

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
            <p className="text-sm text-role-secondary">
              {filteredCompetitions.length}{' '}
              {filteredCompetitions.length === 1 ? 'competition' : 'competitions'} found
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
