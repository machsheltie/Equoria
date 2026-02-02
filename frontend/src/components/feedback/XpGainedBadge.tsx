/**
 * XpGainedBadge Component
 *
 * Displays an animated XP gained notification badge:
 * - "+X XP" text format with star icon
 * - Scale-in entrance animation
 * - Pulse effect during display
 * - Auto-fade out after configurable delay
 *
 * Features:
 * - Configurable positioning (top-right, top-left, bottom-right, bottom-left)
 * - Blue/purple gradient background
 * - Rounded pill shape with shadow
 * - Non-blocking absolute positioning
 * - Number formatting for large XP values
 *
 * Story 5-3: Balance Update Indicators - Task 4
 */

import React, { memo, useState, useEffect, useRef } from 'react';
import { Star } from 'lucide-react';

/**
 * Position options for the badge
 */
export type XpBadgePosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

/**
 * Props interface for XpGainedBadge component
 */
export interface XpGainedBadgeProps {
  /** Amount of XP gained */
  xpAmount: number;
  /** Whether to show the badge (default: true) */
  show?: boolean;
  /** Duration before fade-out in milliseconds (default: 3000) */
  duration?: number;
  /** Position of the badge (default: 'top-right') */
  position?: XpBadgePosition;
  /** Callback fired when fade-out completes */
  onFadeComplete?: () => void;
}

/**
 * Format XP amount with comma separators for large numbers
 */
const formatXpAmount = (amount: number): string => {
  return new Intl.NumberFormat('en-US').format(amount);
};

/**
 * Get position classes based on the position prop
 */
const getPositionClasses = (position: XpBadgePosition): string => {
  switch (position) {
    case 'top-right':
      return 'top-2 right-2';
    case 'top-left':
      return 'top-2 left-2';
    case 'bottom-right':
      return 'bottom-2 right-2';
    case 'bottom-left':
      return 'bottom-2 left-2';
  }
};

/**
 * XpGainedBadge Component
 *
 * Displays an animated badge showing XP gained, typically overlaid
 * on horse cards or other game elements.
 */
const XpGainedBadge = memo(function XpGainedBadge({
  xpAmount,
  show = true,
  duration = 3000,
  position = 'top-right',
  onFadeComplete,
}: XpGainedBadgeProps) {
  // Track internal visibility for fade animation
  const [isVisible, setIsVisible] = useState(show);

  // Timer ref for cleanup
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Handle visibility and fade-out timer
   */
  useEffect(() => {
    // Update visibility when show prop changes
    if (show) {
      setIsVisible(true);

      // Set up auto-fade timer
      timerRef.current = setTimeout(() => {
        setIsVisible(false);
        onFadeComplete?.();
      }, duration);
    } else {
      setIsVisible(false);
    }

    // Cleanup timer on unmount or prop change
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [show, duration, onFadeComplete]);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Format the XP amount
  const formattedXp = formatXpAmount(xpAmount);

  // Get position classes
  const positionClasses = getPositionClasses(position);

  return (
    <div
      data-testid="xp-gained-badge"
      className={`
        absolute ${positionClasses}
        inline-flex items-center gap-1
        px-3 py-1
        bg-gradient-to-r from-blue-500 to-purple-600
        text-white font-semibold text-sm
        rounded-full shadow-lg
        animate-scale-in animate-pulse
        pointer-events-none
        z-10
      `}
      role="status"
      aria-live="polite"
    >
      {/* Star Icon */}
      <Star
        className="h-4 w-4 fill-yellow-300 text-yellow-300"
        aria-hidden="true"
        data-testid="xp-star-icon"
      />

      {/* XP Amount Text */}
      <span>+{formattedXp} XP</span>
    </div>
  );
});

export default XpGainedBadge;
