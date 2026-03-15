/**
 * ErrorCard — Consistent error display with optional retry button (Epic 30-2)
 *
 * Celestial Night restyle: glass panel, gold-outlined alert, amber palette.
 * Used for useQuery failure states across all major pages.
 *
 * Story 15-3: Loading & Error States Polish
 * Epic 30-2: Celestial Night restyle
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

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
      className="glass-panel rounded-2xl border border-[rgba(251,191,36,0.2)] px-6 py-6 text-center space-y-4 max-w-sm w-full"
      role="alert"
    >
      {/* Icon */}
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.2)] mx-auto">
        <AlertTriangle className="h-6 w-6 text-amber-400" aria-hidden="true" />
      </div>

      {/* Text */}
      <div className="space-y-1">
        <h3
          className="text-base font-semibold text-[var(--text-primary)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h3>
        <p className="text-sm text-[var(--text-muted)] font-[var(--font-body)] leading-relaxed">
          {message}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={[
              'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-all',
              'bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-primary)] text-[var(--bg-night-sky)]',
              'hover:brightness-110 hover:shadow-[0_0_14px_rgba(201,162,39,0.3)]',
              'font-[var(--font-heading)]',
            ].join(' ')}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try Again
          </button>
        )}

        {onGoHome && (
          <button
            type="button"
            onClick={onGoHome}
            className={[
              'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-all',
              'border border-[rgba(251,191,36,0.3)] text-amber-400',
              'hover:bg-[rgba(251,191,36,0.08)] hover:border-[rgba(251,191,36,0.5)]',
              'font-[var(--font-heading)]',
            ].join(' ')}
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            Go Home
          </button>
        )}
      </div>
    </div>
  </div>
);

export default ErrorCard;
