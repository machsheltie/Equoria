/**
 * Display preferences (Equoria-apfwp, ACC-04).
 *
 * Owner ruling 2026-10-28 (q247): the three Display switches in Settings must
 * work. Each one is written to the document root as a data attribute, and the
 * stylesheet `styles/displayPreferences.css` gives the attribute its effect:
 *
 *   reducedMotion → data-reduced-motion="true"   (motion policy, MOTION.md)
 *   highContrast  → data-high-contrast="true"    (stronger text, borders, panels)
 *   compactCards  → data-compact-cards="true"    (read by the Horse Roster cards)
 *
 * An attribute is present only while its switch is on; signing out removes all three.
 */

import type { UserPreferences } from '@/lib/api-client';

export type DisplayKey = 'reducedMotion' | 'highContrast' | 'compactCards';

export const displayKeys: readonly DisplayKey[] = ['reducedMotion', 'highContrast', 'compactCards'];

/** Apply the player's display switches to the document root. */
export function applyDisplayPreferences(
  preferences: Partial<UserPreferences> | null | undefined,
  root: HTMLElement = document.documentElement
): void {
  for (const key of displayKeys) {
    if (preferences?.[key] === true) {
      root.dataset[key] = 'true';
    } else {
      delete root.dataset[key];
    }
  }
}

/**
 * Whether motion should be reduced: the player's Settings switch, or the
 * operating system's reduced-motion preference.
 */
export function prefersReducedMotion(): boolean {
  if (
    typeof document !== 'undefined' &&
    document.documentElement.dataset.reducedMotion === 'true'
  ) {
    return true;
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    // Environment guard: a browser that cannot evaluate the query has no OS preference to honour.
    return false;
  }
}
