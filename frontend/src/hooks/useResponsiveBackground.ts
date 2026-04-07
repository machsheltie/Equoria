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
 * When `scene` is in SCENES_WITH_ART, paths resolve to:
 *   /images/backgrounds/{scene}/bg-{ratio}.webp
 * Otherwise (no scene, scene='default', or scene art not yet delivered),
 * ALWAYS falls back to the generic set that is guaranteed to exist:
 *   /images/bg-{ratio}.webp
 */

import { useState, useEffect } from 'react';

/**
 * Scene keys for painted background art — Story 22.3.
 * Each key maps to a directory under /images/backgrounds/{scene}/.
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

/**
 * SCENES WITH ART ASSETS — the only scenes that have image files in
 * /public/images/backgrounds/{scene}/bg-{ratio}.webp.
 *
 * ⚠️  IMPORTANT: When new scene art is delivered, ADD THE SCENE KEY HERE.
 * Any scene NOT in this set falls back to the generic /images/bg-{ratio}.webp
 * files so a background is always shown rather than a blank page.
 *
 * Current state (2026-04-07):
 *   - 'auth'        → ✅ Art committed (story 22-7 placeholders)
 *   - 'hub'         → ❌ No art yet — falls back to generic
 *   - 'stable'      → ❌ No art yet — falls back to generic
 *   - 'horse-detail'→ ❌ No art yet — falls back to generic
 *   - 'training'    → ❌ No art yet — falls back to generic
 *   - 'competition' → ❌ No art yet — falls back to generic
 *   - 'breeding'    → ❌ No art yet — falls back to generic
 *   - 'world'       → ❌ No art yet — falls back to generic
 *
 * Generic files that DO exist (always used as fallback):
 *   /images/bg-16.9.webp, bg-21.9.webp, bg-3.2.webp, bg-4.3.webp,
 *   bg-1.1.webp, bg-9.16.webp
 */
const SCENES_WITH_ART = new Set<SceneKey>([
  // Add scene keys here as art assets are committed:
  'auth',
  // 'hub',
]);

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
  // D-2: guard against innerHeight === 0 (abnormal browser state) to prevent Infinity ratio
  const viewportRatio = window.innerWidth / (window.innerHeight || 1);

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
 * @param scene  Optional scene key. When a scene is in SCENES_WITH_ART,
 *               resolves to `/images/backgrounds/{scene}/bg-{ratio}.webp`.
 *               Otherwise (scene missing, 'default', or not yet delivered)
 *               falls back to `/images/bg-{ratio}.webp` — the generic set
 *               that always exists. This guarantees a background is always
 *               shown even when scene-specific art hasn't been created yet.
 */
export function useResponsiveBackground(scene?: SceneKey): string {
  const [bg, setBg] = useState(() => {
    const suffix = selectSuffix();
    const useScene = scene && scene !== 'default' && SCENES_WITH_ART.has(scene);
    return useScene
      ? `/images/backgrounds/${scene}/bg-${suffix}.webp`
      : `/images/bg-${suffix}.webp`;
  });

  useEffect(() => {
    // buildPath defined inside the effect so the resize debounce always closes
    // over the scene value that was current when this effect ran — preventing
    // in-flight debounces from firing with a previous scene's path.
    const useScene = scene && scene !== 'default' && SCENES_WITH_ART.has(scene);
    const buildPath = (suffix: string) =>
      useScene ? `/images/backgrounds/${scene}/bg-${suffix}.webp` : `/images/bg-${suffix}.webp`;

    // Update immediately on scene change (navigation doesn't trigger resize)
    setBg(buildPath(selectSuffix()));

    // Debounce resize — avoids per-pixel re-renders when dragging window edge
    let debounceId: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        setBg(buildPath(selectSuffix()));
      }, 150);
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(debounceId);
    };
  }, [scene]);

  return bg;
}

export default useResponsiveBackground;
