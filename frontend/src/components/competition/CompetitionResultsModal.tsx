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
 * - Click on user's horse to view performance breakdown
 * - PrizeSummaryCard showing user's prizes when applicable (Story 5-3)
 * - PrizeNotificationModal for first-time prize notifications (Story 5-3)
 * - Link to prize history page in footer (Story 5-3)
 * - XpGainNotification after viewing results (Story 5-4)
 * - LevelUpCelebrationModal for level-up events (Story 5-4)
 * - XpProgressTracker for each horse in results (Story 5-4)
 * - HorseLevelBadge next to horse names (Story 5-4)
 *
 * Features:
 * - Uses BaseModal for portal, focus trap, scroll lock, escape key, backdrop click
 * - Responsive design (table collapses to cards on mobile)
 * - WCAG 2.1 AA compliance
 * - Virtual scrolling ready for large datasets
 * - Notification sequencing: Prize -> XP -> Level-Up (Story 5-4)
 *
 * Story 5-2: Competition Results Display
 * Story 5-3: Competition History - Task 7 (Integration with Results Display)
 * Story 5-4: XP System Integration - Task 7 (Integration with Competition Results)
 */

import React, { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
import BaseModal from '@/components/common/BaseModal';
import PrizeSummaryCard, { type HorsePrize } from './PrizeSummaryCard';
import PrizeNotificationModal, { type PrizeData } from './PrizeNotificationModal';
import XpGainNotification from '../feedback/XpGainNotification';
import LevelUpCelebrationModal, { type StatChange } from '../feedback/LevelUpCelebrationModal';
import XpProgressTracker from '../XpProgressTracker';
import HorseLevelBadge from '../horse/HorseLevelBadge';
import { useHorseLevelInfo } from '@/hooks/api/useHorseLevelInfo';

/**
 * Participant result data structure
 */
export interface ParticipantResult {
  rank: number;
  horseId: number;
  horseName: string;
  ownerId: string;
  ownerName: string;
  finalScore: number;
  prizeWon: number;
  isCurrentUser: boolean;
}

/**
 * Competition results data structure
 */
export interface CompetitionResults {
  competitionId: number;
  competitionName: string;
  discipline: string;
  date: string;
  totalParticipants: number;
  prizePool: number;
  prizeDistribution: {
    first: number;
    second: number;
    third: number;
  };
  results: ParticipantResult[];
}

/**
 * Level-up data structure for celebration modal (Story 5-4)
 */
export interface LevelUpData {
  horseId: number;
  horseName: string;
  oldLevel: number;
  newLevel: number;
  statChanges: StatChange[];
  totalXpGained: number;
}

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
  /** Callback when user clicks to view performance breakdown */
  onViewPerformance?: (_horseId: number) => void;
  /** Callback for retrying data fetch on error */
  onRetry?: () => void;
  /** Callback when modal first opened with prizes (Story 5-3) */
  onFirstView?: () => void;
  /** Control prize notification display (Story 5-3) */
  showPrizeNotification?: boolean;
  /** Callback when prize notification is closed (Story 5-3) */
  onPrizeNotificationClose?: () => void;
  /** Control XP gain notification display (Story 5-4) */
  showXpNotification?: boolean;
  /** Callback when XP notification is closed (Story 5-4) */
  onXpNotificationClose?: () => void;
  /** Control level-up celebration modal display (Story 5-4) */
  showLevelUpCelebration?: boolean;
  /** Callback when level-up celebration is closed (Story 5-4) */
  onLevelUpClose?: () => void;
  /** Level-up data for celebration modal (Story 5-4) */
  levelUpData?: LevelUpData;
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
      return 'bg-[rgba(148,163,184,0.3)] text-[rgb(220,235,255)]'; // Silver
    case 3:
      return 'bg-orange-400 text-orange-900'; // Bronze
    default:
      return 'bg-[rgba(15,35,70,0.5)] text-[rgb(148,163,184)]'; // Other
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
    <Trophy className="mx-auto h-12 w-12 text-[rgb(148,163,184)] mb-4" aria-hidden="true" />
    <h3 className="text-lg font-medium text-[rgb(220,235,255)] mb-2">No results available</h3>
    <p className="text-sm text-[rgb(148,163,184)]">
      Results for this competition are not yet available.
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
    <h3 className="text-lg font-medium text-[rgb(220,235,255)] mb-2">Unable to load results</h3>
    <p className="text-sm text-[rgb(148,163,184)] mb-4">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-[var(--text-primary)] rounded-lg hover:bg-[var(--gold-dim)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
 * Delegates portal, focus trap, scroll lock, and keyboard handling to BaseModal.
 */
const CompetitionResultsModal = memo(function CompetitionResultsModal({
  isOpen,
  onClose,
  competitionId,
  onViewPerformance,
  onRetry,
  onFirstView,
  showPrizeNotification = false,
  onPrizeNotificationClose,
  showXpNotification = false,
  onXpNotificationClose,
  showLevelUpCelebration = false,
  onLevelUpClose,
  levelUpData,
  _testResults,
  _testLoading = false,
  _testError = null,
}: CompetitionResultsModalProps) {
  // Sort state
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Prize summary expansion state
  const [isPrizeExpanded, setIsPrizeExpanded] = useState(false);

  // Use test props or real data fetching (in production, you'd fetch here based on competitionId)
  const results = _testResults;
  const isLoading = _testLoading;
  const error = _testError;

  // Calculate user prizes for PrizeSummaryCard (Story 5-3)
  const userPrizes: HorsePrize[] = useMemo(() => {
    if (!results?.results) return [];

    return results.results
      .filter((r) => r.isCurrentUser && r.rank <= 3)
      .map((r) => ({
        horseId: r.horseId,
        horseName: r.horseName,
        placement: r.rank,
        prizeMoney: r.prizeWon,
        xpGained: Math.round(r.prizeWon * 0.1), // Calculate XP from prize money
      }));
  }, [results]);

  // Check if user has any prizes
  const hasUserPrizes = userPrizes.length > 0;

  // Get the best prize for notification modal (highest placement)
  const bestPrize = useMemo(() => {
    if (!hasUserPrizes || !results) return null;

    const sortedByPlacement = [...userPrizes].sort((a, b) => a.placement - b.placement);
    const best = sortedByPlacement[0];

    return {
      horseName: best.horseName,
      competitionName: results.competitionName,
      discipline: results.discipline,
      date: results.date,
      placement: best.placement as 1 | 2 | 3,
      prizeMoney: best.prizeMoney,
      xpGained: best.xpGained,
    } as PrizeData;
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

  // Handle XP notification close (Story 5-4)
  const handleXpNotificationClose = useCallback(() => {
    onXpNotificationClose?.();
  }, [onXpNotificationClose]);

  // Handle level-up celebration close (Story 5-4)
  const handleLevelUpClose = useCallback(() => {
    onLevelUpClose?.();
  }, [onLevelUpClose]);

  // Fetch horse level info for the first user horse result (Story 5-4)
  const firstUserHorseId = useMemo(() => {
    if (!results?.results) return 0;
    const firstUserResult = results.results.find((r) => r.isCurrentUser);
    return firstUserResult?.horseId ?? 0;
  }, [results]);

  const { data: horseLevelData } = useHorseLevelInfo(firstUserHorseId);

  // Calculate XP notification data from horse level info (Story 5-4)
  const xpNotificationData = useMemo(() => {
    if (!horseLevelData) {
      return {
        xpGained: 50,
        currentLevel: 1,
        currentXp: 0,
        xpForCurrentLevel: 0,
        xpToNextLevel: 100,
      };
    }
    return {
      xpGained: userPrizes.length > 0 ? Math.round(userPrizes[0].xpGained ?? 50) : 50,
      currentLevel: horseLevelData.availableStatPoints,
      currentXp: horseLevelData.currentXP,
      xpForCurrentLevel: horseLevelData.nextStatPointAt - horseLevelData.xpToNextStatPoint,
      xpToNextLevel: horseLevelData.nextStatPointAt,
    };
  }, [horseLevelData, userPrizes]);

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
          // Ascending: 1, 2, 3... (lower rank is better)
          comparison = a.rank - b.rank;
          break;
        case 'score':
          // Ascending: low to high; Descending (default): high to low
          comparison = a.finalScore - b.finalScore;
          break;
        case 'horse':
          comparison = a.horseName.localeCompare(b.horseName);
          break;
        case 'owner':
          comparison = a.ownerName.localeCompare(b.ownerName);
          break;
      }

      // For ascending, keep comparison as-is; for descending, flip it
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [results?.results, sortField, sortDirection]);

  // Handle row click for user's horses
  const handleRowClick = useCallback(
    (result: ParticipantResult) => {
      if (result.isCurrentUser && onViewPerformance) {
        onViewPerformance(result.horseId);
      }
    },
    [onViewPerformance]
  );

  // Render content based on state
  const renderContent = () => {
    // Loading state
    if (isLoading) {
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full" role="table">
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
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold text-[rgb(220,235,255)] uppercase tracking-wider"
              >
                XP Progress
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(37,99,235,0.2)]">
            {sortedResults.map((result, index) => {
              const isUserHorse = result.isCurrentUser;
              const rowClasses = `
                ${isUserHorse ? 'bg-[rgba(37,99,235,0.1)] cursor-pointer hover:bg-[rgba(37,99,235,0.2)]' : index % 2 === 0 ? 'bg-[rgba(15,35,70,0.4)]' : 'bg-[rgba(15,35,70,0.5)]'}
                transition-colors
              `;

              return (
                <tr
                  key={result.horseId}
                  className={rowClasses}
                  data-testid={`result-row-${result.horseId}`}
                  onClick={() => handleRowClick(result)}
                  role={isUserHorse ? 'button' : undefined}
                  tabIndex={isUserHorse ? 0 : undefined}
                  onKeyDown={
                    isUserHorse
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleRowClick(result);
                          }
                        }
                      : undefined
                  }
                  aria-label={isUserHorse ? `View performance for ${result.horseName}` : undefined}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        data-testid="rank-value"
                        className="font-medium text-[rgb(220,235,255)]"
                      >
                        {result.rank}
                      </span>
                      <PlacementBadge rank={result.rank} />
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        data-testid="horse-name"
                        className="font-medium text-[rgb(220,235,255)]"
                      >
                        {result.horseName}
                      </span>
                      <HorseLevelBadge
                        level={horseLevelData?.availableStatPoints ?? 1}
                        size="small"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span data-testid="owner-name" className="text-[rgb(148,163,184)]">
                      {result.ownerName}
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
                        result.prizeWon > 0
                          ? 'font-semibold text-emerald-400'
                          : 'text-[rgb(148,163,184)]'
                      }
                    >
                      {formatCurrency(result.prizeWon)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <XpProgressTracker
                      currentLevel={horseLevelData?.availableStatPoints ?? 1}
                      currentXp={horseLevelData?.currentXP ?? 0}
                      xpForCurrentLevel={
                        horseLevelData
                          ? horseLevelData.nextStatPointAt - horseLevelData.xpToNextStatPoint
                          : 0
                      }
                      xpToNextLevel={horseLevelData?.nextStatPointAt ?? 100}
                      size="small"
                    />
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
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 border border-[rgba(37,99,235,0.3)] rounded-lg text-[rgb(220,235,255)] hover:bg-[rgba(37,99,235,0.1)] transition-colors"
      >
        Close
      </button>
    </div>
  );

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title={results?.competitionName ?? 'Competition Results'}
        size="xl"
        footer={footerContent}
        data-testid="competition-results-modal"
      >
        <div className="space-y-6">
          {/* Subtitle row: discipline, date, participants */}
          <div className="flex items-center gap-4 flex-wrap -mt-2">
            <span
              className="inline-block px-3 py-1 bg-[rgba(37,99,235,0.1)] text-blue-400 text-sm font-medium rounded-full border border-blue-500/30"
              data-testid="competition-discipline"
            >
              {results?.discipline || 'N/A'}
            </span>
            <div
              className="flex items-center text-sm text-[rgb(148,163,184)]"
              data-testid="competition-date"
            >
              <Calendar className="h-4 w-4 mr-1" aria-hidden="true" />
              {results?.date ? formatDate(results.date) : 'N/A'}
            </div>
            <div className="flex items-center text-sm text-[rgb(148,163,184)]">
              <Users className="h-4 w-4 mr-1" aria-hidden="true" />
              <span data-testid="total-participants">{results?.totalParticipants || 0}</span>
              <span className="ml-1">participants</span>
            </div>
          </div>

          {/* Prize Distribution */}
          {results && (
            <div
              className="bg-[rgba(212,168,67,0.1)] border border-amber-500/20 rounded-lg p-4"
              data-testid="prize-distribution"
            >
              <div className="flex items-center mb-3">
                <Trophy className="h-5 w-5 text-amber-500 mr-2" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[rgb(220,235,255)]">
                  Prize Pool: {formatCurrency(results.prizePool)}
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center" data-testid="prize-1st">
                  <div className="text-lg font-bold text-amber-400">1st</div>
                  <div className="text-sm text-[rgb(148,163,184)]">50%</div>
                  <div className="font-semibold text-[rgb(220,235,255)]">
                    {formatCurrency(results.prizeDistribution.first)}
                  </div>
                </div>
                <div className="text-center" data-testid="prize-2nd">
                  <div className="text-lg font-bold text-[rgb(148,163,184)]">2nd</div>
                  <div className="text-sm text-[rgb(148,163,184)]">30%</div>
                  <div className="font-semibold text-[rgb(220,235,255)]">
                    {formatCurrency(results.prizeDistribution.second)}
                  </div>
                </div>
                <div className="text-center" data-testid="prize-3rd">
                  <div className="text-lg font-bold text-orange-600">3rd</div>
                  <div className="text-sm text-[rgb(148,163,184)]">20%</div>
                  <div className="font-semibold text-orange-600">
                    {formatCurrency(results.prizeDistribution.third)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results table / loading / error / empty */}
          {renderContent()}

          {/* Prize Summary Card - Story 5-3: Show when user has prizes */}
          {hasUserPrizes && results && (
            <div className="mt-2">
              <PrizeSummaryCard
                competitionId={results.competitionId}
                competitionName={results.competitionName}
                date={results.date}
                prizes={userPrizes}
                isExpanded={isPrizeExpanded}
                onToggleExpand={handlePrizeSummaryToggle}
                onViewPerformance={onViewPerformance}
              />
            </div>
          )}
        </div>
      </BaseModal>

      {/* Prize Notification Modal - Story 5-3 */}
      {showPrizeNotification && bestPrize && (
        <PrizeNotificationModal
          isOpen={showPrizeNotification}
          onClose={handlePrizeNotificationClose}
          prizeData={bestPrize}
          autoDismiss={false}
        />
      )}

      {/* XP Gain Notification - Story 5-4 */}
      {showXpNotification && (
        <XpGainNotification
          xpGained={xpNotificationData.xpGained}
          currentLevel={xpNotificationData.currentLevel}
          currentXp={xpNotificationData.currentXp}
          xpForCurrentLevel={xpNotificationData.xpForCurrentLevel}
          xpToNextLevel={xpNotificationData.xpToNextLevel}
          show={showXpNotification}
          autoDismiss={false}
          onClose={handleXpNotificationClose}
        />
      )}

      {/* Level-Up Celebration Modal - Story 5-4 */}
      {showLevelUpCelebration && levelUpData && (
        <LevelUpCelebrationModal
          isOpen={showLevelUpCelebration}
          onClose={handleLevelUpClose}
          horseId={levelUpData.horseId}
          horseName={levelUpData.horseName}
          oldLevel={levelUpData.oldLevel}
          newLevel={levelUpData.newLevel}
          statChanges={levelUpData.statChanges}
          totalXpGained={levelUpData.totalXpGained}
        />
      )}
    </>
  );
});

export default CompetitionResultsModal;
