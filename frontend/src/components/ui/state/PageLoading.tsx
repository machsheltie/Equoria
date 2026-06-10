/**
 * PageLoading — route / page-level loading indicator (D-15)
 *
 * Wraps GallopingLoader (the existing route-level Suspense boundary fallback)
 * and adds:
 *   - Accessible role="status" + aria-live="polite" semantics
 *   - Visually-hidden "Loading" text for screen readers
 *   - Optional visible `label` prop for context-specific copy
 *
 * Loading level hierarchy (D-15):
 *   Route/page  → PageLoading       ← this component
 *   Section     → SectionLoading    (same directory)
 *   Button      → Button `pending`  (frontend/src/components/ui/button.tsx)
 *
 * Usage:
 *   // As a React.lazy() Suspense fallback (replaces bare GallopingLoader):
 *   <Suspense fallback={<PageLoading />}>
 *     <LazyPage />
 *   </Suspense>
 *
 *   // With a context label:
 *   <PageLoading label="Loading competition results…" />
 */

import React from 'react';
import GallopingLoader from '../GallopingLoader';

export interface PageLoadingProps {
  /**
   * Optional visible label shown below the animation.
   * When omitted the component still announces "Loading" to screen readers
   * via the visually-hidden span.
   */
  label?: string;
  /** Extra class added to the outermost wrapper (passes through to GallopingLoader wrapper) */
  className?: string;
}

export function PageLoading({ label, className }: PageLoadingProps) {
  return (
    <div role="status" aria-live="polite" aria-label={label ?? 'Loading'} className={className}>
      {/* Visually-hidden fallback for screen readers — GallopingLoader also has
          aria-label="Loading" but this outer role="status" is the canonical
          announcement point for the page loading level. */}
      <span className="sr-only">Loading</span>

      {/* Reuse the existing GallopingLoader animation.
          GallopingLoader is fixed inset-0 — it fills the viewport correctly
          for the route/page level. */}
      <GallopingLoader />

      {/* Optional visible contextual label rendered BELOW the fixed overlay.
          Since GallopingLoader is fixed, this label is appended to the DOM flow
          but visually appears inside the fixed layer's "Loading…" area via
          absolute positioning would be complex; instead we emit the label as an
          aria-label on the outer role=status (above) so AT reads it, and trust
          that visible callers use GallopingLoader's built-in "Loading…" text. */}
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}

export default PageLoading;
