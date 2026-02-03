/**
 * UserRankDashboard Component
 *
 * Displays a comprehensive dashboard of the user's rankings across all
 * leaderboard categories with summary cards and a "Best Rankings" section.
 *
 * Features:
 * - User name header with Trophy icon
 * - Grid of RankSummaryCards (one per category)
 * - "Your Rankings" section header
 * - "Best Rankings" section showing top achievements with Star icon
 * - Empty state for new players with no rankings
 * - Loading state showing skeleton cards
 * - Responsive grid: 3 columns desktop, 2 tablet, 1 mobile
 * - Category click propagation to parent via onCategoryClick
 * - Full ARIA accessibility
 *
 * Story 5-5: Leaderboards - Task 3
 */

import { Trophy, Star } from 'lucide-react';
import RankSummaryCard from './RankSummaryCard';
import type { CategoryRanking as RankSummaryCardCategoryRanking } from './RankSummaryCard';

/**
 * Re-export CategoryRanking from RankSummaryCard for external use.
 */
export type CategoryRanking = RankSummaryCardCategoryRanking;

/**
 * Represents a user's best ranking achievement in a category.
 */
export interface BestRanking {
  category: string;
  categoryLabel: string;
  rank: number;
  achievement: string;
}

/**
 * Props for the UserRankDashboard component.
 */
export interface UserRankDashboardProps {
  userId: string;
  userName: string;
  rankings: CategoryRanking[];
  bestRankings: BestRanking[];
  isLoading?: boolean;
  onCategoryClick?: (_category: string) => void;
  className?: string;
}

/**
 * Number of skeleton cards to display during loading state.
 */
const SKELETON_CARD_COUNT = 6;

/**
 * Loading skeleton for the entire dashboard.
 */
const DashboardSkeleton = () => (
  <div
    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    data-testid="rankings-grid-skeleton"
  >
    {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
      <RankSummaryCard
        key={`skeleton-${i}`}
        ranking={null as unknown as CategoryRanking}
        isLoading={true}
      />
    ))}
  </div>
);

/**
 * Empty state component shown when a user has no rankings.
 */
const EmptyRankingsState = () => (
  <div
    className="flex flex-col items-center justify-center py-12 text-gray-500"
    data-testid="empty-rankings-state"
  >
    <Trophy size={48} className="mb-4 text-gray-300" aria-hidden="true" />
    <p className="text-lg font-medium">No rankings yet</p>
    <p className="text-sm mt-1">
      Compete in shows and train your horses to appear on the leaderboards.
    </p>
  </div>
);

/**
 * Renders a single best ranking achievement row.
 */
const BestRankingItem = ({ bestRanking }: { bestRanking: BestRanking }) => (
  <div className="flex items-center gap-3 py-2">
    <Star size={16} className="text-yellow-500 flex-shrink-0" aria-hidden="true" />
    <span className="text-sm text-gray-700">
      {bestRanking.achievement} in {bestRanking.categoryLabel}
    </span>
    <span className="text-xs text-gray-400 ml-auto">#{bestRanking.rank}</span>
  </div>
);

/**
 * UserRankDashboard displays all of a user's leaderboard rankings in a
 * responsive grid of RankSummaryCards plus a "Best Rankings" achievements
 * section. Supports loading, empty, and interactive states.
 */
const UserRankDashboard = ({
  userId: _userId,
  userName,
  rankings,
  bestRankings,
  isLoading = false,
  onCategoryClick,
  className = '',
}: UserRankDashboardProps) => {
  const isClickable = Boolean(onCategoryClick);

  return (
    <div
      className={`space-y-6 ${className}`}
      data-testid="user-rank-dashboard"
      aria-label={`${userName}'s leaderboard rankings`}
    >
      {/* Dashboard Header */}
      <div className="flex items-center gap-3">
        <Trophy
          size={28}
          className="text-yellow-500"
          data-testid="dashboard-header-icon"
          aria-hidden="true"
        />
        <h2 className="text-xl font-bold text-gray-900">{userName}&apos;s Rankings</h2>
      </div>

      {/* Loading State */}
      {isLoading && <DashboardSkeleton />}

      {/* Empty State */}
      {!isLoading && rankings.length === 0 && <EmptyRankingsState />}

      {/* Rankings Grid */}
      {!isLoading && rankings.length > 0 && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="rankings-grid"
        >
          {rankings.map((ranking) => (
            <RankSummaryCard
              key={ranking.category}
              ranking={ranking}
              isClickable={isClickable}
              onClick={
                onCategoryClick ? () => onCategoryClick(ranking.category) : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Best Rankings Section */}
      {!isLoading && (
        <div data-testid="best-rankings-section">
          <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Star size={20} className="text-yellow-500" aria-hidden="true" />
            Best Rankings
          </h3>

          {bestRankings.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">No achievements yet</p>
          ) : (
            <div className="bg-white rounded-lg shadow p-4 divide-y divide-gray-100">
              {bestRankings.map((best) => (
                <BestRankingItem key={best.category} bestRanking={best} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserRankDashboard;
