/**
 * apiClient 401 narrowing for pre-session authentication operations
 * (Finding 7 / Equoria-6p398.7).
 *
 * The transport's generic 401 handler assumes every 401 means "the access
 * token expired" and answers it with POST /auth/refresh-token followed by one
 * replay of the original request. That is correct for a PROTECTED request made
 * by a logged-in player, and wrong for the two PRE-SESSION endpoints:
 *
 *   POST /api/v1/auth/login          — 401 means "those credentials are wrong"
 *   POST /api/v1/auth/mfa/challenge  — 401 means "that second factor is wrong"
 *
 * Neither has a session to refresh, so the refresh always fails, the failure
 * wipes the cached CSRF state, and the useful authentication error is replaced
 * by "Session expired. Please log in again." Worse, when the refresh happens to
 * succeed the transport REPLAYS the challenge — a single mistyped code is
 * counted twice against the backend's 5-failure MFA lockout
 * (mfaLockoutService, Equoria-kg7i2).
 *
 * Network is exercised through the REAL transport at the fetch boundary via
 * MSW (src/test/msw/server.ts) — the same boundary the existing api-client and
 * LoginPage suites already use. Nothing Equoria-owned is mocked.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { apiClient } from '../apiClient';
import authSessionState from '../../authSessionState';
import type { ApiError } from '../types';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let refreshCalls = 0;
let loginCalls = 0;
let challengeCalls = 0;
let horsesCalls = 0;

beforeEach(() => {
  refreshCalls = 0;
  loginCalls = 0;
  challengeCalls = 0;
  horsesCalls = 0;
  authSessionState.clear();
});

/**
 * Truthful pre-session refresh behaviour: there is no refresh cookie yet, so
 * the backend rejects the refresh. This is the state a browser is actually in
 * while it is still trying to log in.
 */
function stubRefreshRejected() {
  server.use(
    http.post(`${base}/api/v1/auth/refresh-token`, () => {
      refreshCalls += 1;
      return HttpResponse.json(
        { status: 'error', message: 'Invalid refresh token' },
        { status: 401 }
      );
    })
  );
}

describe('apiClient — 401 handling for pre-session authentication operations', () => {
  it('surfaces the login rejection instead of replacing it with "Session expired"', async () => {
    stubRefreshRejected();
    server.use(
      http.post(`${base}/api/v1/auth/login`, () => {
        loginCalls += 1;
        return HttpResponse.json(
          { success: false, message: 'Invalid credentials' },
          { status: 401 }
        );
      })
    );

    const error = await apiClient
      .post('/api/v1/auth/login', { email: 'someone@example.com', password: 'nope' })
      .then(
        () => null,
        (caught: ApiError) => caught
      );

    expect(error?.statusCode).toBe(401);
    expect(error?.message).toBe('Invalid credentials');
    expect(error?.message).not.toMatch(/session expired/i);
    expect(refreshCalls, 'login has no session to refresh').toBe(0);
    expect(loginCalls, 'the rejected credentials must not be replayed').toBe(1);
  });

  it('surfaces the second-factor rejection and never replays the submitted code', async () => {
    stubRefreshRejected();
    server.use(
      http.post(`${base}/api/v1/auth/mfa/challenge`, () => {
        challengeCalls += 1;
        return HttpResponse.json(
          { success: false, message: 'Invalid MFA credentials' },
          { status: 401 }
        );
      })
    );

    const error = await apiClient
      .post('/api/v1/auth/mfa/challenge', { mfaChallengeToken: 'challenge-token', token: '000000' })
      .then(
        () => null,
        (caught: ApiError) => caught
      );

    expect(error?.statusCode).toBe(401);
    expect(error?.message).toBe('Invalid MFA credentials');
    expect(error?.message).not.toMatch(/session expired/i);
    expect(refreshCalls, 'the second factor has no session to refresh').toBe(0);
    expect(
      challengeCalls,
      'replaying the code would burn a second attempt against the MFA lockout'
    ).toBe(1);
  });

  it('still refreshes and retries a protected request that answers 401', async () => {
    server.use(
      http.post(`${base}/api/v1/auth/refresh-token`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ success: true, message: 'Token refreshed' });
      }),
      http.get(`${base}/api/v1/horses`, () => {
        horsesCalls += 1;
        if (horsesCalls === 1) {
          return HttpResponse.json(
            { status: 'error', message: 'Access token expired' },
            { status: 401 }
          );
        }
        return HttpResponse.json({ success: true, data: [{ id: 7 }] });
      })
    );

    const horses = await apiClient.get<{ id: number }[]>('/api/v1/horses');

    expect(horses).toEqual([{ id: 7 }]);
    expect(refreshCalls, 'a protected 401 must still drive one refresh').toBe(1);
    expect(horsesCalls, 'the protected request must still be retried once').toBe(2);
  });

  it('still reports an expired session when the refresh of a protected request fails', async () => {
    stubRefreshRejected();
    server.use(
      http.get(`${base}/api/v1/horses`, () => {
        horsesCalls += 1;
        return HttpResponse.json(
          { status: 'error', message: 'Invalid or expired token' },
          { status: 401 }
        );
      })
    );

    const error = await apiClient.get('/api/v1/horses').then(
      () => null,
      (caught: ApiError) => caught
    );

    expect(error?.statusCode).toBe(401);
    expect(error?.message).toMatch(/session expired/i);
    expect(refreshCalls).toBe(1);
  });
});
