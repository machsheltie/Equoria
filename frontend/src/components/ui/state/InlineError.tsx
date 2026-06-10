/**
 * InlineError — small inline error message (D-16)
 *
 * Renders an alert icon + message text inline with other content.
 * Intended for field-level and inline API errors, not section/page errors.
 *
 * For section or page errors use `ErrorState` (same directory).
 *
 * Accessibility: role="alert" so screen readers announce immediately on mount.
 * The icon is aria-hidden; the message text carries the meaning.
 *
 * Tokens used: --role-danger-text (= --status-danger = #ef4444) per DECISIONS.md §7.
 *
 * Usage:
 *   <InlineError message="Password must be at least 8 characters." />
 *   <InlineError message={apiError} className="mt-2" />
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InlineErrorProps {
  /** Error message text. Caller is responsible for user-safe copy.
   *  @warning Do NOT pass raw server error strings — sanitize before display. */
  message: string;
  /** Extra class for the wrapper span */
  className?: string;
}

export function InlineError({ message, className }: InlineErrorProps) {
  return (
    <span
      role="alert"
      className={cn('inline-flex items-center gap-1.5 text-sm', className)}
      style={{ color: 'var(--role-danger-text)' }}
    >
      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </span>
  );
}

export default InlineError;
