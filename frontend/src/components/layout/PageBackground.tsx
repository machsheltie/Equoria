/**
 * PageBackground — Story 22.3: Painted Background System
 *
 * Full-viewport fixed background that renders at z-[var(--z-below)] (-1)
 * behind all page content. Replaces StarField + StarfieldBackground.
 *
 * When `scene` is provided, resolves WebP art from:
 *   /images/backgrounds/{scene}/bg-{ratio}.webp
 *
 * When `src` is provided it is used as-is (bypasses scene lookup). Use this
 * for routes that already have dedicated artwork at a fixed path — e.g.
 * `/images/bg-stable.webp`.
 *
 * When no art exists, the deep-space background-color (var(--bg-deep-space))
 * shows — no broken images.
 *
 * A semi-transparent readability veil (rgba 5,10,20 at 0.45) overlays
 * the background to maintain content legibility.
 */

import { useResponsiveBackground, type SceneKey } from '@/hooks/useResponsiveBackground';

interface PageBackgroundProps {
  scene?: SceneKey;
  /** Direct WebP path — overrides scene-based lookup when provided. */
  src?: string;
  className?: string;
}

/**
 * Build the CSS background-image value. Uses url() directly — WebP is
 * universally supported in 2025+ browsers. The backgroundColor fallback
 * (var(--bg-deep-space)) shows when the file doesn't exist yet.
 */
function buildBackgroundImage(webpPath: string): string {
  return `url('${webpPath}')`;
}

export function PageBackground({ scene, src, className }: PageBackgroundProps) {
  // Hook must always be called (React rules). When `src` is provided, its
  // result is ignored in favour of the explicit path.
  const hookPath = useResponsiveBackground(scene);
  const webpPath = src ?? hookPath;

  return (
    <div
      className={`fixed inset-0 z-[var(--z-base)] pointer-events-none ${className ?? ''}`}
      aria-hidden="true"
      data-testid="page-background"
    >
      {/* Background image layer — falls back to --bg-deep-space when art is absent */}
      <div
        className="absolute inset-0"
        data-testid="page-background-image"
        data-bg={webpPath}
        style={{
          backgroundColor: 'var(--bg-deep-space)',
          backgroundImage: buildBackgroundImage(webpPath),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {/* Readability veil — deepens contrast between background art and UI panels */}
      <div
        className="absolute inset-0"
        data-testid="page-background-veil"
        style={{ backgroundColor: 'rgba(5,10,20,0.45)' }}
      />
    </div>
  );
}

export default PageBackground;
