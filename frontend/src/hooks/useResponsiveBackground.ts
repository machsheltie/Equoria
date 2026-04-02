/**
 * useResponsiveBackground Hook
 *
 * Detects the viewport aspect ratio and returns the best-matching
 * background image WebP path from the pre-generated set of files.
 *
 * Supported ratios (sorted widest → tallest):
 *   21:9  → ultrawide monitors
 *   16:9  → standard laptops/desktops, TVs
 *    3:2  → MacBooks, Surface laptops
 *    4:3  → iPads, older monitors
 *    1:1  → iPad split-view, foldables
 *    9:16 → phones (portrait)
 *
 * When `scene` is provided, paths resolve to:
 *   /images/backgrounds/{scene}/bg-{ratio}.webp
 * When omitted, falls back to the generic:
 *   /images/bg-{ratio}.webp  (backward-compatible)
 */

import { useState, useEffect } from 'react';

/**
 * Scene keys for painted background art — Story 22.3.
 * Each key maps to a directory under /images/backgrounds/{scene}/.
 * Art assets are committed as they are painted; missing scenes fall
 * back to var(--bg-deep-space) background-color in PageBackground.
 */
export type SceneKey =
  | 'auth'
  | 'hub'
  | 'stable'
  | 'horse-detail'
  | 'training'
  | 'competition'
  | 'breeding'
  | 'world'
  | 'default';

/** Ratio descriptor — numeric value + file suffix */
const RATIO_OPTIONS = [
  { ratio: 21 / 9, suffix: '21.9' },
  { ratio: 16 / 9, suffix: '16.9' },
  { ratio: 3 / 2, suffix: '3.2' },
  { ratio: 4 / 3, suffix: '4.3' },
  { ratio: 1 / 1, suffix: '1.1' },
  { ratio: 9 / 16, suffix: '9.16' },
];

/** Pick the closest-ratio suffix to the current viewport */
function selectSuffix(): string {
  const viewportRatio = window.innerWidth / window.innerHeight;

  let best = RATIO_OPTIONS[0];
  let bestDiff = Math.abs(viewportRatio - best.ratio);

  for (let i = 1; i < RATIO_OPTIONS.length; i++) {
    const diff = Math.abs(viewportRatio - RATIO_OPTIONS[i].ratio);
    if (diff < bestDiff) {
      best = RATIO_OPTIONS[i];
      bestDiff = diff;
    }
  }

  return best.suffix;
}

/**
 * Returns the WebP URL for the background image that best matches the
 * current viewport aspect ratio. Re-evaluates on window resize.
 *
 * @param scene  Optional scene key. When provided, resolves to
 *               `/images/backgrounds/{scene}/bg-{ratio}.webp`.
 *               When omitted, resolves to `/images/bg-{ratio}.webp`
 *               (backward-compatible with pre-Story-22.3 consumers).
 */
export function useResponsiveBackground(scene?: SceneKey): string {
  const buildPath = (suffix: string) =>
    scene ? `/images/backgrounds/${scene}/bg-${suffix}.webp` : `/images/bg-${suffix}.webp`;

  const [bg, setBg] = useState(() => buildPath(selectSuffix()));

  useEffect(() => {
    const onResize = () => {
      setBg(buildPath(selectSuffix()));
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [scene]);

  return bg;
}

export default useResponsiveBackground;
