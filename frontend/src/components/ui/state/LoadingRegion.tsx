/**
 * LoadingRegion — the live-region wrapper for a placeholder (skeleton) block
 * (Equoria-2fzcy; FRONTEND_ASYNC_STATE_DOCTRINE sections 1 and 5)
 *
 * Draws nothing of its own. It wraps geometry a component already draws while
 * it loads (pulsing blocks, skeleton rows) so a screen reader hears that the
 * region is loading instead of silence:
 *   role="status" + aria-busy + a name (aria-label) + visually-hidden text.
 *
 * Use it to keep a component's existing placeholder geometry (the issue is
 * mechanical: no visual redesign). When the placeholder is not a block you can
 * wrap — table rows, say — render `<LoadingRegion label="…" />` with no children
 * beside the table; it then draws only the visually-hidden announcement.
 *
 * One region per loading area: wrap a whole grid or run of rows, never each
 * block in it.
 *
 *   <LoadingRegion label="Loading competitions" className="grid grid-cols-3 gap-4">
 *     <Placeholder /> <Placeholder /> <Placeholder />
 *   </LoadingRegion>
 */

import React from 'react';

export interface LoadingRegionProps {
  /** What is loading, e.g. "Loading competitions". Announced to screen readers. */
  label: string;
  /** Placeholder blocks to draw inside the region. Omit for an announcement only. */
  children?: React.ReactNode;
  /** Class for the wrapper (the placeholder's own layout classes go here). */
  className?: string;
  /**
   * Add the visually-hidden copy of the label (default true). Pass false when
   * the region already contains visible text saying the same thing.
   */
  announceText?: boolean;
  /** Test id, for components whose tests locate their skeleton by it. */
  'data-testid'?: string;
}

export function LoadingRegion({
  label,
  children,
  className,
  announceText = true,
  'data-testid': testId,
}: LoadingRegionProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={className}
      data-testid={testId}
    >
      {children}
      {announceText && <span className="sr-only">{label}</span>}
    </div>
  );
}

export default LoadingRegion;
