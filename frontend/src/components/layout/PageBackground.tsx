/**
 * PageBackground — Story 22.3: Painted Background System
 *
 * Two consumption patterns, both supported:
 *
 *   1. <PageBackground scene="auth" /> — a real layered <div> rendered at
 *      z-[var(--z-below)] (−1), fixed to the viewport, behind all content.
 *      Apply when the parent does NOT control its own background.
 *
 *   2. `usePageBackground({ scene })` — returns CSSProperties for callers
 *      that want to paint their own root div. DashboardLayout uses this so
 *      the gradient/image lives on the same element as `min-h-screen` and
 *      scrolls naturally on iOS Safari (which ignores `background-attachment: fixed`).
 *
 * AC coverage (Story 22.3):
 *   AC1  — layered at z-[var(--z-below)]
 *   AC3  — background-size: cover fills all viewports
 *   AC4  — deep-navy gradient fallback (#0a0e1a → #111827) while art loads
 *   AC5  — semi-transparent overlay rgba(5,10,20,0.45) over the image
 *   AC8  — useResponsiveBackground scene parameter resolves the right path
 */

import type { CSSProperties } from 'react';
import { useResponsiveBackground, type SceneKey } from '@/hooks/useResponsiveBackground';

interface UsePageBackgroundOptions {
  scene?: SceneKey;
  /** Direct WebP path — overrides scene-based lookup when provided. */
  src?: string;
}

/**
 * Deep-navy gradient fallback — shown while WebP loads AND as the floor
 * layer when a scene falls back to generic or has no art yet. Matches
 * AC4 literally: #0a0e1a → #111827.
 */
const LOADING_GRADIENT = 'linear-gradient(180deg, #0a0e1a 0%, #111827 100%)';

/** Readability veil layered OVER the image — AC5. */
const VEIL = 'linear-gradient(rgba(5,10,20,0.45), rgba(5,10,20,0.45))';

/**
 * Returns CSSProperties for applying a full-viewport background image to
 * a container div. Includes gradient fallback, readability veil, cover
 * sizing, and an iOS-safe attachment strategy.
 *
 * The gradient sits in the base `background` layer (always visible) while
 * the WebP image + veil override it once loaded. If no image path resolves
 * (missing scene art AND missing generic set), the gradient remains — the
 * user never sees a blank rectangle.
 */
export function usePageBackground(options?: UsePageBackgroundOptions): CSSProperties {
  const hookPath = useResponsiveBackground(options?.scene);
  const webpPath = options?.src ?? hookPath;

  const isTouch =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  return {
    // Gradient floor — always painted first, visible while image loads or
    // when the hook returned no path (missing art + missing generic set).
    background: LOADING_GRADIENT,
    backgroundImage: webpPath ? `${VEIL}, url('${webpPath}'), ${LOADING_GRADIENT}` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: isTouch ? 'scroll' : 'fixed',
  };
}

/* ───────────────────────────────────────────────────────────────────────── */
/*  JSX component — used by auth pages and tests                            */
/* ───────────────────────────────────────────────────────────────────────── */

interface PageBackgroundProps {
  scene?: SceneKey;
  src?: string;
  /**
   * Test hook — renders a hidden marker instead of the real layered div.
   * Tests that assert path resolution set this to true; production never does.
   */
  marker?: boolean;
}

/**
 * PageBackground — renders a fixed, full-viewport layered div at
 * z-[var(--z-below)] behind all content. Apply on routes whose layout
 * does not already paint its own background via `usePageBackground()`.
 *
 * The `data-bg` attribute carries the resolved WebP path (used by tests
 * to assert path resolution, since jsdom does not parse complex
 * `background-image` values reliably).
 */
export function PageBackground({ scene, src, marker = false }: PageBackgroundProps) {
  const hookPath = useResponsiveBackground(scene);
  const webpPath = src ?? hookPath;

  // Legacy marker mode preserved so existing tests keep working without change.
  if (marker) {
    return <div data-testid="page-background" data-bg={webpPath} style={{ display: 'none' }} />;
  }

  const bgStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 'var(--z-below)' as unknown as number,
    pointerEvents: 'none',
    background: LOADING_GRADIENT,
    backgroundImage: webpPath ? `${VEIL}, url('${webpPath}'), ${LOADING_GRADIENT}` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
  };

  return (
    <>
      <div aria-hidden="true" data-testid="page-background" data-bg={webpPath} style={bgStyle} />
    </>
  );
}

export default PageBackground;
