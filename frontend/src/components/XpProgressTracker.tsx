/**
 * XpProgressTracker Component
 *
 * Main XP progress tracker component that displays level, XP progress,
 * and optional tooltip with detailed information. Supports linear and
 * circular display modes, three size variants, and automatic color tier
 * determination based on progress percentage.
 *
 * Uses XpProgressBar as the underlying progress bar component.
 *
 * Story 5-4 Task 3: XP Progress Tracker Component
 */

import React, { useMemo, useState, useCallback } from 'react';
import XpProgressBar from './XpProgressBar';

/**
 * Props for the XpProgressTracker component
 */
export interface XpProgressTrackerProps {
  /** Current player level */
  currentLevel: number;
  /** Total accumulated XP */
  currentXp: number;
  /** XP earned within the current level */
  xpForCurrentLevel: number;
  /** Total XP needed to reach the next level */
  xpToNextLevel: number;
  /** Lifetime total XP (optional, shown in tooltip) */
  totalXp?: number;
  /** Display mode: linear progress bar or circular indicator */
  mode?: 'linear' | 'circular';
  /** Size variant for the tracker */
  size?: 'small' | 'medium' | 'large';
  /** Whether to show a tooltip with detailed XP information */
  showTooltip?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Determine color tier based on progress percentage.
 * Blue: < 50%, Orange: >= 50% and < 90%, Gold: >= 90%
 */
function getColorTier(percent: number): 'blue' | 'orange' | 'gold' {
  if (percent >= 90) return 'gold';
  if (percent >= 50) return 'orange';
  return 'blue';
}

/**
 * Size configuration mapping for text and bar height styling
 */
const sizeConfig = {
  small: {
    container: 'gap-1',
    levelText: 'text-xs',
    xpText: 'text-xs',
    barHeight: 'h-1',
  },
  medium: {
    container: 'gap-2',
    levelText: 'text-sm',
    xpText: 'text-sm',
    barHeight: 'h-2',
  },
  large: {
    container: 'gap-3',
    levelText: 'text-base',
    xpText: 'text-base',
    barHeight: 'h-3',
  },
};

/**
 * XpProgressTracker - Displays level, XP progress, and optional tooltip
 */
const XpProgressTracker: React.FC<XpProgressTrackerProps> = React.memo(
  ({
    currentLevel,
    currentXp,
    xpForCurrentLevel,
    xpToNextLevel,
    totalXp,
    mode = 'linear',
    size = 'medium',
    showTooltip = false,
    className,
  }) => {
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);

    // Calculate percentage, guarding against division by zero and negative values
    const progressPercent = useMemo(() => {
      if (xpToNextLevel <= 0) return 0;
      const safeXpForLevel = Math.max(0, xpForCurrentLevel);
      const percent = Math.round((safeXpForLevel / xpToNextLevel) * 100);
      return Math.min(100, Math.max(0, percent));
    }, [xpForCurrentLevel, xpToNextLevel]);

    // Determine color tier from percentage
    const colorTier = useMemo(() => getColorTier(progressPercent), [progressPercent]);

    // Size styling
    const sizeStyles = sizeConfig[size] ?? sizeConfig.medium;

    // Tooltip event handlers
    const handleMouseEnter = useCallback(() => {
      if (showTooltip) {
        setIsTooltipVisible(true);
      }
    }, [showTooltip]);

    const handleMouseLeave = useCallback(() => {
      setIsTooltipVisible(false);
    }, []);

    // Clamp values for display
    const safeXpForCurrentLevel = Math.max(0, xpForCurrentLevel);

    return (
      <div
        data-testid="xp-progress-tracker"
        data-mode={mode}
        data-size={size}
        aria-label={`Level ${currentLevel} XP Progress: ${safeXpForCurrentLevel} of ${xpToNextLevel} XP`}
        className={`flex flex-col ${sizeStyles.container} ${className ?? ''}`}
      >
        {/* Level and XP text row */}
        <div className="flex items-center justify-between">
          <span className={`font-semibold text-gray-800 ${sizeStyles.levelText}`}>
            <span className="text-gray-500">Level </span>
            <span data-testid="xp-tracker-level">{currentLevel}</span>
          </span>
          <span
            data-testid="xp-tracker-text"
            className={`text-gray-600 ${sizeStyles.xpText}`}
          >
            {safeXpForCurrentLevel}/{xpToNextLevel} XP
          </span>
        </div>

        {/* Progress bar with optional tooltip trigger */}
        <div className="relative">
          {showTooltip ? (
            <div
              data-testid="xp-tracker-tooltip-trigger"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className="w-full"
            >
              <XpProgressBar
                currentXp={safeXpForCurrentLevel}
                xpToNextLevel={xpToNextLevel}
                progressPercent={progressPercent}
                colorTier={colorTier}
              />
            </div>
          ) : (
            <XpProgressBar
              currentXp={safeXpForCurrentLevel}
              xpToNextLevel={xpToNextLevel}
              progressPercent={progressPercent}
              colorTier={colorTier}
            />
          )}

          {/* Tooltip */}
          {isTooltipVisible && (
            <div
              data-testid="xp-tracker-tooltip"
              role="tooltip"
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
            >
              <div className="space-y-1">
                <div className="font-semibold">Level {currentLevel}</div>
                <div>Progress: {safeXpForCurrentLevel}/{xpToNextLevel} XP</div>
                <div>Next level: {Math.max(0, xpToNextLevel - safeXpForCurrentLevel)} XP needed</div>
                <div>{progressPercent}% to next level</div>
                {totalXp !== undefined && (
                  <div>Total XP: {totalXp}</div>
                )}
              </div>
              {/* Tooltip arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
            </div>
          )}
        </div>
      </div>
    );
  }
);

XpProgressTracker.displayName = 'XpProgressTracker';

export default XpProgressTracker;
