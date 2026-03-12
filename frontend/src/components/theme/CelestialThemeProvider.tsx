/**
 * CelestialThemeProvider (Task 22-2)
 *
 * Applies `body.celestial` class which scopes Celestial Night design tokens.
 * Activation order (first match wins):
 *   1. URL param: ?theme=celestial  (persists to localStorage)
 *   2. URL param: ?theme=default    (clears localStorage)
 *   3. localStorage 'equoria-theme'
 *   4. Default: celestial (true)
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function CelestialThemeProvider() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const param = searchParams.get('theme');

    if (param === 'celestial') {
      localStorage.setItem('equoria-theme', 'celestial');
      document.body.classList.add('celestial');
      // Clean the param from URL without navigation
      const next = new URLSearchParams(searchParams);
      next.delete('theme');
      setSearchParams(next, { replace: true });
    } else if (param === 'default') {
      localStorage.setItem('equoria-theme', 'default');
      document.body.classList.remove('celestial');
      const next = new URLSearchParams(searchParams);
      next.delete('theme');
      setSearchParams(next, { replace: true });
    } else {
      // Fall back to localStorage, default to celestial
      const stored = localStorage.getItem('equoria-theme');
      if (stored !== 'default') {
        document.body.classList.add('celestial');
      } else {
        document.body.classList.remove('celestial');
      }
    }
  }, [searchParams, setSearchParams]);

  return null;
}
