/**
 * useMediaQuery — SSR-safe matchMedia hook (Story 22-8)
 *
 * Returns a boolean reflecting whether the current viewport matches the
 * supplied media query string. During SSR / initial render (before hydration)
 * it returns `false` to avoid mismatched HTML between server and client.
 *
 * Usage:
 *   const isDesktop = useMediaQuery('(min-width: 1024px)');
 *   const isMobile  = useMediaQuery('(max-width: 767px)');
 */

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const getMatch = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState<boolean>(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);

    // Sync in case viewport changed between initial render and effect mount
    setMatches(mediaQueryList.matches);

    // addEventListener is the modern API; older Safari needs addListener.
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', listener);
      return () => mediaQueryList.removeEventListener('change', listener);
    }
    // Legacy fallback
    mediaQueryList.addListener(listener);
    return () => mediaQueryList.removeListener(listener);
  }, [query]);

  return matches;
}

export default useMediaQuery;
