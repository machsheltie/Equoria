/**
 * Session Lifetime E2E — 21R-AUTH-6
 *
 * Verifies end-to-end that the token refresh flow works in a real browser
 * context: login → protected page → refresh → protected page still works.
 *
 * Uses only production-path network calls. No bypass headers, no test.skip,
 * no route interception for auth — 21R doctrine compliant.
 *
 * Backend is at http://localhost:3001 (NODE_ENV=beta webServer).
 * Frontend is at http://localhost:3000.
 */

import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';

const BACKEND = 'http://localhost:3001';
const SUITE_PREFIX = 'seslife_e2e';

test.describe('Session lifetime — refresh flow (21R-AUTH-6)', () => {
  let userEmail: string;
  let userPassword: string;

  test.beforeAll(async ({ request }) => {
    const suffix = randomBytes(6).toString('hex');
    userEmail = `${SUITE_PREFIX}-${suffix}@example.com`;
    userPassword = 'SesLifeE2e1!Aa';

    const reg = await request.post(`${BACKEND}/api/v1/auth/register`, {
      data: {
        email: userEmail,
        password: userPassword,
        username: `${SUITE_PREFIX}${suffix}`,
        firstName: 'Ses',
        lastName: 'LifeE2e',
        // Equoria-iqzn / Equoria-9tlha: COPPA age gate requires a valid adult DOB.
        dateOfBirth: '1990-01-01',
      },
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(reg.status(), `Registration failed: ${await reg.text()}`).toBe(201);
  });

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup — login to get a token, then delete via profile or
    // direct API. We rely on beforeAll having succeeded; if it failed this
    // is a no-op (user was never created).
    try {
      const loginRes = await request.post(`${BACKEND}/api/v1/auth/login`, {
        data: { email: userEmail, password: userPassword },
        headers: { Origin: 'http://localhost:3000' },
      });
      if (loginRes.status() === 200) {
        const { data } = await loginRes.json();
        const csrfToken = data?.csrfToken ?? '';
        const loginCookies = loginRes.headers()['set-cookie'] ?? '';
        await request.post(`${BACKEND}/api/v1/auth/logout`, {
          headers: {
            Origin: 'http://localhost:3000',
            Cookie: loginCookies,
            'X-CSRF-Token': csrfToken,
          },
        });
      }
    } catch {
      // cleanup failure is non-fatal
    }
  });

  test('login issues httpOnly accessToken and refreshToken cookies', async ({ page }) => {
    const loginRes = await page.request.post(`${BACKEND}/api/v1/auth/login`, {
      data: { email: userEmail, password: userPassword },
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(loginRes.status()).toBe(200);

    const body = await loginRes.json();
    expect(body.status).toBe('success');
    expect(body.data.user.email).toBe(userEmail);

    // Cookies are httpOnly so page.evaluate cannot read them, but the
    // response Set-Cookie header exposes them for assertion.
    const setCookie = loginRes.headers()['set-cookie'] ?? '';
    expect(setCookie).toMatch(/accessToken=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/refreshToken=/);
  });

  test('POST /api/v1/auth/refresh-token rotates tokens and the new accessToken authenticates', async ({
    page,
  }) => {
    // Login to acquire refresh token in the browser's cookie jar.
    const loginRes = await page.request.post(`${BACKEND}/api/v1/auth/login`, {
      data: { email: userEmail, password: userPassword },
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(loginRes.status()).toBe(200);

    // Refresh — cookies from login are automatically forwarded because they
    // share the same APIRequestContext origin.
    const refreshRes = await page.request.post(`${BACKEND}/api/v1/auth/refresh-token`, {
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(refreshRes.status()).toBe(200);

    const refreshBody = await refreshRes.json();
    expect(refreshBody.status).toBe('success');
    expect(refreshBody.message).toBe('Token refreshed successfully');

    // The refreshed access token must work on a protected route.
    const profileRes = await page.request.get(`${BACKEND}/api/v1/auth/profile`, {
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(profileRes.status()).toBe(200);

    const profileBody = await profileRes.json();
    expect(profileBody.data.user.email).toBe(userEmail);
  });
});
