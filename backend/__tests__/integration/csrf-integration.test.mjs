/**
 * CSRF protection — real-flow integration tests.
 *
 * These tests exercise the live CSRF enforcement path end-to-end against
 * the real Express app. They must NOT set `x-test-skip-csrf`, must NOT set
 * `x-test-bypass-*`, and must NOT import or stub any middleware. Every
 * assertion that a mutation succeeds or fails is a statement about the
 * production contract:
 *
 *   1. GET /auth/csrf-token issues a token (body) and a matching cookie.
 *   2. A PUT/POST/PATCH/DELETE on an authenticated route succeeds only
 *      when both the cookie and the `X-CSRF-Token` header are presented
 *      AND the HMAC validates.
 *   3. Missing cookie, missing header, or mismatched token → 403
 *      with code INVALID_CSRF_TOKEN.
 *
 * The authenticated mutation we drive is `PUT /api/auth/profile`, which
 * moved to `authRouter` in Workstream 2. If that route ever drifts back
 * onto `publicRouter`, `authenticated auth mutation > succeeds with real
 * CSRF` would start passing WITHOUT a CSRF token — a separate test
 * (authenticated-auth-routes-csrf) is the canary for that regression.
 *
 * @module __tests__/integration/csrf-integration.test
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { jest as _jest } from '@jest/globals';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';

_jest.setTimeout(120000);

const ORIGIN = 'http://localhost:3000';
const TEST_EMAIL_PREFIX = 'csrftest';

const extractAccessCookie = setCookieHeader => {
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  const match = cookies.find(c => c.startsWith('accessToken='));
  return match ? match.split(';')[0] : null;
};

describe('CSRF protection — real browser flow', () => {
  let testUser;
  let accessCookie;

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    });
  });

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}${Math.floor(Math.random() * 10000)}`;
    const email = `${TEST_EMAIL_PREFIX}${unique}@test.com`;
    const username = `${TEST_EMAIL_PREFIX}${unique}`;

    const res = await request(app).post('/auth/register').set('Origin', ORIGIN).send({
      email,
      username,
      password: 'TestPass123!',
      firstName: 'CSRF',
      lastName: 'Test',
    });

    expect(res.status).toBe(201);
    accessCookie = extractAccessCookie(res.headers['set-cookie']);
    expect(accessCookie).toBeTruthy();

    testUser = await prisma.user.findUnique({ where: { email } });
    expect(testUser).toBeTruthy();
  });

  afterEach(async () => {
    if (testUser) {
      await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      testUser = null;
    }
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    });
  });

  describe('token acquisition', () => {
    it('GET /auth/csrf-token returns a token and Set-Cookie', async () => {
      const res = await request(app).get('/auth/csrf-token').set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.csrfToken).toBe('string');
      expect(res.body.csrfToken.length).toBeGreaterThan(16);

      const setCookies = res.headers['set-cookie'] || [];
      // Validator reads the cookie named `_csrf` in non-production and
      // `__Host-csrf` in production. The generator MUST set whichever
      // matches — Set-Cookie should include exactly one of those names.
      const csrfCookieLine = setCookies.find(c => c.startsWith('__Host-csrf=') || c.startsWith('_csrf='));
      expect(csrfCookieLine).toBeTruthy();
    });

    it('consecutive token fetches produce distinct tokens', async () => {
      const a = await request(app).get('/auth/csrf-token').set('Origin', ORIGIN);
      const b = await request(app).get('/auth/csrf-token').set('Origin', ORIGIN);
      expect(a.body.csrfToken).not.toBe(b.body.csrfToken);
    });
  });

  describe('authenticated mutation — real flow', () => {
    it('succeeds with matching cookie + X-CSRF-Token header', async () => {
      const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: accessCookie });

      // authController.updateProfile accepts username/email/notifications/
      // display (firstName is validated at the route level but not wired
      // into the update — pre-existing quirk out of scope for this fix).
      // We exercise `notifications` because it writes real state and proves
      // the mutation reached the handler.
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ notifications: { email: true } });

      expect(res.status).toBe(200);
      expect(res.body.code).not.toBe('INVALID_CSRF_TOKEN');

      const refreshed = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(refreshed.settings?.notifications?.email).toBe(true);
    });

    it('fails with 403 INVALID_CSRF_TOKEN when the header is missing', async () => {
      const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: accessCookie });

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        // NOTE: no X-CSRF-Token header
        .send({ firstName: 'ShouldNotApply' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('INVALID_CSRF_TOKEN');
    });

    it('fails with 403 INVALID_CSRF_TOKEN when the csrf cookie is missing', async () => {
      const csrf = await fetchCsrf(app, { origin: ORIGIN });

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Origin', ORIGIN)
        // Only accessToken cookie, NOT the csrf cookie:
        .set('Cookie', [accessCookie])
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ firstName: 'ShouldNotApply' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('INVALID_CSRF_TOKEN');
    });

    it('fails with 403 INVALID_CSRF_TOKEN when header and cookie do not match', async () => {
      const csrfA = await fetchCsrf(app, { origin: ORIGIN, extraCookies: accessCookie });
      const csrfB = await fetchCsrf(app, { origin: ORIGIN });

      // Cookie from fetch A, token from fetch B — HMAC mismatch.
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Origin', ORIGIN)
        .set('Cookie', csrfA.cookieHeader)
        .set('X-CSRF-Token', csrfB.csrfToken)
        .send({ firstName: 'ShouldNotApply' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('INVALID_CSRF_TOKEN');
    });
  });

  describe('safe methods bypass CSRF', () => {
    it('GET /api/auth/profile returns 200 without a CSRF token', async () => {
      const res = await request(app).get('/api/auth/profile').set('Origin', ORIGIN).set('Cookie', accessCookie);

      expect(res.status).toBe(200);
    });
  });

  describe('no-origin policy', () => {
    it('rejects browser mutations with no Origin header on application routes', async () => {
      // The no-origin gate (app.mjs::enforceNoOriginPolicy) only fires on
      // requests that look like they originated in a browser — `Sec-Fetch-Mode`
      // is set by every modern browser on every fetch/navigation but never
      // by curl, supertest's bare requests, or other CLI/server-to-server
      // tooling. Per the security model documented above the middleware,
      // a no-Origin curl request is not a CSRF threat (curl doesn't carry
      // the victim's cookies cross-origin), so only browser-shaped requests
      // need to be blocked here. Set Sec-Fetch-Mode so this test exercises
      // the gate as a real browser would.
      const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: accessCookie });

      const res = await request(app)
        .put('/api/auth/profile')
        // NOTE: no Origin header — but Sec-Fetch-Mode marks this as a
        // browser request, so the no-origin gate must reject it.
        .set('Sec-Fetch-Mode', 'cors')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ firstName: 'NoOrigin' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('NO_ORIGIN_BLOCKED');
    });

    it('allows non-browser (CLI / server-to-server) no-Origin mutations through the gate', async () => {
      // Mirror image of the previous test: WITHOUT Sec-Fetch-Mode, the
      // no-origin gate must NOT fire — CLI tools and service-to-service
      // callers without Origin are not CSRF threats. The request still
      // has to pass CSRF and validation; it should NOT 403 with
      // NO_ORIGIN_BLOCKED.
      const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: accessCookie });

      const res = await request(app)
        .put('/api/auth/profile')
        // No Origin, no Sec-Fetch-Mode.
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ firstName: 'NoOrigin' });

      expect(res.body.code).not.toBe('NO_ORIGIN_BLOCKED');
      expect(res.status).not.toBe(403);
    });

    it('allows /health without an Origin header (operational exemption)', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });
  });

  describe('public endpoints — no CSRF required', () => {
    it('POST /auth/login does not require CSRF', async () => {
      const res = await request(app).post('/auth/login').set('Origin', ORIGIN).send({
        email: testUser.email,
        password: 'TestPass123!',
      });

      expect(res.status).not.toBe(403);
      expect(res.body.code).not.toBe('INVALID_CSRF_TOKEN');
    });
  });
});
