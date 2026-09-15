/**
 * Shared-session keep-alive for the main Playwright profile (Equoria-oye1a).
 *
 * global-setup.ts registers the shared E2E player and writes ONE
 * storageState.json. Every browser context and every APIRequestContext in the
 * run is built from that file. The accessToken cookie it captures carries a
 * 15-minute maxAge (ACCESS_TOKEN_TTL_MS, backend/utils/cookieConfig.mjs) while
 * the full suite runs for ~22 minutes, so from T+15m onward every new context
 * started life logged out:
 *
 *   - APIRequestContexts 401'd immediately with "Access token is required"
 *     (CI run 34831357540: rider-dismiss, rider-trainer-unassign x2,
 *     training-flow).
 *   - Browser contexts tried the frontend's silent refresh, but the single
 *     stored refreshToken is rotated on first use with reuse detection, so
 *     exactly one context could recover and every later one got
 *     "Token reuse detected" (172 of them in that run) and rendered logged-out
 *     pages — the "element(s) not found" tail after 10:36:30.
 *
 * The fix keeps the SHARED session live for the whole run by signing in again
 * through the real production login route on a timer, well inside the token's
 * lifetime, and rewriting storageState.json atomically with the fresh cookies.
 * Origins (localStorage) are preserved so UI state captured during onboarding
 * — e.g. equoria-theme-welcome-shown — is not lost. No bypass header, no route
 * interception, no mock: the same POST the login form makes.
 */

import { request as playwrightRequest } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Renew comfortably inside the 15-minute access-token cookie lifetime so a
// context created at any instant always reads a live token. E2E_SESSION_RENEW_MS
// exists so the renewal path can be exercised without waiting ten minutes; it
// changes only how often the real login runs, never what it does.
const RENEW_INTERVAL_MS = Number(process.env.E2E_SESSION_RENEW_MS ?? 10 * 60 * 1000);

type KeepAliveOptions = {
  baseURL: string;
  storageStatePath: string;
  email: string;
  password: string;
};

/** Replace the cookies in the storageState file, keeping its origins. */
function writeRenewedCookies(storageStatePath: string, cookies: unknown): void {
  const current = JSON.parse(fs.readFileSync(storageStatePath, 'utf8'));
  const next = { ...current, cookies };
  const tmp = path.join(
    path.dirname(storageStatePath),
    `.${path.basename(storageStatePath)}.renew-${process.pid}.tmp`
  );
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  // Atomic replace — a worker reading the file concurrently sees either the
  // previous complete state or the new one, never a torn file.
  fs.renameSync(tmp, storageStatePath);
}

/** Sign in again and refresh the stored cookies. Throws on a failed login. */
export async function renewSharedSession({
  baseURL,
  storageStatePath,
  email,
  password,
}: KeepAliveOptions): Promise<void> {
  const context = await playwrightRequest.newContext({ baseURL });
  try {
    const login = await context.post('/api/v1/auth/login', { data: { email, password } });
    if (!login.ok()) {
      throw new Error(
        `session keep-alive: POST /api/v1/auth/login returned ${login.status()} — ${await login.text()}`
      );
    }
    const fresh = await context.storageState();
    writeRenewedCookies(storageStatePath, fresh.cookies);
  } finally {
    await context.dispose();
  }
}

/**
 * Start the renewal timer. Returns a stop function. The timer is unref'd so it
 * never keeps the Playwright process alive past the run.
 */
export function startSessionKeepAlive(options: KeepAliveOptions): () => void {
  const timer = setInterval(() => {
    renewSharedSession(options)
      .then(() => console.log('[session-keep-alive] storageState renewed.'))
      .catch((err) =>
        // Loud, but non-fatal: createAuthedSession() re-authenticates its own
        // context as a second line of defence, and a spec that really cannot
        // authenticate still fails its own assertions rather than being
        // silently skipped.
        console.error(`[session-keep-alive] renewal FAILED: ${(err as Error).message}`)
      );
  }, RENEW_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
