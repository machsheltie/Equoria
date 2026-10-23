/**
 * PrizeSummaryCard Component
 *
 * Displays a compact summary of prizes won in a competition.
 * Features:
 * - Color-coded card based on best placement (gold/silver/bronze/default)
 * - Summary view with total prize money, placed horses, best placement
 * - Expandable details showing per-horse breakdown
 * - Trophy/medal icons for visual placement indicators
 * - Smooth expand/collapse animation
 *
 * Story 5-3: Competition History - Prize Summary
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { Trophy, Medal, Star, Coins, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import Currency from '@/components/ui/Currency';
import { sumHorsePoints } from '@/lib/api/competitionResults';

/**
 * Individual horse prize data structure
 */
export interface HorsePrize {
  horseId: number;
  horseName: string;
  placement: number;
  prizeMoney: number;
  /**
   * Horse Points the placing recorded at settlement (Equoria-m3yq1); null or
   * absent when none was recorded, which makes the card's total unknown.
   */
  horsePointsAwarded?: number | null;
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
  className?: string;
}

// Equoria-2dnd2: date formatting + honest invalid-date fallback now live in the
// shared util (was a duplicated, unguarded component-local formatDate).
import { formatDate } from '@/lib/formatDate';

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
      return 'bg-[var(--alpha-gold-primary-10)] border-[var(--alpha-gold-primary-50)]'; // Gold
    case 2:
      return 'bg-slate-400/10 border-slate-400/40'; // Silver
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
    return <Medal className="h-4 w-4 text-slate-400" aria-hidden="true" data-testid="medal-icon" />;
  }
  return <Star className="h-4 w-4 text-blue-500" aria-hidden="true" />;
});

PlacementIcon.displayName = 'PlacementIcon';

/**
 * Horse prize entry component for expanded view
 */
// Owner ruling R5 (2026-10-15, Equoria-q4uem.10): no score breakdown, so an
// entry is a plain row; the "view performance" action was deleted.
const HorsePrizeEntry = memo(({ prize }: { prize: HorsePrize }) => {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg bg-[rgba(15,35,70,0.4)] border border-[rgba(37,99,235,0.2)]"
      data-testid="horse-prize-entry"
    >
      {/* Left side: Horse info */}
      <div className="flex items-center gap-3">
        <PlacementIcon rank={prize.placement} />
        <div>
          <p className="text-sm font-semibold text-[rgb(220,235,255)]">{prize.horseName}</p>
          <p className="text-xs text-slate-400">{getOrdinalSuffix(prize.placement)} Place</p>
        </div>
      </div>

      {/* Right side: Prize */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <Coins className="h-3 w-3 text-green-500" aria-hidden="true" />
          <span className="font-medium text-[rgb(220,235,255)]">
            <Currency amount={prize.prizeMoney} showIcon={false} />
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
  className = '',
}) => {
  // Internal state for uncontrolled mode
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Determine if controlled or uncontrolled
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  // Calculate totals and best placement
  const { totalPrizeMoney, placedCount, bestPlacement } = useMemo(() => {
    if (prizes.length === 0) {
      return {
        totalPrizeMoney: 0,
        placedCount: 0,
        bestPlacement: 0,
      };
    }

    const totalPrize = prizes.reduce((sum, prize) => sum + prize.prizeMoney, 0);

    // Count horses that placed (1st, 2nd, or 3rd)
    const placed = prizes.filter((p) => p.placement <= 3).length;

    // Find best (lowest) placement
    const best = Math.min(...prizes.map((p) => p.placement));

    return {
      totalPrizeMoney: totalPrize,
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

  // Owner ruling 2026-10-23 (Equoria-m3yq1): the third tile is the Horse Points
  // the placings earned — the bible's 10/5/3/1, as recorded at settlement. A
  // placing with none recorded makes the total unknown (an em dash), never a
  // partial sum (owner rulings R6/R7).
  const totalHorsePoints = useMemo(
    () => sumHorsePoints(prizes.map((p) => ({ horsePointsAwarded: p.horsePointsAwarded ?? null }))),
    [prizes]
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
            <div className="flex items-center gap-1 text-sm text-slate-400 mt-1">
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
        {/* Prize, placed, and Horse Points earned (owner ruling 2026-10-23, Equoria-m3yq1). */}
        <div className="grid grid-cols-3 gap-4 mb-3">
          {/* Total Prize Money */}
          <div className="text-center p-2 rounded-lg bg-[rgba(15,35,70,0.4)]">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Coins className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <span className="text-xs text-slate-400">Prize</span>
            </div>
            <p
              className="text-lg font-bold text-[rgb(220,235,255)]"
              data-testid="total-prize-money"
            >
              <Currency amount={totalPrizeMoney} showIcon={false} />
            </p>
          </div>

          {/* Placed Horses Count */}
          <div className="text-center p-2 rounded-lg bg-[rgba(15,35,70,0.4)]">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Trophy className="h-4 w-4 text-yellow-500" aria-hidden="true" />
              <span className="text-xs text-slate-400">Placed</span>
            </div>
            <p className="text-lg font-bold text-[rgb(220,235,255)]" data-testid="placed-count">
              {placedCount}
            </p>
          </div>

          {/* Horse Points earned */}
          <div className="text-center p-2 rounded-lg bg-[rgba(15,35,70,0.4)]">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star className="h-4 w-4 text-[var(--gold-primary)]" aria-hidden="true" />
              <span className="text-xs text-[var(--text-secondary)]">Horse Points</span>
            </div>
            <p
              className="text-lg font-bold text-[rgb(220,235,255)] tabular-nums"
              data-testid="total-horse-points"
            >
              {totalHorsePoints === null ? (
                <span aria-label="Horse Points not recorded">—</span>
              ) : (
                totalHorsePoints
              )}
            </p>
          </div>
        </div>

        {/* Expand/Collapse Toggle */}
        <button
          onClick={handleToggle}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-slate-400 hover:text-[rgb(220,235,255)] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
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
            <HorsePrizeEntry key={prize.horseId} prize={prize} />
          ))}
          {prizes.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No horses participated</p>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(PrizeSummaryCard);
