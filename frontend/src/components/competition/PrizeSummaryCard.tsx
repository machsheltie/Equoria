/**
 * PrizeSummaryCard Component
 *
 * Displays a compact summary of prizes won in a competition.
 * Features:
 * - Color-coded card based on best placement (gold/silver/bronze/default)
 * - Summary view with total prize money, XP, placed horses, best placement
 * - Expandable details showing per-horse breakdown
 * - Trophy/medal icons for visual placement indicators
 * - Smooth expand/collapse animation
 *
 * Story 5-3: Competition History - Prize Summary
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Trophy,
  Medal,
  Star,
  DollarSign,
  Zap,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react';

/**
 * Individual horse prize data structure
 */
export interface HorsePrize {
  horseId: number;
  horseName: string;
  placement: number;
  prizeMoney: number;
  xpGained: number;
}

/**
 * PrizeSummaryCard component props
 */
export interface PrizeSummaryCardProps {
  competitionId: number;
  competitionName: string;
  date: string;
  prizes: HorsePrize[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onViewPerformance?: (_horseId: number) => void;
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
 * Format number with thousands separator
 */
const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
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
 * Get ordinal suffix for a number
 */
const getOrdinalSuffix = (n: number): string => {
  if (n === 0) return '-';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * Get card styling based on best placement
 */
const getCardClasses = (bestPlacement: number): string => {
  switch (bestPlacement) {
    case 1:
      return 'bg-[rgba(212,168,67,0.1)] border-burnished-gold/50'; // Gold
    case 2:
      return 'bg-[rgba(148,163,184,0.1)] border-[rgba(148,163,184,0.4)]'; // Silver
    case 3:
      return 'bg-[rgba(180,83,9,0.1)] border-orange-500/40'; // Bronze
    default:
      return 'bg-[rgba(37,99,235,0.1)] border-[rgba(37,99,235,0.3)]'; // Default/Participation
  }
};

/**
 * Placement icon component based on rank
 */
const PlacementIcon = memo(({ rank }: { rank: number }) => {
  if (rank === 1) {
    return (
      <Trophy className="h-4 w-4 text-yellow-600" aria-hidden="true" data-testid="trophy-icon" />
    );
  }
  if (rank === 2 || rank === 3) {
    return (
      <Medal
        className="h-4 w-4 text-[rgb(148,163,184)]"
        aria-hidden="true"
        data-testid="medal-icon"
      />
    );
  }
  return <Star className="h-4 w-4 text-blue-500" aria-hidden="true" />;
});

PlacementIcon.displayName = 'PlacementIcon';

/**
 * Horse prize entry component for expanded view
 */
const HorsePrizeEntry = memo(({ prize, onClick }: { prize: HorsePrize; onClick?: () => void }) => {
  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick?.();
      }
    },
    [onClick]
  );

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg bg-[rgba(15,35,70,0.4)] border border-[rgba(37,99,235,0.2)] ${
        onClick
          ? 'cursor-pointer hover:bg-[rgba(37,99,235,0.1)] focus:outline-none focus:ring-2 focus:ring-blue-500'
          : ''
      }`}
      data-testid="horse-prize-entry"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      aria-label={onClick ? `View performance for ${prize.horseName}` : undefined}
    >
      {/* Left side: Horse info */}
      <div className="flex items-center gap-3">
        <PlacementIcon rank={prize.placement} />
        <div>
          <p className="text-sm font-semibold text-[rgb(220,235,255)]">{prize.horseName}</p>
          <p className="text-xs text-[rgb(148,163,184)]">
            {getOrdinalSuffix(prize.placement)} Place
          </p>
        </div>
      </div>

      {/* Right side: Prize and XP */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-green-500" aria-hidden="true" />
          <span className="font-medium text-[rgb(220,235,255)]">
            {formatCurrency(prize.prizeMoney)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-purple-400" aria-hidden="true" />
          <span className="font-medium text-[rgb(220,235,255)]">
            {formatNumber(prize.xpGained)}
          </span>
        </div>
      </div>
    </div>
  );
});

HorsePrizeEntry.displayName = 'HorsePrizeEntry';

/**
 * PrizeSummaryCard Component
 *
 * Displays a compact summary of prizes won in a competition with
 * expandable details for per-horse breakdown.
 */
const PrizeSummaryCard: React.FC<PrizeSummaryCardProps> = ({
  competitionId: _competitionId,
  competitionName,
  date,
  prizes,
  isExpanded: controlledExpanded,
  onToggleExpand,
  onViewPerformance,
  className = '',
}) => {
  // Internal state for uncontrolled mode
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Determine if controlled or uncontrolled
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  // Calculate totals and best placement
  const { totalPrizeMoney, totalXp, placedCount, bestPlacement } = useMemo(() => {
    if (prizes.length === 0) {
      return {
        totalPrizeMoney: 0,
        totalXp: 0,
        placedCount: 0,
        bestPlacement: 0,
      };
    }

    const total = prizes.reduce(
      (acc, prize) => ({
        prizeMoney: acc.prizeMoney + prize.prizeMoney,
        xp: acc.xp + prize.xpGained,
      }),
      { prizeMoney: 0, xp: 0 }
    );

    // Count horses that placed (1st, 2nd, or 3rd)
    const placed = prizes.filter((p) => p.placement <= 3).length;

    // Find best (lowest) placement
    const best = Math.min(...prizes.map((p) => p.placement));

    return {
      totalPrizeMoney: total.prizeMoney,
      totalXp: total.xp,
      placedCount: placed,
      bestPlacement: best,
    };
  }, [prizes]);

  // Handle toggle click
  const handleToggle = useCallback(() => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  }, [onToggleExpand]);

  // Handle horse click for performance view
  const handleViewPerformance = useCallback(
    (horseId: number) => {
      onViewPerformance?.(horseId);
    },
    [onViewPerformance]
  );

  // Get card styling based on best placement
  const cardClasses = getCardClasses(bestPlacement);

  // Sort prizes by placement (best first)
  const sortedPrizes = useMemo(() => {
    return [...prizes].sort((a, b) => a.placement - b.placement);
  }, [prizes]);

  return (
    <div
      className={`rounded-lg border-2 shadow-sm overflow-hidden transition-all duration-200 ${cardClasses} ${className}`}
      data-testid="prize-summary-card"
      role="region"
      aria-label="Prize summary"
    >
      {/* Header Section */}
      <div className="p-4">
        {/* Competition Info Row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-[rgb(220,235,255)]">{competitionName}</h3>
            <div className="flex items-center gap-1 text-sm text-[rgb(148,163,184)] mt-1">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <span>{formatDate(date)}</span>
            </div>
          </div>

          {/* Best Placement Badge */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-[rgba(15,35,70,0.5)] border border-[rgba(37,99,235,0.3)]"
            data-testid="best-placement"
          >
            <PlacementIcon rank={bestPlacement} />
            <span className="text-sm font-semibold text-[rgb(220,235,255)]">
              {bestPlacement > 0 ? `Best: ${getOrdinalSuffix(bestPlacement)}` : '-'}
            </span>
          </div>
        </div>

        {/* Summary Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-3">
          {/* Total Prize Money */}
          <div className="text-center p-2 rounded-lg bg-[rgba(15,35,70,0.4)]">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <span className="text-xs text-[rgb(148,163,184)]">Prize</span>
            </div>
            <p
              className="text-lg font-bold text-[rgb(220,235,255)]"
              data-testid="total-prize-money"
            >
              {formatCurrency(totalPrizeMoney)}
            </p>
          </div>

          {/* Total XP */}
          <div className="text-center p-2 rounded-lg bg-[rgba(15,35,70,0.4)]">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap className="h-4 w-4 text-purple-400" aria-hidden="true" />
              <span className="text-xs text-[rgb(148,163,184)]">XP</span>
            </div>
            <p className="text-lg font-bold text-[rgb(220,235,255)]" data-testid="total-xp">
              {formatNumber(totalXp)}
            </p>
          </div>

          {/* Placed Horses Count */}
          <div className="text-center p-2 rounded-lg bg-[rgba(15,35,70,0.4)]">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Trophy className="h-4 w-4 text-yellow-500" aria-hidden="true" />
              <span className="text-xs text-[rgb(148,163,184)]">Placed</span>
            </div>
            <p className="text-lg font-bold text-[rgb(220,235,255)]" data-testid="placed-count">
              {placedCount}
            </p>
          </div>
        </div>

        {/* Expand/Collapse Toggle */}
        <button
          onClick={handleToggle}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-[rgb(148,163,184)] hover:text-[rgb(220,235,255)] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
          data-testid="expand-toggle"
          aria-label={isExpanded ? 'Collapse horse details' : 'Expand horse details'}
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" data-testid="chevron-up-icon" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" data-testid="chevron-down-icon" />
          )}
        </button>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div
          className="border-t border-[rgba(37,99,235,0.2)] p-4 space-y-2"
          data-testid="horse-breakdown-list"
        >
          <p className="text-sm font-semibold text-[rgb(220,235,255)] mb-3">Horse Breakdown</p>
          {sortedPrizes.map((prize) => (
            <HorsePrizeEntry
              key={prize.horseId}
              prize={prize}
              onClick={onViewPerformance ? () => handleViewPerformance(prize.horseId) : undefined}
            />
          ))}
          {prizes.length === 0 && (
            <p className="text-sm text-[rgb(148,163,184)] text-center py-4">
              No horses participated
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(PrizeSummaryCard);
