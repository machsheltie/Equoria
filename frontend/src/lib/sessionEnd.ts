/**
 * sessionEnd — the one client-side path that ends a dead session
 * (Equoria-bvddn.29).
 *
 * `endSession` wipes every cached server value (identity, horses, balances) and
 * tells the router-side listener (ProtectedRoute) to send the player to /login
 * with a safe return path. The QueryClient cannot navigate by itself — it lives
 * above the router in App.tsx — so the navigation half is a small subscription.
 */

import type { QueryClient } from '@tanstack/react-query';

/**
 * Cross-tab logout signal (Equoria-bvddn.30). SettingsPage writes then removes
 * this key after a password change; the browser delivers a `storage` event to
 * every OTHER tab of this origin, and AuthProvider ends the session there.
 */
export const FORCE_LOGOUT_STORAGE_KEY = 'equoria:forceLogoutAt';

export type SessionEndReason = 'expired' | 'signed-out-elsewhere';

type SessionEndListener = (reason: SessionEndReason) => void;

const listeners = new Set<SessionEndListener>();

/** Subscribe to session ends. Returns the unsubscribe function. */
export function subscribeSessionEnd(listener: SessionEndListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * True for the 401 the transport throws after the refresh-token attempt failed
 * (`ApiError.sessionExpired`). A first 401 that the refresh single-flight
 * recovers never reaches React Query, and a 401 that survives a successful
 * refresh (or comes from login / MFA) is an ordinary error, not a dead session.
 */
export function isSessionExpiredError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { statusCode?: unknown; sessionExpired?: unknown };
  return candidate.statusCode === 401 && candidate.sessionExpired === true;
}

/** True while the cache still believes a player is signed in. */
export function hasCachedSession(queryClient: QueryClient): boolean {
  const profile = queryClient.getQueryData<{ user?: unknown }>(['profile']);
  return Boolean(profile?.user);
}

/** Clear every cached server value and notify the router-side listener. */
export function endSession(queryClient: QueryClient, reason: SessionEndReason): void {
  queryClient.clear();
  listeners.forEach((listener) => listener(reason));
}
