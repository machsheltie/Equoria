/**
 * BalanceUpdateIndicator Component
 *
 * Displays animated balance updates with visual feedback:
 * - Animated counter from old value to new value
 * - Overlay notification showing change amount (+/-)
 * - Pulse/glow effect during animation
 * - Screen reader announcements via ARIA live region
 *
 * Features:
 * - Configurable animation duration
 * - Currency formatting with customizable prefix and decimals
 * - Auto-fading overlay notification
 * - Reduced motion support (instant update)
 * - Accessible with proper ARIA attributes
 *
 * Story 5-3: Balance Update Indicators - Task 4
 */

import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Props interface for BalanceUpdateIndicator component
 */
export interface BalanceUpdateIndicatorProps {
  /** Previous balance value before update */
  oldValue: number;
  /** New balance value after update */
  newValue: number;
  /** Animation duration in milliseconds (default: 1000) */
  duration?: number;
  /** Whether to show the overlay notification (default: true) */
  showOverlay?: boolean;
  /** Duration for overlay visibility in milliseconds (default: 3000) */
  overlayDuration?: number;
  /** Currency prefix (default: "$") */
  prefix?: string;
  /** Number of decimal places (default: 2) */
  decimals?: number;
  /** Additional CSS classes for the container */
  className?: string;
  /** Callback fired when animation completes */
  onAnimationComplete?: () => void;
}

/**
 * Format a number as currency with commas and specified decimal places
 */
const formatCurrencyValue = (
  value: number,
  prefix: string,
  decimals: number
): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${formatter.format(value)}`;
};

/**
 * Easing function for smooth animation (easeOutCubic)
 */
const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

/**
 * BalanceUpdateIndicator Component
 *
 * Displays an animated balance counter with overlay notifications
 * for increases and decreases.
 */
const BalanceUpdateIndicator = memo(function BalanceUpdateIndicator({
  oldValue,
  newValue,
  duration = 1000,
  showOverlay = true,
  overlayDuration = 3000,
  prefix = '$',
  decimals = 2,
  className = '',
  onAnimationComplete,
}: BalanceUpdateIndicatorProps) {
  // Current displayed value during animation
  const [displayValue, setDisplayValue] = useState(oldValue);
  // Whether animation is currently running
  const [isAnimating, setIsAnimating] = useState(false);
  // Whether overlay is visible
  const [showOverlayState, setShowOverlayState] = useState(false);
  // Screen reader announcement text
  const [announcement, setAnnouncement] = useState('');

  // Timer refs for cleanup
  const animationFrameRef = useRef<number | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate the change amount
  const changeAmount = newValue - oldValue;
  const hasChange = changeAmount !== 0;
  const isIncrease = changeAmount > 0;

  /**
   * Cleanup all timers and animation frames
   */
  const cleanup = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (overlayTimerRef.current !== null) {
      clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }
    if (completionTimerRef.current !== null) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
  }, []);

  /**
   * Run the counter animation from oldValue to newValue
   */
  useEffect(() => {
    // If no change, just display the value without animation
    if (!hasChange) {
      setDisplayValue(newValue);
      setIsAnimating(false);
      setShowOverlayState(false);
      return;
    }

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      // Instant update for reduced motion
      setDisplayValue(newValue);
      setIsAnimating(false);
      if (showOverlay) {
        setShowOverlayState(true);
        overlayTimerRef.current = setTimeout(() => {
          setShowOverlayState(false);
        }, overlayDuration);
      }
      setAnnouncement(
        `Balance updated to ${formatCurrencyValue(newValue, prefix, decimals)}`
      );
      onAnimationComplete?.();
      return;
    }

    // Start animation
    setIsAnimating(true);
    if (showOverlay) {
      setShowOverlayState(true);
    }

    const startTime = performance.now();
    const startValue = oldValue;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      const currentValue = startValue + changeAmount * easedProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        setDisplayValue(newValue);
        setIsAnimating(false);
        setAnnouncement(
          `Balance updated to ${formatCurrencyValue(newValue, prefix, decimals)}`
        );

        // Call completion callback
        completionTimerRef.current = setTimeout(() => {
          onAnimationComplete?.();
        }, 0);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Set up overlay fade-out timer
    if (showOverlay) {
      overlayTimerRef.current = setTimeout(() => {
        setShowOverlayState(false);
      }, overlayDuration);
    }

    return cleanup;
  }, [
    oldValue,
    newValue,
    duration,
    showOverlay,
    overlayDuration,
    prefix,
    decimals,
    hasChange,
    changeAmount,
    onAnimationComplete,
    cleanup,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Format the current display value
  const formattedValue = formatCurrencyValue(displayValue, prefix, decimals);

  // Format the change amount for overlay
  const formattedChange = formatCurrencyValue(
    Math.abs(changeAmount),
    prefix,
    decimals
  );
  const changeText = isIncrease ? `+${formattedChange}` : `-${formattedChange}`;

  // Container classes
  const containerClasses = [
    'relative',
    'inline-flex',
    'items-center',
    isAnimating ? 'animate-pulse ring-2' : '',
    isAnimating && isIncrease ? 'ring-green-400' : '',
    isAnimating && !isIncrease ? 'ring-red-400' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {/* Main balance display */}
      <div
        data-testid="balance-display"
        className={`
          font-bold text-xl transition-all duration-200
          ${isAnimating ? 'animate-pulse' : ''}
        `}
      >
        {formattedValue}
      </div>

      {/* Overlay notification */}
      {hasChange && showOverlayState && (
        <div
          data-testid="balance-overlay"
          className={`
            absolute -top-6 left-1/2 transform -translate-x-1/2
            flex items-center gap-1
            px-2 py-1 rounded-full
            text-sm font-semibold
            animate-float-up
            pointer-events-none
            ${isIncrease ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}
          `}
        >
          {isIncrease ? (
            <TrendingUp className="h-3 w-3" aria-hidden="true" />
          ) : (
            <TrendingDown className="h-3 w-3" aria-hidden="true" />
          )}
          <span>{changeText}</span>
        </div>
      )}

      {/* Screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  );
});

export default BalanceUpdateIndicator;
