/**
 * AuthSessionState — CSRF and access-token session state for the frontend API client.
 *
 * Extracted as a standalone module so Vitest tests can inspect and reset state
 * independently of the full api-client module.
 *
 * invalidate(): clear CSRF state so the next mutation re-fetches a fresh token.
 *   Call after a successful access-token refresh — the new token is issued for a new
 *   session context and the cached CSRF may be stale.
 *
 * clear(): wipe all session state. Call on auth failure (refresh rejected, 401 after
 *   retry) — the session is dead and every cached value must be discarded.
 *
 * 21R-AUTH-5 (Equoria-wv0)
 */

export interface IAuthSessionState {
  csrfToken: string | null;
  csrfFetching: Promise<string> | null;
  accessTokenExpiry: number | null; // ms timestamp; null = unknown / not yet tracked
  invalidate(): void;
  clear(): void;
}

const authSessionState: IAuthSessionState = {
  csrfToken: null,
  csrfFetching: null,
  accessTokenExpiry: null,

  invalidate() {
    this.csrfToken = null;
    this.csrfFetching = null;
    // accessTokenExpiry is unchanged — the token was successfully refreshed
  },

  clear() {
    this.csrfToken = null;
    this.csrfFetching = null;
    this.accessTokenExpiry = null;
  },
};

export default authSessionState;
