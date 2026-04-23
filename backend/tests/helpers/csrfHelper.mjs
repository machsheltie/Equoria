/**
 * CSRF test helper — exercises the real token acquisition flow.
 *
 * Tests that need to call state-changing endpoints (POST/PUT/PATCH/DELETE)
 * must hold a matching cookie + header pair. This helper performs the real
 * `GET /auth/csrf-token` call, extracts the `Set-Cookie` the server issued,
 * and returns both the header token and the cookie string. Callers forward
 * the cookie on `Cookie:` and the token on `X-CSRF-Token:`.
 *
 * There is NO bypass branch. Every test that drives a mutation through the
 * live `csrfProtection` middleware must use this helper (or an equivalent
 * real-flow pattern). If a test can succeed without calling this, the test
 * is not exercising CSRF.
 *
 * @module tests/helpers/csrfHelper
 */

import supertest from 'supertest';

/**
 * Fetch a CSRF token + matching cookie from the running app.
 *
 * @param {import('express').Express} app - Express app under test.
 * @param {object} [options]
 * @param {string} [options.origin] - Origin header to send on the token
 *   request. Required because Workstream 3's no-origin policy denies calls
 *   without an Origin on non-health paths. Defaults to an allow-listed dev
 *   origin so the helper works out of the box.
 * @param {string|string[]} [options.extraCookies] - Cookies to merge with the
 *   returned CSRF cookie (e.g. an `accessToken=...` cookie from a prior
 *   login). Returned `cookieHeader` is ready to drop into `.set('Cookie', ...)`.
 * @returns {Promise<{
 *   csrfToken: string,
 *   csrfCookie: string,
 *   cookieHeader: string[],
 * }>}
 */
export async function fetchCsrf(app, options = {}) {
  const { origin = 'http://localhost:3000', extraCookies } = options;

  const res = await supertest(app).get('/auth/csrf-token').set('Origin', origin);

  if (res.status !== 200 || !res.body?.csrfToken) {
    throw new Error(
      `[csrfHelper] token fetch failed: status=${res.status} body=${JSON.stringify(res.body)}`,
    );
  }

  const setCookies = res.headers['set-cookie'] || [];
  const csrfCookie = setCookies
    .map(c => c.split(';')[0])
    .find(c => c.startsWith('__Host-csrf=') || c.startsWith('_csrf='));

  if (!csrfCookie) {
    throw new Error('[csrfHelper] no csrf cookie in Set-Cookie response');
  }

  const incomingExtras = Array.isArray(extraCookies)
    ? extraCookies
    : extraCookies
      ? [extraCookies]
      : [];

  return {
    csrfToken: res.body.csrfToken,
    csrfCookie,
    cookieHeader: [...incomingExtras, csrfCookie],
  };
}

/**
 * Apply a CSRF token + cookie pair to a supertest chain. Returns the same
 * chain so callers can continue fluent-style.
 *
 * @param {import('supertest').Test} req - An in-flight supertest request.
 * @param {{ csrfToken: string, cookieHeader: string[] }} csrf - Output of
 *   `fetchCsrf`.
 * @returns {import('supertest').Test}
 */
export function attachCsrf(req, csrf) {
  return req.set('Cookie', csrf.cookieHeader).set('X-CSRF-Token', csrf.csrfToken);
}
