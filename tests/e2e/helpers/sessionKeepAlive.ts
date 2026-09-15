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
 * through the real production login route, well inside the token's lifetime,
 * and rewriting storageState.json atomically with the fresh cookies. Origins
 * (localStorage) are preserved so UI state captured during onboarding — e.g.
 * equoria-theme-welcome-shown — is not lost. No bypass header, no route
 * interception, no mock: the same POST the login form makes.
 *
 * WORST-CASE FRESHNESS. The renewal interval is 10 minutes against a 15-minute
 * cookie, so the margin a context actually gets is 5 minutes, NOT 10: a context
 * created one second before a renewal reads the previous cookies and expires
 * five minutes later. With per-test timeouts at 60-90s that is ample, but it is
 * the number to reason with — shortening the cookie TTL below ~6 minutes would
 * require shortening this interval too.
 *
 * WHY ONLY THE NEWEST STATE IS TRUSTED (CWE-384). authController.login deletes
 * EVERY refresh token for the user (prisma.refreshToken.deleteMany({ where:
 * { userId } }), the session-fixation mitigation) before minting a new family.
 * So each renewal — and each ensureLiveSession() re-login — revokes the refresh
 * token held by every context already alive. Those contexts keep working on
 * their still-valid stateless access token, but their silent refresh then fails
 * with "Invalid refresh token". That is why this file is always OVERWRITTEN
 * with the newest state rather than merged, and why a context should be built
 * from the file rather than from a long-held in-memory copy. Locally
 * `workers: 2` means two workers can re-login against each other's sessions; CI
 * runs `workers: 1`, so CI is the safe case. This is a property of the
 * backend's security posture, not something this helper works around.
 */

import { request as playwrightRequest } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const DEFAULT_RENEW_INTERVAL_MS = 10 * 60 * 1000;
const MIN_RENEW_INTERVAL_MS = 1_000;

/**
 * Renewal cadence. E2E_SESSION_RENEW_MS exists so the renewal path can be
 * exercised without waiting ten minutes; it changes only how often the real
 * login runs, never what it does. A typo must not become setInterval(fn, NaN)
 * — that fires every ~1ms and would flood the shared user with logins — so an
 * unusable value is rejected loudly instead of silently coerced.
 */
function resolveRenewIntervalMs(): number {
  const raw = process.env.E2E_SESSION_RENEW_MS;
  if (raw === undefined || raw === '') {
    return DEFAULT_RENEW_INTERVAL_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < MIN_RENEW_INTERVAL_MS) {
    throw new Error(
      `E2E_SESSION_RENEW_MS must be a finite number of milliseconds >= ${MIN_RENEW_INTERVAL_MS}; got "${raw}".`
    );
  }
  return parsed;
}

export const RENEW_INTERVAL_MS = resolveRenewIntervalMs();

type KeepAliveOptions = {
  baseURL: string;
  storageStatePath: string;
  email: string;
  password: string;
};

export type KeepAliveStatus = {
  /** Wall-clock ms of the last SUCCESSFUL renewal (or the startup self-test). */
  lastSuccessAt: number;
  /** Consecutive failures since the last success. */
  consecutiveFailures: number;
  /** Message of the most recent failure, if the last attempt failed. */
  lastError: string | null;
  /** Renewal cadence in force, so readers can judge staleness. */
  intervalMs: number;
};

/**
 * Where the renewal result is published. The timer runs in the Playwright MAIN
 * process while specs run in worker processes, so the status has to cross a
 * process boundary: a file next to storageState.json is the simplest honest
 * channel, and it is what assertSharedSessionHealthy() reads.
 */
export function statusPathFor(storageStatePath: string): string {
  return path.join(
    path.dirname(storageStatePath),
    `.${path.basename(storageStatePath)}.keepalive-status.json`
  );
}

