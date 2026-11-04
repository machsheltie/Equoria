/**
 * CelestialThemeProvider (Story 22-2, patched 22-4)
 *
 * Applies `body.celestial` class which scopes Celestial Night design tokens.
 * Activation order (first match wins):
 *   1. URL param: ?theme=celestial  (persists to localStorage)
 *   2. URL param: ?theme=default    (clears localStorage)
 *   3. localStorage 'equoria-theme'
 *   4. Default: celestial (true)
 *
 * There is no welcome announcement. The pre-Epic-22 "new look" toast was removed
 * with the toast layer (owner ruling q173: the page itself changes, no pop-ups);
 * the new look is its own announcement.
 *
 * Implementation note: The body class is applied via useLayoutEffect (not useEffect)
 * so it fires synchronously before the first paint. This prevents a flash of unstyled
 * content (FOUC) where glass panels briefly render without their frosted-glass blur.
 * Side effects (URL cleanup, localStorage writes) remain in useEffect.
 */

import { useEffect, useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router';

const themeKey = 'equoria-theme';

/**
 * Read a localStorage value safely — returns null on access error
 * (iOS private browsing, sandboxed iframes, storage quota exceeded).
 */
function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Derive whether the Celestial Night theme should be active from the
 * URL param and stored preference. Single source of truth used by both
 * useLayoutEffect (DOM class) and useEffect (side effects).
 */
function deriveTheme(themeParam: string | null): 'celestial' | 'default' {
  const stored = safeLocalStorageGet(themeKey);
  if (themeParam === 'celestial') return 'celestial';
  if (themeParam === 'default') return 'default';
  if (stored === 'default') return 'default';
  return 'celestial'; // default-on
}

export function CelestialThemeProvider() {
  const [searchParams, setSearchParams] = useSearchParams();
  const themeParam = searchParams.get('theme');

  // Apply body.celestial synchronously before first paint — prevents FOUC.
  // Depends on themeParam only (not the full searchParams object) so unrelated
  // URL param changes (pagination, filters) do not trigger a layout-blocking DOM op.
  useLayoutEffect(() => {
    const theme = deriveTheme(themeParam);
    if (theme === 'celestial') {
      document.body.classList.add('celestial');
    } else {
      document.body.classList.remove('celestial');
    }
  }, [themeParam]);

  // Side effects: localStorage writes, URL cleanup
  useEffect(() => {
    if (themeParam === 'celestial') {
      try {
        localStorage.setItem(themeKey, 'celestial');
      } catch {
        /* quota / private browsing */
      }
      const next = new URLSearchParams(searchParams);
      next.delete('theme');
      setSearchParams(next, { replace: true });
    } else if (themeParam === 'default') {
      try {
        localStorage.setItem(themeKey, 'default');
      } catch {
        /* quota / private browsing */
      }
      const next = new URLSearchParams(searchParams);
      next.delete('theme');
      setSearchParams(next, { replace: true });
    }
  }, [themeParam, searchParams, setSearchParams]);

  return null;
}
