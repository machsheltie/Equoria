/**
 * Cross-tab session refresh (Equoria-jwfzj).
 *
 * The server treats a refresh token as single-use (tokenRotationService): of
 * two refreshes that present the SAME refresh cookie, one wins and the other
 * is answered 401 (concurrent rotation) or, if it lands after the winner
 * committed, trips reuse detection and revokes the whole token family.
 *
 * Within one tab `refreshAccessToken` is single-flight. Two tabs of the same
 * browser share ONE cookie jar but not module state: when the access cookie
 * expires, both tabs 401 together and both POST /auth/refresh-token with the
 * same refresh cookie. The loser's transport reported "session expired", which
 * ended that tab's session and sent the player to /login even though the
 * cookie jar held a perfectly good rotated session.
 *
 * Each "tab" below is a separate module instance (own refreshPromise and
 * authSessionState); they share one cookie jar and one rotating refresh
 * endpoint at the fetch boundary (MSW), with the same single-use semantics as
 * the real backend. Cross-tab ordering is by the Web Locks API, a browser
 * primitive, so the test installs a spec-faithful in-memory LockManager.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type Tab = {
  get: <T>(endpoint: string) => Promise<T>;
};

/** Spec-faithful enough LockManager: exclusive locks granted in request order. */
function installFakeLockManager() {
  const tails = new Map<string, Promise<unknown>>();
  const manager = {
    request: async <T>(name: string, callback: () => Promise<T>): Promise<T> => {
      const previous = tails.get(name) ?? Promise.resolve();
      const run = previous.then(
        () => callback(),
        () => callback()
      );
      tails.set(
        name,
        run.catch(() => undefined)
      );
      return run;
    },
  };
  Object.defineProperty(navigator, 'locks', { value: manager, configurable: true });
}

let jarRefresh: string;
let jarAccessValid: boolean;
let serverRefreshValid: string;
let familyRevoked: boolean;
let rotations: number;
let refreshArrivals: number;

/**
 * One cookie jar + one rotating refresh endpoint, mirroring the backend's
 * semantics: the cookie is read when the request is SENT, the server decides
 * when it ARRIVES, the jar is updated when the response is received.
 */
function installSharedBrowserAndServer() {
  server.use(
    http.post(`${base}/api/v1/auth/refresh-token`, async () => {
      refreshArrivals += 1;
      const sentWith = jarRefresh;
      await delay(30); // network latency: the other tab's request overlaps ours
      if (familyRevoked || sentWith !== serverRefreshValid) {
        // A token that was already rotated: reuse detection revokes the family.
        if (sentWith !== serverRefreshValid) familyRevoked = true;
        return HttpResponse.json(
          { status: 'error', message: 'Invalid refresh token' },
          { status: 401 }
        );
      }
      rotations += 1;
      serverRefreshValid = `refresh-${rotations}`;
      jarRefresh = serverRefreshValid;
      jarAccessValid = true;
      return HttpResponse.json({ success: true, data: { rotated: true, csrfToken: 'csrf' } });
    }),
    http.get(`${base}/api/v1/horses`, () => {
      if (!jarAccessValid) {
        return HttpResponse.json({ status: 'error', message: 'Token expired' }, { status: 401 });
      }
      return HttpResponse.json({ success: true, data: { horses: [] } });
    })
  );
}

async function openTab(): Promise<Tab> {
  // A new tab is a new module graph: its own refreshPromise and session state.
  vi.resetModules();
  const mod = await import('../apiClient');
  return { get: (endpoint) => mod.apiClient.get(endpoint) };
}

beforeEach(() => {
  jarRefresh = 'refresh-0';
  serverRefreshValid = 'refresh-0';
  jarAccessValid = false; // the access cookie has just expired in both tabs
  familyRevoked = false;
  rotations = 0;
  refreshArrivals = 0;
  installFakeLockManager();
  installSharedBrowserAndServer();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'locks');
  try {
    window.localStorage.clear();
  } catch {
    // jsdom storage is always available; the guard mirrors production.
  }
});

describe('refreshAccessToken across two tabs sharing one cookie jar', () => {
  it('keeps both tabs signed in when their access cookies expire together', async () => {
    const tabA = await openTab();
    const tabB = await openTab();

    const [a, b] = await Promise.allSettled([
      tabA.get('/api/v1/horses'),
      tabB.get('/api/v1/horses'),
    ]);

    // Neither tab is told its session expired, and the family is not revoked.
    expect(a.status).toBe('fulfilled');
    expect(b.status).toBe('fulfilled');
    expect(familyRevoked).toBe(false);
  });

  it('does not spend a second rotation when the other tab already refreshed', async () => {
    const tabA = await openTab();
    const tabB = await openTab();

    await Promise.all([tabA.get('/api/v1/horses'), tabB.get('/api/v1/horses')]);

    // The tab that waited for the lock sees the other tab's refresh and just
    // replays its request with the new cookie.
    expect(rotations).toBe(1);
    expect(refreshArrivals).toBe(1);
  });

  it('still ends the session when the refresh token is genuinely dead', async () => {
    serverRefreshValid = 'revoked-elsewhere'; // jar holds a token the server no longer honours
    const tabA = await openTab();

    const result = await tabA.get('/api/v1/horses').then(
      () => null,
      (error: unknown) => error as { statusCode?: number; sessionExpired?: boolean }
    );

    expect(result).toMatchObject({ statusCode: 401, sessionExpired: true });
  });
});