/** Write a file by atomic replace, retrying the Windows EPERM/EBUSY window. */
function writeFileAtomic(targetPath: string, contents: string): void {
  const tmp = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.tmp-${process.pid}-${Date.now()}`
  );
  fs.writeFileSync(tmp, contents);
  // On win32 a reader holding the destination open makes rename fail with
  // EPERM/EBUSY. Local runs use two workers, so retry briefly before giving up
  // — and if it still fails, throw, because a swallowed failure here is exactly
  // the silent-staleness bug this module exists to prevent.
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.renameSync(tmp, targetPath);
      return;
    } catch (err) {
      lastError = err;
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') {
        break;
      }
      // Brief spin: this runs on the main process's timer callback and the
      // contended window is milliseconds long.
      const until = Date.now() + 20;
      while (Date.now() < until) {
        /* wait out the contended window */
      }
    }
  }
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* the temp file may already be gone; the original error is what matters */
  }
  throw lastError;
}

/** Replace the cookies in the storageState file, keeping its origins. */
function writeRenewedCookies(storageStatePath: string, cookies: unknown): void {
  const current = JSON.parse(fs.readFileSync(storageStatePath, 'utf8'));
  const next = { ...current, cookies };
  // Atomic replace — a worker reading the file concurrently sees either the
  // previous complete state or the new one, never a torn file.
  writeFileAtomic(storageStatePath, JSON.stringify(next, null, 2));
}

function writeStatus(storageStatePath: string, status: KeepAliveStatus): void {
  writeFileAtomic(statusPathFor(storageStatePath), JSON.stringify(status, null, 2));
}

export function readStatus(storageStatePath: string): KeepAliveStatus | null {
  try {
    return JSON.parse(fs.readFileSync(statusPathFor(storageStatePath), 'utf8')) as KeepAliveStatus;
  } catch {
    return null;
  }
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
 * Renew once and publish the outcome. Returns the new status instead of
 * throwing so the timer can keep trying; the recorded status is what makes the
 * failure impossible to ignore (assertSharedSessionHealthy + globalTeardown).
 */
async function renewAndRecord(
  options: KeepAliveOptions,
  previous: KeepAliveStatus
): Promise<KeepAliveStatus> {
  try {
    await renewSharedSession(options);
    const next: KeepAliveStatus = {
      lastSuccessAt: Date.now(),
      consecutiveFailures: 0,
      lastError: null,
      intervalMs: RENEW_INTERVAL_MS,
    };
    writeStatus(options.storageStatePath, next);
    console.log('[session-keep-alive] storageState renewed.');
    return next;
  } catch (err) {
    const next: KeepAliveStatus = {
      ...previous,
      consecutiveFailures: previous.consecutiveFailures + 1,
      lastError: (err as Error).message,
      intervalMs: RENEW_INTERVAL_MS,
    };
    try {
      writeStatus(options.storageStatePath, next);
    } catch (statusErr) {
      console.error(
        `[session-keep-alive] could not record renewal failure: ${(statusErr as Error).message}`
      );
    }
    console.error(`[session-keep-alive] renewal FAILED: ${next.lastError}`);
    return next;
  }
}

/**
 * Fail the caller if the shared session is not being kept alive. Every path
 * that builds an authenticated context calls this, so a spec running on a stale
 * storageState fails for the REAL reason instead of reproducing the original
 * bug as "element(s) not found". global-teardown.ts applies the same check to
 * the whole run, which covers the specs that only use the plain page fixture.
 */
export function assertSharedSessionHealthy(storageStatePath: string): void {
  const status = readStatus(storageStatePath);
  if (!status) {
    throw new Error(
      `session keep-alive status missing (${statusPathFor(storageStatePath)}). ` +
        'tests/e2e/global-setup.ts publishes it before any worker starts — did global setup run?'
    );
  }
  if (status.consecutiveFailures > 0) {
    throw new Error(
      `session keep-alive has failed ${status.consecutiveFailures} time(s) in a row; ` +
        `storageState.json may hold an expired accessToken. Last error: ${status.lastError}`
    );
  }
  const ageMs = Date.now() - status.lastSuccessAt;
  // Two intervals of slack: one missed tick is a scheduling hiccup, two means
  // the timer is not running at all.
  const staleAfterMs = status.intervalMs * 2;
  if (ageMs > staleAfterMs) {
    throw new Error(
      `session keep-alive last succeeded ${Math.round(ageMs / 1000)}s ago, over the ` +
        `${Math.round(staleAfterMs / 1000)}s staleness budget — the renewal timer is not running.`
    );
  }
}

/**
 * Renew once immediately (a startup self-test, so a broken credential path is
 * discovered before any spec runs rather than ten minutes in) and then on a
 * timer. Returns a stop function. The timer is unref'd so it never keeps the
 * Playwright process alive past the run.
 *
 * Throws if the startup renewal fails — that runs inside globalSetup, so the
 * whole run fails immediately and loudly.
 */
export async function startSessionKeepAlive(options: KeepAliveOptions): Promise<() => void> {
  await renewSharedSession(options);
  let status: KeepAliveStatus = {
    lastSuccessAt: Date.now(),
    consecutiveFailures: 0,
    lastError: null,
    intervalMs: RENEW_INTERVAL_MS,
  };
  writeStatus(options.storageStatePath, status);
  console.log(
    `[session-keep-alive] startup renewal OK; renewing every ${Math.round(
      RENEW_INTERVAL_MS / 1000
    )}s.`
  );

  const timer = setInterval(() => {
    void renewAndRecord(options, status).then((next) => {
      status = next;
    });
  }, RENEW_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
