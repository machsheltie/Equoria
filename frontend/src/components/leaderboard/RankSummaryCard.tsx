/**
 * RankSummaryCard Component
 *
 * Displays a summary card for a single leaderboard category showing the
 * user's rank, primary stat, rank change indicator, and achievement badge.
 *
 * Features:
 * - Category label and rank display ("#42 of 1,254")
 * - Primary stat formatted by category (Level, $Money, Win Rate %)
 * - Rank change indicator (green up, red down, gray unchanged)
 * - Achievement badge for top 10 (gold) and top 100 (silver)
 * - Clickable card with hover effect
 * - Loading state with animated skeleton pulses
 * - Keyboard accessible (Enter/Space to activate)
 * - Custom className support
 *
 * Story 5-5: Leaderboards - Task 3
 */

import { TrendingUp, TrendingDown, Minus, Award } from 'lucide-react';

/**
 * Represents a user's ranking in a single leaderboard category.
 */
export interface CategoryRanking {
  category: string;
  categoryLabel: string;
  rank: number;
  totalEntries: number;
  rankChange: number;
  primaryStat: number;
  statLabel: string;
}

/**
 * Props for the RankSummaryCard component.
 */
export interface RankSummaryCardProps {
  ranking: CategoryRanking;
  onClick?: () => void;
  isClickable?: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * Formats the primary stat value based on the category type.
 * - prize-money: "$125,340"
 * - win-rate: "82.5%"
 * - default: "Level 15"
 */
const formatStat = (ranking: CategoryRanking): string => {
  const { category, primaryStat, statLabel } = ranking;

  if (category === 'prize-money') {
    return `$${primaryStat.toLocaleString()}`;
  }
  if (category === 'win-rate') {
    return `${primaryStat}%`;
  }
  return `${statLabel} ${primaryStat}`;
};

/**
 * Determines the achievement tier based on rank.
 * Returns null if rank does not qualify for any achievement.
 */
const getAchievement = (rank: number): string | null => {
  if (rank <= 10) return 'Top 10';
  if (rank <= 100) return 'Top 100';
  return null;
};

/**
 * Renders the rank change indicator badge showing position movement.
 */
const RankChangeIndicator = ({ rankChange }: { rankChange: number }) => {
  if (rankChange > 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(16,185,129,0.1)] text-emerald-400"
        data-testid="rank-change-indicator"
      >
        <TrendingUp size={12} aria-hidden="true" />
        <span>+{rankChange}</span>
      </span>
    );
  }

  if (rankChange < 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(239,68,68,0.1)] text-red-400"
        data-testid="rank-change-indicator"
      >
        <TrendingDown size={12} aria-hidden="true" />
        <span>{rankChange}</span>
      </span>
    );
  }

  // rankChange === 0
  return (
    <span
      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(15,35,70,0.5)] text-[rgb(148,163,184)]"
      data-testid="rank-change-indicator"
    >
      <Minus size={12} aria-hidden="true" />
      <span>{'\u2014'}</span>
    </span>
  );
};

/**
 * Loading skeleton placeholder for the RankSummaryCard.
 */
const SkeletonCard = ({ className = '' }: { className?: string }) => (
  <div
    className={`glass-panel rounded-lg p-4 animate-pulse ${className}`}
    data-testid="rank-summary-card-skeleton"
  >
    <div className="h-5 bg-[rgba(15,35,70,0.5)] rounded w-2/3 mb-3" data-testid="skeleton-pulse" />
    <div className="h-8 bg-[rgba(15,35,70,0.5)] rounded w-1/2 mb-2" data-testid="skeleton-pulse" />
    <div className="h-4 bg-[rgba(15,35,70,0.5)] rounded w-1/3 mb-3" data-testid="skeleton-pulse" />
    <div className="h-4 bg-[rgba(15,35,70,0.5)] rounded w-1/4" data-testid="skeleton-pulse" />
  </div>
);

/**
 * RankSummaryCard displays a compact summary of the user's ranking in a
 * single leaderboard category. Supports click interaction, loading state,
 * achievement badges, and full keyboard accessibility.
 */
const RankSummaryCard = ({
  ranking,
  onClick,
  isClickable = false,
  isLoading = false,
  className = '',
}: RankSummaryCardProps) => {
  // Render loading skeleton when isLoading is true
  if (isLoading) {
    return <SkeletonCard className={className} />;
  }

  const achievement = getAchievement(ranking.rank);
  const isGoldAchievement = ranking.rank <= 10;

  const handleClick = () => {
    if (isClickable && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isClickable && onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`glass-panel rounded-lg p-4 transition-all ${
        isClickable ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''
      } ${className}`}
      data-testid="rank-summary-card"
      aria-label={`${ranking.categoryLabel} ranking: #${ranking.rank}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? 'button' : undefined}
    >
      {/* Header: Category Label and Rank Change */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-[rgb(220,235,255)]">{ranking.categoryLabel}</h3>
        <RankChangeIndicator rankChange={ranking.rankChange} />
      </div>

      {/* Rank Display */}
      <div className="text-center my-3">
        <span className="text-2xl font-extrabold text-[rgb(220,235,255)]">#{ranking.rank}</span>
        <span className="text-sm text-[rgb(148,163,184)] ml-1">
          of {ranking.totalEntries.toLocaleString()}
        </span>
      </div>

      {/* Primary Stat */}
      <div className="text-center text-sm font-medium text-blue-400 mb-2">
        {formatStat(ranking)}
      </div>

      {/* Achievement Badge */}
      {achievement && (
        <div
          className={`flex items-center justify-center gap-1 mt-2 px-2 py-1 rounded-full text-xs font-semibold ${
            isGoldAchievement
              ? 'bg-[rgba(212,168,67,0.1)] text-yellow-400'
              : 'bg-[rgba(15,35,70,0.5)] text-[rgb(148,163,184)]'
          }`}
          data-testid="achievement-badge"
        >
          <Award size={12} aria-hidden="true" />
          <span>{achievement}</span>
        </div>
      )}
    </div>
  );
};

export default RankSummaryCard;
