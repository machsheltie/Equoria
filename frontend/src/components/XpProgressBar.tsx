/**
 * XpProgressBar Component
 *
 * A linear progress bar for displaying XP progress with color-coded tiers.
 * Supports blue (< 50%), orange (>= 50% and < 90%), and gold (>= 90%) tiers.
 * Includes ARIA accessibility attributes for screen reader support.
 *
 * Story 5-4 Task 3: XP Progress Tracker Component
 */

import React, { useMemo } from 'react';

/**
 * Props for the XpProgressBar component
 */
export interface XpProgressBarProps {
  /** Current XP earned within the current level */
  currentXp: number;
  /** Total XP required to reach the next level */
  xpToNextLevel: number;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Color tier for the progress bar fill */
  colorTier: 'blue' | 'orange' | 'gold';
  /** Whether to show percentage text overlay */
  showPercentage?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Color tier CSS class mapping for the progress bar fill
 */
const colorTierClasses: Record<string, string> = {
  blue: 'bg-blue-500',
  orange: 'bg-orange-500',
  gold: 'bg-yellow-500',
};

/**
 * XpProgressBar - A linear progress bar with color-coded tiers and accessibility support
 */
const XpProgressBar: React.FC<XpProgressBarProps> = React.memo(
  ({ currentXp, xpToNextLevel, progressPercent, colorTier, showPercentage = false, className }) => {
    // Clamp progress between 0 and 100 for display
    const clampedPercent = useMemo(
      () => Math.min(100, Math.max(0, progressPercent)),
      [progressPercent]
    );

    // Clamp aria-valuenow between 0 and 100
    const ariaValueNow = useMemo(
      () => Math.min(100, Math.max(0, progressPercent)),
      [progressPercent]
    );

    return (
      <div
        data-testid="xp-progress-bar"
        className={`w-full ${className ?? ''}`}
      >
        <div
          role="progressbar"
          aria-valuenow={ariaValueNow}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`XP Progress: ${currentXp} of ${xpToNextLevel} XP (${clampedPercent}%)`}
          className="relative h-2 bg-gray-200 rounded-full overflow-hidden"
        >
          <div
            data-testid="xp-progress-fill"
            data-color-tier={colorTier}
            className={`
              h-full rounded-full transition-all duration-500 ease-out
              ${colorTierClasses[colorTier] ?? colorTierClasses.blue}
            `}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
        {showPercentage && (
          <span
            data-testid="xp-progress-percent-text"
            className="text-xs text-gray-600 mt-1 block text-right"
          >
            {clampedPercent}%
          </span>
        )}
      </div>
    );
  }
);

XpProgressBar.displayName = 'XpProgressBar';

export default XpProgressBar;
