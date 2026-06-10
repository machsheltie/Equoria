/**
 * ContextualBottomActions — single contextual bottom-action slot owned by
 * DashboardLayout (Equoria-o5hub.5, handoff §6.9 / D-24).
 *
 * Problem this solves: BottomNav (fixed, mobile-only) and per-page action
 * bars (HorseActionBar's old createPortal-to-body + fixed + z-modal) used to
 * independently occupy the viewport bottom — the action bar covered the nav
 * on mobile, the layout's content padding only reserved space for the nav,
 * and z-modal incorrectly layered the bar above dialogs.
 *
 * Design: a page wraps its action bar in <ContextualBottomActions> …
 * </ContextualBottomActions>. The children are PORTALED into a fixed slot
 * that DashboardLayout renders stacked ABOVE BottomNav on mobile and at the
 * viewport bottom (above the safe-area inset) on desktop, at the --z-nav
 * tier so dialogs (--z-modal) layer above it. Registration is tracked with
 * a mount counter so DashboardLayout can switch its content-bottom padding
 * to the combined nav+actions reservation while a bar is registered.
 *
 * Why a portal-slot instead of useContextualBottomActions(node)?
 * Passing a ReactNode through context state re-registers on every render
 * (JSX identity changes each render → setState loop hazard) and detaches
 * the bar from its owning page's context/providers. Portaling keeps the
 * bar inside the page's React tree (React Query, router, auth contexts all
 * intact) while only a stable boolean crosses the layout boundary.
 *
 * FALLBACK: when no provider is mounted (direct page renders in vitest,
 * isolated component tests), children render in place so the bar never
 * silently disappears.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface ContextualBottomActionsContextValue {
  /** Fixed slot element rendered by DashboardLayout (null until mounted). */
  container: HTMLElement | null;
  /** Register a consumer; returns the matching unregister cleanup. */
  register: () => () => void;
}

const ContextualBottomActionsContext = createContext<ContextualBottomActionsContextValue | null>(
  null
);

/**
 * Host hook — used ONLY by DashboardLayout. Owns the registration counter
 * and the slot element. The layout:
 *   1. wraps its tree in <ContextualBottomActionsProvider value={contextValue}>
 *   2. reads `hasActions` to switch the content-bottom reservation padding
 *   3. renders the fixed slot div with `ref={setContainer}` when hasActions
 */
export function useContextualBottomActionsHost() {
  const [registrations, setRegistrations] = useState(0);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  // Stable identity — consumers depend on it in an effect, so it must not
  // change across host re-renders (would churn register/unregister).
  const register = useCallback(() => {
    setRegistrations((count) => count + 1);
    return () => setRegistrations((count) => count - 1);
  }, []);

  const contextValue = useMemo<ContextualBottomActionsContextValue>(
    () => ({ container, register }),
    [container, register]
  );

  return { hasActions: registrations > 0, setContainer, contextValue } as const;
}

export const ContextualBottomActionsProvider = ContextualBottomActionsContext.Provider;

interface ContextualBottomActionsProps {
  children: ReactNode;
}

/**
 * Page-side registration component. Mounting it registers a contextual
 * action bar with DashboardLayout (which reserves content space and renders
 * the fixed slot); unmounting unregisters and the layout reverts to its
 * default padding. Children portal into the layout slot.
 *
 * Without a provider (tests rendering a page directly), children render
 * in place — all testids and behavior remain reachable.
 */
export function ContextualBottomActions({ children }: ContextualBottomActionsProps) {
  const ctx = useContext(ContextualBottomActionsContext);
  const register = ctx?.register;

  useEffect(() => {
    if (!register) return undefined;
    return register();
  }, [register]);

  // FALLBACK — no DashboardLayout provider: render in place.
  if (!ctx) {
    return <>{children}</>;
  }

  // Provider present but the slot has not mounted yet (the layout renders
  // it on the next pass after registration lands). Nothing this frame.
  if (!ctx.container) {
    return null;
  }

  return createPortal(children, ctx.container);
}

export default ContextualBottomActions;
