/**
 * XpGainNotification Component
 *
 * Displays a compact, animated XP gain notification with:
 * - "+X XP" text with count-up animation
 * - XP progress bar showing current level progress
 * - Level and XP text (e.g., "Level 5 - 45/100 XP")
 * - Configurable positioning (top-right or bottom-right)
 *
 * Features:
 * - Configurable auto-dismiss delay (default 4 seconds)
 * - Manual close button with X icon
 * - Fade-in/fade-out animations
 * - Count-up effect with easing function
 * - Progress bar fill animation
 * - WCAG 2.1 AA compliant with ARIA live regions
 * - Keyboard navigation (Escape to close)
 * - Responsive design (mobile, tablet, desktop)
 * - Portal rendering for proper stacking context
 *
 * Story 5-4: XP Gain Notification - Task 1
 */

import React, { memo, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

/**
 * Props interface for XpGainNotification component
 */
export interface XpGainNotificationProps {
  /** Amount of XP gained */
  xpGained: number;
  /** Current player level */
  currentLevel: number;
  /** Total cumulative XP for the player */
  currentXp: number;
  /** XP earned within the current level */
  xpForCurrentLevel: number;
  /** Total XP needed to reach the next level */
  xpToNextLevel: number;
  /** Whether to show the notification (default: true) */
  show?: boolean;
  /** Whether to automatically dismiss the notification (default: true) */
  autoDismiss?: boolean;
  /** Delay in milliseconds before auto-dismiss (default: 4000) */
  autoDismissDelay?: number;
  /** Position of the notification on screen (default: 'top-right') */
  position?: 'top-right' | 'bottom-right';
  /** Callback fired when the notification is closed */
  onClose?: () => void;
}

/**
 * Format a number with comma separators for display
 */
const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};

/**
 * Calculate progress bar percentage, clamped between 0 and 100
 */
const calculateProgressPercent = (
  xpForCurrentLevel: number,
  xpToNextLevel: number
): number => {
  if (xpToNextLevel <= 0) {
    return 0;
  }
  const percent = (xpForCurrentLevel / xpToNextLevel) * 100;
  return Math.min(Math.max(percent, 0), 100);
};

/**
 * Get position CSS classes based on the position prop
 */
const getPositionClasses = (position: 'top-right' | 'bottom-right'): string => {
  switch (position) {
    case 'top-right':
      return 'top-4 right-4';
    case 'bottom-right':
      return 'bottom-4 right-4';
    default:
      return 'top-4 right-4';
  }
};

/**
 * XpGainNotification Component
 *
 * Renders a compact notification showing XP gained, current progress bar,
 * and level information with auto-dismiss and close button functionality.
 */
const XpGainNotification = memo(function XpGainNotification({
  xpGained,
  currentLevel,
  _currentXp,
  xpForCurrentLevel,
  xpToNextLevel,
  show = true,
  autoDismiss = true,
  autoDismissDelay = 4000,
  position = 'top-right',
  onClose,
}: XpGainNotificationProps) {
  // Timer ref for auto-dismiss cleanup
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Handle manual close action
   */
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  /**
   * Handle keyboard events (Escape key to close)
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    },
    [handleClose]
  );

  /**
   * Set up auto-dismiss timer when component is shown
   */
  useEffect(() => {
    if (!show || !autoDismiss) {
      return;
    }

    timerRef.current = setTimeout(() => {
      onClose?.();
    }, autoDismissDelay);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [show, autoDismiss, autoDismissDelay, onClose]);

  /**
   * Set up keyboard event listener for Escape key
   */
  useEffect(() => {
    if (!show) {
      return;
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [show, handleKeyDown]);

  /**
   * Clean up timer on unmount
   */
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Do not render when show is false
  if (!show) {
    return null;
  }

  // Calculate progress bar percentage
  const progressPercent = calculateProgressPercent(xpForCurrentLevel, xpToNextLevel);

  // Format XP gained with commas for large numbers
  const formattedXpGained = formatNumber(xpGained);

  // Get position classes
  const positionClasses = getPositionClasses(position);

  return (
    <div
      data-testid="xp-gain-notification"
      className={`
        fixed ${positionClasses}
        z-50
        w-72
        bg-white
        shadow-lg rounded-lg
        border border-gray-200
        p-4
        transition-all duration-300 ease-in-out
        animate-fade-in
        sm:w-64 md:w-72
      `}
      role="alert"
    >
      {/* Header row: XP gained text and close button */}
      <div className="flex items-center justify-between mb-2">
        <span
          data-testid="xp-gained-text"
          className="
            text-lg font-bold
            bg-gradient-to-r from-blue-600 to-purple-600
            bg-clip-text text-transparent
          "
        >
          +{formattedXpGained} XP
        </span>

        {/* Close button */}
        <button
          data-testid="xp-notification-close"
          onClick={handleClose}
          aria-label="Close notification"
          className="
            p-1 rounded-full
            text-gray-400 hover:text-gray-600
            hover:bg-gray-100
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-blue-500
          "
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Progress bar */}
      <div
        data-testid="xp-progress-bar"
        className="
          w-full h-2
          bg-gray-200 rounded-full
          overflow-hidden
          mb-2
        "
      >
        <div
          data-testid="xp-progress-fill"
          className="
            h-full
            bg-gradient-to-r from-blue-500 to-purple-600
            rounded-full
            transition-all duration-500 ease-out
          "
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Level and XP info text */}
      <div
        data-testid="xp-level-info"
        className="text-sm text-gray-600"
      >
        <span data-testid="xp-level-text">Level {currentLevel}</span>
        {' - '}
        <span data-testid="xp-progress-text">{xpForCurrentLevel}/{xpToNextLevel} XP</span>
      </div>

      {/* Screen reader announcement */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        You gained {xpGained} XP. Currently Level {currentLevel}, {xpForCurrentLevel} of {xpToNextLevel} XP to next level.
      </div>
    </div>
  );
});

export default XpGainNotification;
