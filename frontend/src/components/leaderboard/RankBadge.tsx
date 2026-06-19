/**
 * RankBadge Component
 *
 * Displays a rank number with color-coded styling based on position.
 * Top 3 positions receive special badges with crown/medal icons.
 * Supports small, medium, and large size variants.
 *
 * Color scheme (tokenized — Equoria-o5hub.44):
 * - 1st: --tier-gold with crown icon
 * - 2nd: --tier-silver with medal icon
 * - 3rd: --tier-bronze with medal icon
 * - 4th-10th: --status-info (blue)
 * - 11th+: --text-muted (neutral)
 *
 * Story 5-5: Leaderboards - Task 2
 */

import { Crown, Medal } from 'lucide-react';

/**
 * Props for the RankBadge component.
 */
export interface RankBadgeProps {
  rank: number;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

/**
 * Returns the background color for a given rank.
 */
const getRankColor = (rank: number): string => {
  if (rank === 1) return 'var(--tier-gold)';
  if (rank === 2) return 'var(--tier-silver)';
  if (rank === 3) return 'var(--tier-bronze)';
  if (rank >= 4 && rank <= 10) return 'var(--status-info)';
  return 'var(--text-muted)';
};

/**
 * Icon sizes mapped to badge size variants.
 */
const ICON_SIZES: Record<string, number> = {
  small: 12,
  medium: 16,
  large: 20,
};

/**
 * RankBadge displays a rank number inside a color-coded circular badge.
 * Top 3 positions include a crown (1st) or medal (2nd/3rd) icon.
 */
const RankBadge = ({ rank, size = 'medium', className = '' }: RankBadgeProps) => {
  const backgroundColor = getRankColor(rank);
  const iconSize = ICON_SIZES[size];

  return (
    <span
      className={`rank-badge-${size} inline-flex items-center justify-center rounded-full text-[var(--text-primary)] font-bold ${className}`}
      style={{ backgroundColor }}
      data-testid={`rank-badge-${rank}`}
      aria-label={`Rank ${rank}`}
    >
      {rank === 1 && (
        <Crown
          size={iconSize}
          className="mr-0.5"
          data-testid="rank-icon-crown"
          aria-hidden="true"
        />
      )}
      {(rank === 2 || rank === 3) && (
        <Medal
          size={iconSize}
          className="mr-0.5"
          data-testid="rank-icon-medal"
          aria-hidden="true"
        />
      )}
      <span>{rank}</span>
    </span>
  );
};

export default RankBadge;
