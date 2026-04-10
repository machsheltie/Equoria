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
 * Welcome toast: shown once to users with no prior theme preference (pre-Epic-22
 * players). Tracked via localStorage key 'equoria-theme-welcome-shown'.
 *
 * Implementation note: The body class is applied via useLayoutEffect (not useEffect)
 * so it fires synchronously before the first paint. This prevents a flash of unstyled
 * content (FOUC) where glass panels briefly render without their frosted-glass blur.
 * Side effects (URL cleanup, localStorage writes, toast) remain in useEffect.
 */

import { useEffect, useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

const THEME_KEY = 'equoria-theme';
const WELCOME_SHOWN_KEY = 'equoria-theme-welcome-shown';

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
  const stored = safeLocalStorageGet(THEME_KEY);
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

  // Side effects: localStorage writes, URL cleanup, welcome toast
  useEffect(() => {
    if (themeParam === 'celestial') {
      try {
        localStorage.setItem(THEME_KEY, 'celestial');
      } catch {
        /* quota / private browsing */
      }
      const next = new URLSearchParams(searchParams);
      next.delete('theme');
      setSearchParams(next, { replace: true });
    } else if (themeParam === 'default') {
      try {
        localStorage.setItem(THEME_KEY, 'default');
      } catch {
        /* quota / private browsing */
      }
      const next = new URLSearchParams(searchParams);
      next.delete('theme');
      setSearchParams(next, { replace: true });
    } else {
      const stored = safeLocalStorageGet(THEME_KEY);

      // First-time visitor with no stored preference — show welcome toast once
      if (stored === null) {
        const alreadyShown = safeLocalStorageGet(WELCOME_SHOWN_KEY);
        if (!alreadyShown) {
          try {
            localStorage.setItem(WELCOME_SHOWN_KEY, 'true');
          } catch {
            // Storage write failure is non-fatal — toast may re-appear on next visit
          }
          toast('Equoria has a new look! Use ?theme=default in the URL to revert.');
        }
      }
    }
  }, [themeParam, searchParams, setSearchParams]);

  return null;
}
