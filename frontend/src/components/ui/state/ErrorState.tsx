/**
 * ErrorState — section / page-level error (D-16)
 *
 * Wraps `ErrorCard` (which provides the Celestial Night glass panel, AlertTriangle
 * icon, and action buttons) and adds:
 *   - `severity` prop: 'section' (default) | 'page' — tunes vertical padding
 *   - `backLink` prop: optional back navigation alongside retry
 *   - focusable heading for screen-reader discovery (tabIndex=-1 on the
 *     inner h3 via ErrorCard's existing structure)
 *   - role="alert" is provided by ErrorCard's inner panel
 *
 * Extend-vs-new decision: ErrorCard already has `role="alert"`, the Celestial
 * Night visual treatment, and working retry/home buttons. ErrorState wraps it
 * (not duplicates it) to add the D-16 contract (severity, backLink). No new
 * visual component is created. `retry.label` / `backLink.label` are passed
 * through to ErrorCard's retryLabel/goHomeLabel (Equoria-o5hub ratchet);
 * ErrorCard's defaults ("Try Again" / "Go Home") apply when omitted, so
 * direct ErrorCard consumers are unchanged.
 *
 * @warning Do NOT pass raw server/API error strings as `message`. The message
 * is rendered directly in the UI and MUST be caller-provided, user-safe copy.
 * Internal error codes, stack traces, and database messages must never be
 * forwarded here.
 *
 * Usage:
 *   // Section-level (default):
 *   <ErrorState
 *     title="Could not load horses"
 *     message="Check your connection and try again."
 *     retry={{ label: 'Retry', onClick: refetch }}
 *   />
 *
 *   // Page-level (more padding, optional back link):
 *   <ErrorState
 *     severity="page"
 *     title="Competition Not Found"
 *     message="This competition may have ended or been removed."
 *     backLink={{ label: 'Back to competitions', onClick: () => navigate('/competitions') }}
 *   />
 */

import React from 'react';
import { ErrorCard } from '../ErrorCard';
import { cn } from '@/lib/utils';

export interface ErrorStateRetry {
  /** Button label */
  label: string;
  onClick: () => void;
}

export interface ErrorStateBackLink {
  /** Button label */
  label: string;
  onClick: () => void;
}

export interface ErrorStateProps {
  /** Error heading — user-safe copy */
  title?: string;
  /**
   * Descriptive message — user-safe copy.
   * @warning Caller must never forward raw server error details here.
   */
  message?: string;
  /**
   * Severity tunes outer padding:
   *  - 'section' (default): py-8 — suitable inside a page section
   *  - 'page': py-16 — suitable when the error occupies the full viewport
   */
  severity?: 'section' | 'page';
  /** Optional retry action — renders a primary "Try Again" button */
  retry?: ErrorStateRetry;
  /**
   * Optional back navigation — renders a secondary button alongside retry.
   * Use when the error implies the user should navigate away.
   */
  backLink?: ErrorStateBackLink;
  /** Extra class on the outer wrapper */
  className?: string;
}

export function ErrorState({
  title,
  message,
  severity = 'section',
  retry,
  backLink,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn(severity === 'page' ? 'py-16' : 'py-8', className)}>
      <ErrorCard
        title={title}
        message={message}
        onRetry={retry?.onClick}
        retryLabel={retry?.label}
        onGoHome={backLink?.onClick}
        goHomeLabel={backLink?.label}
      />
    </div>
  );
}

export default ErrorState;
