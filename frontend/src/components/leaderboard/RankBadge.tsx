/**
 * RankBadge Component
 *
 * Displays a rank number with color-coded styling based on position.
 * Top 3 positions receive special badges with crown/medal icons.
 * Supports small, medium, and large size variants.
 *
 * Color scheme:
 * - 1st: Gold (#FFD700) with crown icon
 * - 2nd: Silver (#C0C0C0) with medal icon
 * - 3rd: Bronze (#CD7F32) with medal icon
 * - 4th-10th: Blue (#3B82F6)
 * - 11th+: Gray (#6B7280)
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
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  if (rank >= 4 && rank <= 10) return '#3B82F6';
  return '#6B7280';
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
      className={`rank-badge-${size} inline-flex items-center justify-center rounded-full text-white font-bold ${className}`}
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
