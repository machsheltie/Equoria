/**
 * PageBackground — Story 22.3: Painted Background System
 *
 * Sets the full-viewport background by writing directly to document.body
 * inline styles, which overrides the CSS gradient and avoids z-index
 * stacking-context conflicts with position:fixed elements.
 *
 * When `scene` is provided, resolves WebP art from:
 *   /images/backgrounds/{scene}/bg-{ratio}.webp
 *
 * When `src` is provided it is used as-is (bypasses scene lookup). Use this
 * for routes that already have dedicated artwork at a fixed path.
 *
 * When no art file exists the body keeps its CSS gradient fallback.
 *
 * A semi-transparent readability veil (rgba 5,10,20 at 0.45) is rendered
 * as a fixed overlay above the body background.
 */

import { useEffect } from 'react';
import { useResponsiveBackground, type SceneKey } from '@/hooks/useResponsiveBackground';

interface PageBackgroundProps {
  scene?: SceneKey;
  /** Direct WebP path — overrides scene-based lookup when provided. */
  src?: string;
  className?: string;
}

export function PageBackground({ scene, src, className }: PageBackgroundProps) {
  const hookPath = useResponsiveBackground(scene);
  const webpPath = src ?? hookPath;

  // Apply background directly to body — guaranteed to sit below all content
  // regardless of stacking contexts, and overrides the CSS gradient rule.
  useEffect(() => {
    const body = document.body;
    body.style.backgroundImage = `url('${webpPath}')`;
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundRepeat = 'no-repeat';
    body.style.backgroundAttachment = 'fixed';
    return () => {
      body.style.backgroundImage = '';
      body.style.backgroundSize = '';
      body.style.backgroundPosition = '';
      body.style.backgroundRepeat = '';
      body.style.backgroundAttachment = '';
    };
  }, [webpPath]);

  return (
    <div
      className={`fixed inset-0 pointer-events-none ${className ?? ''}`}
      aria-hidden="true"
      data-testid="page-background"
      style={{ zIndex: 1 }}
    >
      {/* Invisible — holds data-bg for test inspection of resolved path */}
      <div className="absolute inset-0" data-testid="page-background-image" data-bg={webpPath} />
      {/* Readability veil — deepens contrast between background art and UI */}
      <div
        className="absolute inset-0"
        data-testid="page-background-veil"
        style={{ backgroundColor: 'rgba(5, 10, 20, 0.45)' }}
      />
    </div>
  );
}

export default PageBackground;
