/**
 * StarfieldBackground — global atmospheric layer (Equoria-9x4w, Spec 11.3.1)
 *
 * The Celestial Night sky that makes every page feel like a game world rather
 * than a web app. Mounted ONCE, globally, in App.tsx so it renders behind every
 * route — including the public auth/onboarding pages that have no PageBackground
 * painted scene (PageBackground only runs inside the authenticated
 * DashboardLayout).
 *
 * Pure CSS, zero JavaScript:
 *   - layered radial-gradient star fields (three star "sheets" of differing
 *     size/opacity) painted via `background-image` in index.css
 *   - the subtle twinkle is a CSS `@keyframes` opacity animation
 *   - NO <canvas>, NO requestAnimationFrame, NO JS animation frames
 *
 * Density variants (Spec 11.3.1):
 *   - "dense"  (default) — hub, landing, onboarding: more, brighter stars
 *   - "sparse"           — content-heavy pages (Results, Messages): fewer stars
 *
 * Accessibility:
 *   - aria-hidden="true" — purely decorative, never announced
 *   - no focusable / interactive descendants — keyboard no-op
 *   - sits at a negative z-index (--z-starfield, behind PageBackground's
 *     --z-below) so it never affects content contrast or hit-testing
 *   - reduced motion: the twinkle animation is set to `none` via the
 *     `@media (prefers-reduced-motion: reduce)` block in index.css — stars
 *     remain visible but static
 *
 * The visual itself lives in index.css under `.starfield-bg` /
 * `.starfield-bg[data-density=...]` so the component stays a thin, testable
 * shell and the tokens/keyframes live with the rest of the design system.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface StarfieldBackgroundProps {
  /** Star density — "dense" for hub/landing/onboarding, "sparse" for content-heavy pages */
  density?: 'dense' | 'sparse';
  /** Optional extra classes (rarely needed — it is a fixed full-viewport layer) */
  className?: string;
}

const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({
  density = 'dense',
  className,
}) => {
  return (
    <div className={cn('starfield-bg', className)} data-density={density} aria-hidden="true" />
  );
};

export default StarfieldBackground;
