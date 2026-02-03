/**
 * LeaderboardEntry Component
 *
 * Displays a single leaderboard entry row with rank badge, horse/owner name,
 * primary stat, secondary stats, rank change indicator, and current user
 * highlighting.
 *
 * Features:
 * - RankBadge integration for visual rank display
 * - Current user highlighting (light blue background, blue border)
 * - Rank change indicators (green up, red down, gray unchanged)
 * - Category-specific secondary stat display
 * - Clickable rows with hover effect
 * - Accessible row role and keyboard interaction
 *
 * Story 5-5: Leaderboards - Task 2
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import RankBadge from './RankBadge';
import type { LeaderboardCategory } from './LeaderboardCategorySelector';

/**
 * Data shape for a single leaderboard entry, matching the backend API response.
 */
export interface LeaderboardEntryData {
  rank: number;
  horseId?: number;
  horseName?: string;
  ownerId: string;
  ownerName: string;
  primaryStat: number;
  secondaryStats: {
    level?: number;
    totalCompetitions?: number;
    wins?: number;
    winRate?: number;
    totalPrizeMoney?: number;
  };
  isCurrentUser: boolean;
  rankChange?: number;
}

/**
 * Props for the LeaderboardEntry component.
 */
export interface LeaderboardEntryProps {
  entry: LeaderboardEntryData;
  category: LeaderboardCategory;
  onClick?: () => void;
  isClickable?: boolean;
}

/**
 * Renders the rank change indicator showing position movement.
 */
const RankChangeIndicator = ({ rankChange }: { rankChange?: number }) => {
  if (rankChange === undefined || rankChange === null) {
    return null;
  }

  if (rankChange > 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-sm"
        style={{ color: '#10B981' }}
        data-testid="rank-change"
      >
        <TrendingUp size={14} aria-hidden="true" />
        <span>+{rankChange}</span>
      </span>
    );
  }

  if (rankChange < 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-sm"
        style={{ color: '#EF4444' }}
        data-testid="rank-change"
      >
        <TrendingDown size={14} aria-hidden="true" />
        <span>{rankChange}</span>
      </span>
    );
  }

  // rankChange === 0
  return (
    <span
      className="inline-flex items-center gap-0.5 text-sm"
      style={{ color: '#6B7280' }}
      data-testid="rank-change"
    >
      <Minus size={14} aria-hidden="true" />
      <span>{'\u2014'}</span>
    </span>
  );
};

/**
 * Formats the primary stat value based on the leaderboard category.
 */
const formatPrimaryStat = (value: number, category: LeaderboardCategory): string => {
  if (category === 'win-rate') {
    return `${value}%`;
  }
  if (category === 'prize-money') {
    return `$${value.toLocaleString()}`;
  }
  return String(value);
};

/**
 * Renders category-specific secondary stats.
 */
const SecondaryStats = ({
  stats,
  category,
}: {
  stats: LeaderboardEntryData['secondaryStats'];
  category: LeaderboardCategory;
}) => {
  switch (category) {
    case 'level':
      return (
        <div className="flex gap-4 text-sm text-gray-600">
          {stats.winRate !== undefined && (
            <span data-testid="secondary-stat-win-rate">WR: {stats.winRate}%</span>
          )}
          {stats.totalCompetitions !== undefined && (
            <span data-testid="secondary-stat-competitions">
              Comps: {stats.totalCompetitions}
            </span>
          )}
        </div>
      );
    case 'prize-money':
      return (
        <div className="flex gap-4 text-sm text-gray-600">
          {stats.wins !== undefined && (
            <span data-testid="secondary-stat-wins">Wins: {stats.wins}</span>
          )}
          {stats.totalCompetitions !== undefined && (
            <span data-testid="secondary-stat-competitions">
              Comps: {stats.totalCompetitions}
            </span>
          )}
        </div>
      );
    case 'win-rate':
      return (
        <div className="flex gap-4 text-sm text-gray-600">
          {stats.wins !== undefined && (
            <span data-testid="secondary-stat-wins">Wins: {stats.wins}</span>
          )}
          {stats.totalCompetitions !== undefined && (
            <span data-testid="secondary-stat-competitions">
              Races: {stats.totalCompetitions}
            </span>
          )}
        </div>
      );
    case 'discipline':
      return (
        <div className="flex gap-4 text-sm text-gray-600">
          {stats.level !== undefined && (
            <span data-testid="secondary-stat-level">Lvl: {stats.level}</span>
          )}
          {stats.totalCompetitions !== undefined && (
            <span data-testid="secondary-stat-competitions">
              Comps: {stats.totalCompetitions}
            </span>
          )}
        </div>
      );
    case 'owner':
      return (
        <div className="flex gap-4 text-sm text-gray-600">
          {stats.totalPrizeMoney !== undefined && (
            <span data-testid="secondary-stat-prize-money">
              Prize: ${stats.totalPrizeMoney.toLocaleString()}
            </span>
          )}
          {stats.totalCompetitions !== undefined && (
            <span data-testid="secondary-stat-competitions">
              Comps: {stats.totalCompetitions}
            </span>
          )}
        </div>
      );
    case 'recent-winners':
      return (
        <div className="flex gap-4 text-sm text-gray-600">
          {stats.totalPrizeMoney !== undefined && (
            <span data-testid="secondary-stat-prize-money">
              Won: ${stats.totalPrizeMoney.toLocaleString()}
            </span>
          )}
        </div>
      );
    default:
      return null;
  }
};

/**
 * LeaderboardEntry displays a single row in the leaderboard table.
 * It includes a rank badge, horse/owner information, stats, rank change
 * indicator, and supports click handling and current user highlighting.
 */
const LeaderboardEntryComponent = ({
  entry,
  category,
  onClick,
  isClickable = false,
}: LeaderboardEntryProps) => {
  const rowStyle: React.CSSProperties = entry.isCurrentUser
    ? { backgroundColor: '#DBEAFE', border: '2px solid #3B82F6' }
    : {};

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
      className={`flex items-center gap-4 px-4 py-3 rounded-lg ${
        isClickable ? 'cursor-pointer hover:bg-gray-50' : ''
      } ${entry.isCurrentUser ? 'font-semibold' : ''}`}
      style={rowStyle}
      data-testid="leaderboard-entry"
      role="row"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isClickable ? 0 : undefined}
    >
      {/* Rank Badge */}
      <div className="flex-shrink-0">
        <RankBadge rank={entry.rank} size="medium" />
      </div>

      {/* Rank Change */}
      <div className="flex-shrink-0 w-12">
        <RankChangeIndicator rankChange={entry.rankChange} />
      </div>

      {/* Horse/Owner Name */}
      <div className="flex-1 min-w-0">
        {entry.horseName && (
          <div className="truncate font-medium text-gray-900">{entry.horseName}</div>
        )}
        <div className="truncate text-sm text-gray-500">{entry.ownerName}</div>
      </div>

      {/* Primary Stat */}
      <div className="flex-shrink-0 text-right" data-testid="primary-stat">
        <span className="text-lg font-bold text-gray-900">
          {formatPrimaryStat(entry.primaryStat, category)}
        </span>
      </div>

      {/* Secondary Stats */}
      <div className="hidden md:block flex-shrink-0 w-40 text-right">
        <SecondaryStats stats={entry.secondaryStats} category={category} />
      </div>
    </div>
  );
};

export default LeaderboardEntryComponent;
