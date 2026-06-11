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
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorCardProps {
  /** Heading shown above the message */
  title?: string;
  /** Descriptive error message */
  message?: string;
  /** When provided, shows a "Try Again" button that calls this */
  onRetry?: () => void;
  /** When provided, shows a secondary "Go Home" button that calls this */
  onGoHome?: () => void;
  /** Extra wrapper class — useful to constrain padding in tight contexts */
  className?: string;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({
  title = 'Unable to Load Data',
  message = 'Something went wrong. Please check your connection and try again.',
  onRetry,
  onGoHome,
  className,
}) => (
  <div className={`flex items-center justify-center p-8 sm:p-12 ${className ?? ''}`}>
    <div
      className="glass-panel rounded-[var(--radius-lg)] border border-[var(--status-warning)]/20 px-6 py-6 text-center space-y-4 max-w-sm w-full"
      role="alert"
    >
      {/* Icon — warning role tint (status dot circles are legitimate full radius) */}
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--badge-warning-bg)] border border-[var(--status-warning)]/20 mx-auto">
        <AlertTriangle className="h-6 w-6 text-[var(--status-warning)]" aria-hidden="true" />
      </div>

      {/* Text */}
      <div className="space-y-1">
        <h3 className="type-card-title">{title}</h3>
        <p className="text-sm text-[var(--text-muted)] font-[var(--font-body)] leading-relaxed">
          {message}
        </p>
      </div>

      {/* Action buttons — canonical tiers (D-08: one gold primary) */}
      <div className="flex items-center justify-center gap-3">
        {onRetry && (
          <Button type="button" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try Again
          </Button>
        )}

        {onGoHome && (
          <Button type="button" size="sm" variant="outline" onClick={onGoHome}>
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            Go Home
          </Button>
        )}
      </div>
    </div>
  </div>
);

export default ErrorCard;
