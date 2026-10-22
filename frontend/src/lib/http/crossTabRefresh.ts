/**
 * Cross-tab ordering for the session refresh (Equoria-jwfzj).
 *
 * The server treats a refresh token as single-use: of two refreshes that present
 * the same refresh cookie, one wins; the other is answered 401, or, if it lands
 * after the winner committed, trips reuse detection and revokes the whole token
 * family. Within one tab `refreshAccessToken` is single-flight. Two tabs of the
 * same browser share one cookie jar but not module state, so when the access
 * cookie expires, both tabs 401 together and both POST the same refresh cookie.
 * The loser's transport then ended its session and sent the player to /login
 * although the cookie jar held a valid, freshly rotated session.
 *
 * The Web Locks API gives every tab of an origin one queue. Inside the lock a
 * tab first asks whether another tab already refreshed AFTER this tab started
 * waiting; if so the cookie jar is already fresh and the tab just replays its
 * request. Otherwise it refreshes with the cookie the jar holds NOW, which is the
 * rotated one, so sequential rotations are all legitimate.
 *
 * Where Web Locks are unavailable (very old browsers, jsdom) the refresh runs
 * directly: the previous behaviour, never a failure.
 */

/** Same-origin hand-off between tabs: when the last successful refresh finished. */
const LAST_REFRESH_KEY = 'equoria:lastRefreshAt';
const REFRESH_LOCK_NAME = 'equoria:auth-refresh';

function readLastRefreshAt(): number {
  try {
    const raw = window.localStorage.getItem(LAST_REFRESH_KEY);
    const value = raw === null ? 0 : Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    // Storage can be blocked (private window, site data off): no hand-off, so
    // the tab simply refreshes itself, which is safe inside the lock.
    return 0;
  }
}

function writeLastRefreshAt(at: number): void {
  try {
    window.localStorage.setItem(LAST_REFRESH_KEY, String(at));
  } catch {
    // Same as above: the hand-off is an optimisation, never required.
  }
}

function getLockManager(): LockManager | null {
  if (typeof navigator === 'undefined') return null;
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  return locks && typeof locks.request === 'function' ? locks : null;
}

/**
 * Run `refresh` so that no two tabs of this browser refresh at once.
 * Resolves to the refresh outcome, or `true` when another tab refreshed the
 * session while this one waited.
 */
export async function refreshAcrossTabs(refresh: () => Promise<boolean>): Promise<boolean> {
  const locks = getLockManager();
  if (!locks) return refresh();

  const requestedAt = Date.now();
  return locks.request(REFRESH_LOCK_NAME, async () => {
    if (readLastRefreshAt() >= requestedAt) return true;
    const refreshed = await refresh();
    if (refreshed) writeLastRefreshAt(Date.now());
    return refreshed;
  });
}
