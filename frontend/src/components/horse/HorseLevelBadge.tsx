/**
 * HorseLevelBadge Component
 *
 * Displays a compact badge showing the horse's level with tier-based
 * color coding. Supports multiple sizes, optional star icon, and
 * tooltip with tier progression information.
 *
 * Tier color coding:
 *   Bronze (1-5): amber tones
 *   Silver (6-10): slate tones
 *   Gold (11-15): yellow tones
 *   Platinum (16-20): cyan tones
 *   Diamond (21+): purple tones
 *
 * Story 5-4: Horse Level Badge - Task 4
 */

import { useState, useMemo, useCallback, memo } from 'react';
import { Star } from 'lucide-react';

/**
 * Tier type definition for level tier classification
 */
type TierType = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

/**
 * Return type for getLevelTier helper function
 */
interface LevelTierResult {
  tier: TierType;
  tierName: string;
  colorClasses: string;
  nextTierLevel?: number;
  nextTierName?: string;
}

/**
 * Props interface for the HorseLevelBadge component
 */
interface HorseLevelBadgeProps {
  level: number;
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
  showIcon?: boolean;
  iconPosition?: 'left' | 'right';
  className?: string;
}

/**
 * Calculates the level tier based on the horse level.
 * Returns tier classification, display name, CSS color classes,
 * and information about the next tier threshold.
 *
 * @param level - The horse's current level number
 * @returns LevelTierResult with tier info and color classes
 */
export function getLevelTier(level: number): LevelTierResult {
  if (level >= 21) {
    return {
      tier: 'diamond',
      tierName: 'Diamond',
      colorClasses: 'bg-purple-500 text-purple-100 border-purple-600',
    };
  }
  if (level >= 16) {
    return {
      tier: 'platinum',
      tierName: 'Platinum',
      colorClasses: 'bg-cyan-400 text-cyan-900 border-cyan-500',
      nextTierLevel: 21,
      nextTierName: 'Diamond',
    };
  }
  if (level >= 11) {
    return {
      tier: 'gold',
      tierName: 'Gold',
      colorClasses: 'bg-yellow-500 text-yellow-900 border-yellow-600',
      nextTierLevel: 16,
      nextTierName: 'Platinum',
    };
  }
  if (level >= 6) {
    return {
      tier: 'silver',
      tierName: 'Silver',
      colorClasses: 'bg-slate-400 text-slate-900 border-slate-500',
      nextTierLevel: 11,
      nextTierName: 'Gold',
    };
  }
  return {
    tier: 'bronze',
    tierName: 'Bronze',
    colorClasses: 'bg-amber-700 text-amber-100 border-amber-600',
    nextTierLevel: 6,
    nextTierName: 'Silver',
  };
}

/**
 * Size configuration map for badge dimensions and text sizing
 */
const sizeClasses: Record<string, string> = {
  small: 'h-5 text-xs px-1.5',
  medium: 'h-6 text-sm px-2',
  large: 'h-8 text-base px-3',
};

/**
 * Icon size configuration matching badge size variants
 */
const iconSizes: Record<string, number> = {
  small: 12,
  medium: 14,
  large: 18,
};

/**
 * HorseLevelBadge - A compact badge displaying horse level with tier coloring.
 *
 * Features:
 * - Tier-based color coding (Bronze, Silver, Gold, Platinum, Diamond)
 * - Three size variants (small, medium, large)
 * - Optional star icon with configurable position
 * - Tooltip showing tier name and next tier threshold
 * - WCAG 2.1 AA accessible with ARIA labels and keyboard support
 */
const HorseLevelBadge = memo(function HorseLevelBadge({
  level,
  size = 'medium',
  showTooltip = false,
  showIcon = false,
  iconPosition = 'left',
  className = '',
}: HorseLevelBadgeProps) {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  // Clamp level to minimum of 1 for display purposes
  const displayLevel = useMemo(() => Math.max(1, level), [level]);

  // Calculate tier information based on the display level
  const tierInfo = useMemo(() => getLevelTier(displayLevel), [displayLevel]);

  // Handlers for tooltip visibility
  const handleShowTooltip = useCallback(() => {
    if (showTooltip) {
      setIsTooltipVisible(true);
    }
  }, [showTooltip]);

  const handleHideTooltip = useCallback(() => {
    setIsTooltipVisible(false);
  }, []);

  // Build the icon element when showIcon is enabled
  const iconElement = showIcon ? (
    <Star
      data-testid="level-badge-icon"
      size={iconSizes[size]}
      className="fill-current"
    />
  ) : null;

  // Compose badge content with icon positioning
  const badgeContent = (
    <span data-testid="badge-content" className="flex items-center gap-1">
      {showIcon && iconPosition === 'left' && iconElement}
      <span>{displayLevel}</span>
      {showIcon && iconPosition === 'right' && iconElement}
    </span>
  );

  // Compute the ARIA label for accessibility
  const ariaLabel = `Level ${displayLevel} - ${tierInfo.tierName} tier`;

  return (
    <span
      data-testid="horse-level-badge"
      className={`relative inline-flex items-center justify-center rounded-md border font-semibold ${tierInfo.colorClasses} ${sizeClasses[size]} ${className}`.trim()}
      aria-label={ariaLabel}
      role="status"
      tabIndex={showTooltip ? 0 : undefined}
      onMouseEnter={handleShowTooltip}
      onMouseLeave={handleHideTooltip}
      onFocus={handleShowTooltip}
      onBlur={handleHideTooltip}
    >
      {badgeContent}

      {/* Tooltip overlay showing tier details */}
      {isTooltipVisible && (
        <span
          data-testid="level-tooltip"
          role="tooltip"
          className="absolute left-1/2 top-full z-10 mt-1 w-48 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 text-left text-xs font-normal text-slate-800 shadow-lg"
        >
          <span className="block font-semibold text-slate-900">
            {tierInfo.tierName} Tier
          </span>
          <span className="block text-slate-600">Level {displayLevel}</span>
          {tierInfo.nextTierLevel && tierInfo.nextTierName && (
            <span className="mt-1 block text-slate-500">
              {tierInfo.nextTierLevel - displayLevel} more level
              {tierInfo.nextTierLevel - displayLevel !== 1 ? 's' : ''} to{' '}
              {tierInfo.nextTierName}
            </span>
          )}
        </span>
      )}
    </span>
  );
});

export default HorseLevelBadge;
