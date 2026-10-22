/**
 * ErrorCard — Consistent error display with optional retry button (Epic 30-2)
 *
 * Celestial Night restyle: glass panel, warning-role alert treatment.
 * Used for useQuery failure states across all major pages (wrapped by the
 * canonical ErrorState).
 *
 * Story 15-3: Loading & Error States Polish
 * Epic 30-2: Celestial Night restyle
 * Equoria-o5hub.23: tokenized — semantic radius, warning role tokens,
 * canonical Button tiers (gold primary retry, outline Go Home).
 * Equoria-o5hub ratchet: retryLabel / goHomeLabel passthrough (defaults
 * unchanged: "Try Again" / "Go Home") so ErrorState consumers' labels are
 * honoured instead of silently dropped.
 * Equoria-3r6n3: focus management — the heading is focusable (tabIndex -1) and
 * takes focus when the card appears, so a keyboard or screen-reader user whose
 * request just failed lands on the failure. Two guards keep it from being a
 * focus-steal: it never moves focus out of a control the player is already
 * using (a background refetch failing while she types), and `focusOnMount`
 * lets an inline, non-blocking caller opt out. The focus call does not scroll,
 * so a failed section further down a page does not yank the view.
 */

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorCardProps {
  /** Heading shown above the message */
  title?: string;
  /** Descriptive error message */
  message?: string;
  /** When provided, shows a "Try Again" button that calls this */
  onRetry?: () => void;
  /** Label for the retry button. Defaults to "Try Again". */
  retryLabel?: string;
  /** When provided, shows a secondary "Go Home" button that calls this */
  onGoHome?: () => void;
  /** Label for the secondary navigation button. Defaults to "Go Home". */
  goHomeLabel?: string;
  /** Extra wrapper class — useful to constrain padding in tight contexts */
  className?: string;
  /**
   * Move focus to the heading when the card appears. Default true. Pass false
   * for an inline error beside content the player is working in. Focus is also
   * left alone whenever another control already has it.
   */
  focusOnMount?: boolean;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({
  title = 'Unable to Load Data',
  message = 'Something went wrong. Please check your connection and try again.',
  onRetry,
  retryLabel = 'Try Again',
  onGoHome,
  goHomeLabel = 'Go Home',
  className,
  focusOnMount = true,
}) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!focusOnMount) return;
    const active = document.activeElement;
    // Only claim focus when nothing specific holds it (the control that triggered
    // the failed request has usually just been unmounted, leaving body focused).
    if (active && active !== document.body && active !== document.documentElement) return;
    headingRef.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  return (
    <div className={`flex items-center justify-center p-8 sm:p-12 ${className ?? ''}`}>
      <div
        className="glass-panel rounded-[var(--radius-lg)] border border-[var(--role-warning-border)] px-6 py-6 text-center space-y-4 max-w-sm w-full"
        role="alert"
      >
        {/* Icon — warning role tint (status dot circles are legitimate full radius) */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--badge-warning-bg)] border border-[var(--role-warning-border)] mx-auto">
          <AlertTriangle className="h-6 w-6 text-[var(--status-warning)]" aria-hidden="true" />
        </div>

        {/* Text */}
        <div className="space-y-1">
          <h3 ref={headingRef} tabIndex={-1} className="type-card-title focus:outline-none">
            {title}
          </h3>
          <p className="text-sm text-[var(--text-muted)] font-[var(--font-body)] leading-relaxed">
            {message}
          </p>
        </div>

        {/* Action buttons — canonical tiers (D-08: one gold primary) */}
        <div className="flex items-center justify-center gap-3">
          {onRetry && (
            <Button type="button" size="sm" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {retryLabel}
            </Button>
          )}

          {onGoHome && (
            <Button type="button" size="sm" variant="outline" onClick={onGoHome}>
              <Home className="h-3.5 w-3.5" aria-hidden="true" />
              {goHomeLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorCard;
