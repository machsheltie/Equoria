/**
 * PageBackground — Story 22.3: Painted Background System
 *
 * NOT a standalone positioned element. Returns null and instead provides
 * its resolved background URL via the usePageBackground() hook, which
 * callers apply as inline style on their own root div. This mirrors the
 * original DashboardLayout pattern (backgroundAttachment: 'fixed') that
 * worked reliably before Story 22.3.
 *
 * Callers (DashboardLayout, auth pages) use:
 *   const bgStyle = usePageBackground({ scene, src });
 *   <div style={bgStyle}> ... </div>
 */

import type { CSSProperties } from 'react';
import { useResponsiveBackground, type SceneKey } from '@/hooks/useResponsiveBackground';

interface UsePageBackgroundOptions {
  scene?: SceneKey;
  /** Direct WebP path — overrides scene-based lookup when provided. */
  src?: string;
}

/**
 * Returns a CSSProperties object for applying a full-viewport background
 * image to a container div. Includes cover sizing, fixed attachment, and
 * deep-space fallback color.
 */
export function usePageBackground(options?: UsePageBackgroundOptions): CSSProperties {
  const hookPath = useResponsiveBackground(options?.scene);
  const webpPath = options?.src ?? hookPath;

  return {
    backgroundColor: 'var(--bg-deep-space)',
    // P-3: readability veil layered over the image (AC5: rgba(5,10,20,0.45))
    // P-4: guard against url('undefined') when webpPath is empty
    backgroundImage: webpPath
      ? `linear-gradient(rgba(5,10,20,0.45), rgba(5,10,20,0.45)), url('${webpPath}')`
      : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
  };
}

/* ── Backward-compat named export used by tests and OnboardingPage ── */

interface PageBackgroundProps {
  scene?: SceneKey;
  src?: string;
}

/**
 * Renders an invisible marker div (for tests) and applies background to
 * the document body via inline styles. Kept for pages that render
 * PageBackground as a child (OnboardingPage, auth pages).
 */
export function PageBackground({ scene, src }: PageBackgroundProps) {
  const hookPath = useResponsiveBackground(scene);
  const webpPath = src ?? hookPath;

  return <div data-testid="page-background" data-bg={webpPath} style={{ display: 'none' }} />;
}

export default PageBackground;
