/**
 * csrfBearerHeaderBinding.sentinel.test.mjs
 *
 * Equoria-lax36 — Bearer-header CSRF session-identifier symmetry.
 *
 * Regression: Equoria-plw0h added per-user CSRF binding by making
 * `resolveSessionIdentifier(req)` return `req.user.id` for any authenticated
 * request. But every ISSUANCE path that binds `req.user.id` does so for a
 * COOKIE-based session (the public `GET /auth/csrf-token` route only decodes
 * `req.cookies.accessToken`; register/login/refresh set the access cookie on
 * the same response). `authenticateToken` ALSO accepts a JWT via the
 * `Authorization: Bearer` HEADER. So a header-auth API client (mobile /
 * server-to-server / the documented backward-compat header path) that fetched
 * a CSRF token WITHOUT an access cookie got a token bound to the salt, then
 * mutated with a Bearer header — at which point validation resolved to
 * `req.user.id` (≠ salt) and the legitimate mutation 403'd.
 *
 * This is exactly the symptom that broke `legacyUserDelete` /
 * `gdprAccountRoutes` self-delete: an anonymously-fetched CSRF token + a
 * Bearer-header mutation = 403 instead of 2xx.
 *
 * Fix (csrf.mjs + auth.mjs): `authenticateToken` records `req.authTokenSource`
 * ('cookie' | 'header'); `resolveSessionIdentifier` skips `req.user.id` when
 * the JWT came via the header — restoring issue/validate symmetry. This loses
 * NOTHING from plw0h's threat model because a Bearer-header request is not
 * CSRF-able (a browser never auto-attaches an Authorization header to a forged
 * cross-site request). The cookie-based cross-user-replay defense is preserved.
 *
 * Real DB, real Express app, no mocks, no bypass headers.
 *
 *   PRE-FIX:  the Bearer-header `it` 403s (defect)  — sentinel-positive.
 *   POST-FIX: the Bearer-header `it` 200s            — fix confirmed.
 *   Both PRE- and POST-fix: the cookie cross-user replay `it` stays 403
 *   (proves the fix did not regress plw0h's protection).
 *
 * @module __tests__/auth/csrfBearerHeaderBinding.sentinel
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';
const PREFIX = 'csrfbearer-';

function extractCookie(setCookieHeader, name) {
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  const match = list.find(c => c.startsWith(`${name}=`));
  return match ? match.split(';')[0] : null;
}

async function registerCookieUser(suffix) {
  const unique = `${suffix}${randomBytes(6).toString('hex')}`;
  const email = `${PREFIX}${unique}@test.com`;
  const username = `${PREFIX}${unique}`.replace(/-/g, '').slice(0, 30);
  const res = await request(app).post('/api/v1/auth/register').set('Origin', ORIGIN).send({
    email,
    username,
    password: 'TestPass123!',
    firstName: 'Csrf',
    lastName: 'Bearer',
    dateOfBirth: '1990-01-01',
  });
  expect(res.status).toBe(201);
  const csrfCookieName = process.env.NODE_ENV === 'production' ? '__Host-csrf' : '_csrf';
  return {
    email,
    accessCookie: extractCookie(res.headers['set-cookie'], 'accessToken'),
    refreshCookie: extractCookie(res.headers['set-cookie'], 'refreshToken'),
    csrfCookie: extractCookie(res.headers['set-cookie'], csrfCookieName),
    csrfToken: res.body?.data?.csrfToken,
  };
}

describe('CSRF — Bearer-header session binding (Equoria-lax36)', () => {
  // Anonymous CSRF token (bound to the salt) shared by the header-auth case.
  let anonCsrf;
  // Cookie users for the preserved-plw0h-protection assertion.
  const registeredEmails = [];

  beforeAll(async () => {
    // Anonymous fetch — no access cookie, no Bearer header. The issued CSRF
    // token is bound to CSRF_SESSION_SALT (the unauthenticated identifier).
    anonCsrf = await fetchCsrf(app);
  }, 120000);

  afterAll(async () => {
    // testAuth fixtures are id-scoped; cookie-registered users are
    // prefix-scoped (FK order: horses before users).
    await cleanupTestData();
    if (registeredEmails.length > 0) {
      await prisma.horse
        .deleteMany({ where: { user: { email: { startsWith: PREFIX } } } })
        .catch(err => console.warn(`[cleanup] ${err.message}`));
      await prisma.user
        .deleteMany({ where: { email: { startsWith: PREFIX } } })
        .catch(err => console.warn(`[cleanup] ${err.message}`));
    }
  }, 120000);

  it('SENTINEL: a Bearer-header mutation with an anonymously-fetched CSRF token succeeds (not 403)', async () => {
    // A header-auth API client: JWT via Authorization header, CSRF token from
    // the anonymous GET /auth/csrf-token (no access cookie). Pre-fix this 403s
    // because validation binds to req.user.id while issuance bound to the salt.
    const subject = await createTestUser({
      username: `TestFixture_csrfbearer_${randomBytes(6).toString('hex')}`,
      email: `TestFixture_csrfbearer_${randomBytes(6).toString('hex')}@test.com`,
      password: 'TestPassword123!',
    });

    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${subject.token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', anonCsrf.cookieHeader)
      .set('X-CSRF-Token', anonCsrf.csrfToken)
      .send({ notifications: { email: false } });

    // The CSRF gate must NOT reject this legitimate header-auth mutation.
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  }, 120000);

  it('a Bearer-header mutation with NO CSRF token is still rejected (403)', async () => {
    // Symmetry guard: the fix must not turn CSRF off for header auth — a
    // mutation with no cookie+header pair at all still fails closed.
    const subject = await createTestUser({
      username: `TestFixture_csrfnocsrf_${randomBytes(6).toString('hex')}`,
      email: `TestFixture_csrfnocsrf_${randomBytes(6).toString('hex')}@test.com`,
      password: 'TestPassword123!',
    });

    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${subject.token}`)
      .set('Origin', ORIGIN)
      .send({ notifications: { email: false } });

    expect(res.status).toBe(403);
  }, 120000);

  it('PRESERVED plw0h: a cookie session replaying ANOTHER user’s CSRF token is still rejected (403)', async () => {
    // The fix only relaxes the HEADER case. A COOKIE-authenticated request is
    // still CSRF-able, so per-user binding must still fire: user B's cookie
    // session paired with user A's CSRF token+cookie must 403.
    const userA = await registerCookieUser('a');
    const userB = await registerCookieUser('b');
    registeredEmails.push(userA.email, userB.email);

    expect(userA.accessCookie).toBeTruthy();
    expect(userB.accessCookie).toBeTruthy();
    expect(userA.csrfCookie).toBeTruthy();

    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Origin', ORIGIN)
      // B's auth+refresh cookies → req.user resolves to B (authTokenSource='cookie')
      // paired with A's csrf cookie + token → identifier mismatch → 403.
      .set('Cookie', [userB.accessCookie, userB.refreshCookie, userA.csrfCookie].join('; '))
      .set('X-CSRF-Token', userA.csrfToken)
      .send({ notifications: { email: false } });

    expect(res.status).toBe(403);
    expect(res.body?.code).toBe('INVALID_CSRF_TOKEN');
  }, 120000);
});
