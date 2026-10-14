/**
 * StewardGate — the only door to the Steward's Office (STAFF-CR-17,
 * docs/features/staff-foundation.md "The Steward's Office page").
 *
 * For anyone who is not known to be staff, /steward must render and navigate
 * exactly like an address that does not exist: the same element as the
 * catch-all route (NotFoundPage), no redirect, no history entry, no login
 * prompt. So the gate sits above the authenticated shell and decides first:
 *
 * - Signed out, or the session still loading → not found. /staff/me is never
 *   asked, so a signed-out visit has no auth side effects either.
 * - Signed in → ask GET /staff/me. Until it answers, and for any answer but
 *   success (404 for a player, a lapsed session, an outage) → not found.
 * - Staff → the authenticated shell and the office (`children`).
 * - A steward revoked mid-visit: the next /me read answers 404 and the office
 *   is replaced by not found in place; the address does not change.
 *
 * The gate holds the one /me observer and hands it down, so mounting the
 * office does not ask /me a second time.
 *
 * Eagerly imported by App.tsx: a lazy import would show the shared loader
 * here and not at an unknown address.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { statusOf, useStaffMe } from '@/hooks/api/useStaff';
import NotFoundPage from '@/pages/NotFoundPage';

type StaffMeQuery = ReturnType<typeof useStaffMe>;

const StaffMeContext = createContext<StaffMeQuery | null>(null);

/** The gate's /me query, for the office inside it. */
export function useGatedStaffMe(): StaffMeQuery {
  const me = useContext(StaffMeContext);
  if (me === null) {
    throw new Error("The Steward's Office must be rendered inside StewardGate.");
  }
  return me;
}

export default function StewardGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const signedIn = !isLoading && !!user;
  const me = useStaffMe(signedIn);

  if (!signedIn || statusOf(me.error) === 404 || !me.data) {
    return <NotFoundPage />;
  }
  return <StaffMeContext.Provider value={me}>{children}</StaffMeContext.Provider>;
}
