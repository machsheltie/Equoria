/**
 * SectionLoading — section-level loading indicator (D-15)
 *
 * Smaller than PageLoading: renders an inline spinner centered within the
 * section's available height. Does NOT use a fixed/absolute overlay —
 * it participates in normal document flow so surrounding layout is preserved.
 *
 * Accessibility: role="status" + aria-live="polite" + visually-hidden text.
 *
 * Loading level hierarchy (D-15):
 *   Route/page  → PageLoading    (same directory)
 *   Section     → SectionLoading ← this component
 *   Button      → Button `pending` (frontend/src/components/ui/button.tsx)
 *
 * Reduced motion: the spinner animation inherits --duration-fast which is
 * zeroed under prefers-reduced-motion in tokens.css. The spinner is still
 * visible but static, preserving the "loading" affordance without motion.
 *
 * Usage:
 *   // Section-level data fetch:
 *   if (isLoading) return <SectionLoading label="Loading horses…" />;
 *
 *   // With min height to prevent layout collapse:
 *   if (isLoading) return <SectionLoading minHeight="200px" />;
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface SectionLoadingProps {
  /**
   * Accessible label — announced to screen readers. Defaults to "Loading".
   * Use context-specific copy: "Loading competition results", "Loading stable".
   */
  label?: string;
  /**
   * Minimum height for the loading container. Prevents layout collapse when
   * the section normally has content. Defaults to 120px.
   */
  minHeight?: string | number;
  /** Extra class for the wrapper */
  className?: string;
}

export function SectionLoading({
  label = 'Loading',
  minHeight = '120px',
  className,
}: SectionLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn('flex flex-col items-center justify-center gap-3', className)}
      style={{ minHeight }}
    >
      {/* Spinner ring — uses CSS custom-property tokens for reduced-motion compat */}
      <div
        className="h-8 w-8 rounded-full border-2 animate-spin"
        style={{
          borderColor: 'var(--border-muted)',
          borderTopColor: 'var(--gold-primary)',
          animationDuration: 'var(--duration-reveal, 600ms)',
        }}
        aria-hidden="true"
      />

      {/* Visually-hidden announcement text */}
      <span className="sr-only">{label}</span>

      {/* Visible muted label for sighted users */}
      <p
        className="text-sm animate-pulse"
        style={{ color: 'var(--text-muted)', letterSpacing: 'var(--tracking-wide)' }}
        aria-hidden="true"
      >
        Loading…
      </p>
    </div>
  );
}

export default SectionLoading;
