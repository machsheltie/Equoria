/**
 * CelestialThemeProvider (Story 22-2)
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
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

const THEME_KEY = 'equoria-theme';
const WELCOME_SHOWN_KEY = 'equoria-theme-welcome-shown';

export function CelestialThemeProvider() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const param = searchParams.get('theme');

    if (param === 'celestial') {
      localStorage.setItem(THEME_KEY, 'celestial');
      document.body.classList.add('celestial');
      // Clean the param from URL without navigation
      const next = new URLSearchParams(searchParams);
      next.delete('theme');
      setSearchParams(next, { replace: true });
    } else if (param === 'default') {
      localStorage.setItem(THEME_KEY, 'default');
      document.body.classList.remove('celestial');
      const next = new URLSearchParams(searchParams);
      next.delete('theme');
      setSearchParams(next, { replace: true });
    } else {
      const stored = localStorage.getItem(THEME_KEY);

      if (stored !== 'default') {
        document.body.classList.add('celestial');

        // First-time visitor with no stored preference — show welcome toast once
        if (stored === null) {
          const alreadyShown = localStorage.getItem(WELCOME_SHOWN_KEY);
          if (!alreadyShown) {
            localStorage.setItem(WELCOME_SHOWN_KEY, 'true');
            toast('Equoria has a new look! Use ?theme=default in the URL to revert.');
          }
        }
      } else {
        document.body.classList.remove('celestial');
      }
    }
  }, [searchParams, setSearchParams]);

  return null;
}
