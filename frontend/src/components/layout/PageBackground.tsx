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
    // Readability veil layered over the image (AC5: rgba(5,10,20,0.45)).
    // Simple url() for maximum browser compatibility — no image-set() type() hints
    // which require Chrome 113+/Safari 17.2+ and need JPEG fallback files to exist.
    // Guard against url('undefined') when webpPath is empty.
    backgroundImage: webpPath
      ? `linear-gradient(rgba(5,10,20,0.45), rgba(5,10,20,0.45)), url('${webpPath}')`
      : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    // iOS Safari ignores background-attachment: fixed — use scroll on touch devices
    // so the background behaves consistently rather than silently falling back.
    backgroundAttachment:
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches
        ? 'scroll'
        : 'fixed',
  };
}

/* ── Backward-compat named export used by tests and OnboardingPage ── */

interface PageBackgroundProps {
  scene?: SceneKey;
  src?: string;
}

/**
 * Renders an invisible marker div carrying the resolved WebP path in
 * `data-bg` (used by tests to assert resolved paths without relying on
 * jsdom's incomplete backgroundImage parsing). Does NOT apply any style to
 * document.body — callers that need the background should use
 * `usePageBackground()` instead.
 */
export function PageBackground({ scene, src }: PageBackgroundProps) {
  const hookPath = useResponsiveBackground(scene);
  const webpPath = src ?? hookPath;

  return <div data-testid="page-background" data-bg={webpPath} style={{ display: 'none' }} />;
}

export default PageBackground;
