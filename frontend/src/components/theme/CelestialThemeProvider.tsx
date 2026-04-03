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

export function CelestialThemeProvider() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Apply body.celestial synchronously before first paint — prevents FOUC
  useLayoutEffect(() => {
    const param = searchParams.get('theme');
    const stored = localStorage.getItem(THEME_KEY);
    const shouldBeCelestial =
      param === 'celestial' || (param !== 'default' && stored !== 'default');

    if (shouldBeCelestial) {
      document.body.classList.add('celestial');
    } else {
      document.body.classList.remove('celestial');
    }
  }, [searchParams]);

  // Side effects: localStorage writes, URL cleanup, welcome toast
  useEffect(() => {
    const param = searchParams.get('theme');

    if (param === 'celestial') {
      localStorage.setItem(THEME_KEY, 'celestial');
      const next = new URLSearchParams(searchParams);
      next.delete('theme');
      setSearchParams(next, { replace: true });
    } else if (param === 'default') {
      localStorage.setItem(THEME_KEY, 'default');
      const next = new URLSearchParams(searchParams);
      next.delete('theme');
      setSearchParams(next, { replace: true });
    } else {
      const stored = localStorage.getItem(THEME_KEY);

      // First-time visitor with no stored preference — show welcome toast once
      if (stored === null) {
        const alreadyShown = localStorage.getItem(WELCOME_SHOWN_KEY);
        if (!alreadyShown) {
          localStorage.setItem(WELCOME_SHOWN_KEY, 'true');
          toast('Equoria has a new look! Use ?theme=default in the URL to revert.');
        }
      }
    }
  }, [searchParams, setSearchParams]);

  return null;
}
