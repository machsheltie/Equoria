/**
 * XP Level Display Component
 *
 * Displays user level and XP progress with fantasy-themed styling.
 * Shows level badge, progress bar, and XP text.
 *
 * Story 2.2: XP & Level Display - AC-1 through AC-5
 */

import React from 'react';
import { Star } from 'lucide-react';
import {
  calculateLevel,
  getXPProgress,
  getXPProgressPercent,
  formatXPDisplay,
} from '../lib/xp-utils';

interface XPLevelDisplayProps {
  /** User's total XP (optional, calculates level if not provided) */
  xp?: number;
  /** Override calculated level (optional) */
  level?: number;
  /** Show loading skeleton */
  isLoading?: boolean;
  /** Show the level badge */
  showLevelBadge?: boolean;
  /** Show the XP text (e.g., "50 / 100 XP") */
  showProgressText?: boolean;
  /** Component size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Loading skeleton for the XP display
 */
const XPLoadingSkeleton: React.FC<{ size: 'sm' | 'md' | 'lg' }> = ({ size }) => {
  const sizeClasses = {
    sm: 'h-12',
    md: 'h-16',
    lg: 'h-20',
  };

  return (
    <div
      data-testid="xp-loading-skeleton"
      className={`animate-pulse ${sizeClasses[size]} flex items-center gap-3`}
    >
      {/* Level badge skeleton */}
      <div className="w-10 h-10 rounded-full bg-aged-bronze/30" />
      {/* Progress bar skeleton */}
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-aged-bronze/30 rounded-full" />
        <div className="h-2 w-20 bg-aged-bronze/30 rounded" />
      </div>
    </div>
  );
};

/**
 * XP Level Display Component
 */
const XPLevelDisplay: React.FC<XPLevelDisplayProps> = ({
  xp = 0,
  level,
  isLoading = false,
  showLevelBadge = true,
  showProgressText = true,
  size = 'md',
}) => {
  // Calculate derived values
  const displayLevel = level ?? calculateLevel(xp ?? 0);
  const progressPercent = getXPProgressPercent(xp ?? 0);
  const xpText = formatXPDisplay(xp ?? 0);

  // Size-based styling
  const sizeClasses = {
    sm: 'xp-display-sm gap-2',
    md: 'xp-display-md gap-3',
    lg: 'xp-display-lg gap-4',
  };

  const badgeSizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-2xl',
  };

  const starSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const barHeights = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  // Loading state
  if (isLoading) {
    return <XPLoadingSkeleton size={size} />;
  }

  return (
    <div
      data-testid="xp-level-display"
      className={`flex items-center ${sizeClasses[size]}`}
    >
      {/* Level Badge */}
      {showLevelBadge && (
        <div
          data-testid="level-badge"
          className={`
            flex flex-col items-center justify-center
            ${badgeSizes[size]}
            bg-gradient-to-br from-burnished-gold to-aged-bronze
            rounded-full border-2 border-aged-bronze
            shadow-lg
          `}
        >
          <Star
            data-testid="level-star-icon"
            className={`${starSizes[size]} text-parchment fill-parchment absolute -top-1`}
          />
          <span className="font-bold text-parchment">{displayLevel}</span>
        </div>
      )}

      {/* Progress Section */}
      <div className="flex-1 min-w-0">
        {/* Level Label */}
        <div className="flex items-center justify-between mb-1">
          <span className="fantasy-body text-xs text-aged-bronze uppercase tracking-wide">
            Level
          </span>
          {showProgressText && (
            <span className="fantasy-body text-xs text-midnight-ink">
              {xpText}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`XP Progress: ${progressPercent}% towards next level`}
          className={`
            ${barHeights[size]}
            bg-aged-bronze/20 rounded-full overflow-hidden
            border border-aged-bronze/30
          `}
        >
          <div
            data-testid="progress-fill"
            className={`
              ${barHeights[size]}
              bg-gradient-to-r from-burnished-gold to-aged-bronze
              rounded-full transition-all duration-500 ease-out
            `}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default XPLevelDisplay;
