/**
 * Sentinel-positive integration test for per-user CSRF session binding
 * (Equoria-plw0h).
 *
 * Before the fix: `getSessionIdentifier` was a CONSTANT (`CSRF_SESSION_SALT`).
 * A CSRF token issued for User A validated successfully when submitted with
 * User B's authenticated session — the HMAC is identical because the session
 * identifier was identical. This is the defense-in-depth gap the AC
 * describes: if a planted cookie+header pair lands in the victim's browser,
 * it would otherwise sail through validation.
 *
 * After the fix: `getSessionIdentifier` resolves to `req.user?.id` for an
 * authenticated request, the refresh-token cookie for a recently logged-in
 * one, and the constant salt only as a last resort. A token minted under
 * User A's identifier cannot validate when the request comes in with
 * User B's identifier — different HMAC inputs produce different HMACs.
 *
 * Real DB, real Express app, no mocks, no bypass headers — per the Equoria
 * Testing Philosophy.
 *
 * @module __tests__/auth/csrfPerUserBinding
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

const ORIGIN = 'http://localhost:3000';
const PREFIX = 'csrfbind-';

function extractCookie(setCookieHeader, name) {
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  const match = list.find(c => c.startsWith(`${name}=`));
  return match ? match.split(';')[0] : null;
}

async function registerUser(suffix) {
  const unique = `${suffix}-${randomBytes(6).toString('hex')}`;
  const email = `${PREFIX}${unique}@test.com`;
  const username = `${PREFIX}${unique}`.replace(/-/g, '').slice(0, 30);
  const res = await request(app).post('/api/v1/auth/register').set('Origin', ORIGIN).send({
    email,
    username,
    password: 'TestPass123!',
    firstName: 'Csrf',
    lastName: 'Bind',
    dateOfBirth: '1990-01-01',
  });
  expect(res.status).toBe(201);
  const accessCookie = extractCookie(res.headers['set-cookie'], 'accessToken');
  const refreshCookie = extractCookie(res.headers['set-cookie'], 'refreshToken');
  const csrfCookieName = process.env.NODE_ENV === 'production' ? '__Host-csrf' : '_csrf';
  const csrfCookie = extractCookie(res.headers['set-cookie'], csrfCookieName);
  expect(accessCookie).toBeTruthy();
  expect(refreshCookie).toBeTruthy();
  expect(csrfCookie).toBeTruthy();
  const csrfToken = res.body?.data?.csrfToken;
  expect(typeof csrfToken).toBe('string');
  return {
    email,
    accessCookie,
    refreshCookie,
    csrfCookie,
    csrfToken,
  };
}

describe('CSRF — per-user session binding (Equoria-plw0h)', () => {
  let userA;
  let userB;

  beforeAll(async () => {
    // Clear any leftover fixtures from prior runs (scoped delete only).
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } }).catch(() => undefined);
    userA = await registerUser('a');
    userB = await registerUser('b');
  }, 60_000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } }).catch(() => undefined);
  }, 30_000);

  it("User A's CSRF token paired with User A's session succeeds (control)", async () => {
    // Sanity baseline — the happy path must still work.
    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Origin', ORIGIN)
      .set('Cookie', [userA.accessCookie, userA.refreshCookie, userA.csrfCookie].join('; '))
      .set('X-CSRF-Token', userA.csrfToken)
      .send({ notifications: { email: false } });
    expect(res.status).toBe(200);
  }, 30_000);

  it("User A's CSRF token paired with User B's session FAILS with 403", async () => {
    // sentinel

    // This is the sentinel. Pre-fix the request succeeds (200) because the
    // sessionIdentifier was constant — User A's HMAC validates under User B's
    // session. Post-fix the sessionIdentifier differs (A.id vs B.id), the
    // HMAC does not validate, and the request is rejected 403.
    //
    // We send User B's auth+refresh cookies (so authenticateToken resolves
    // to User B) but pair them with User A's _csrf cookie + X-CSRF-Token.
    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Origin', ORIGIN)
      .set('Cookie', [userB.accessCookie, userB.refreshCookie, userA.csrfCookie].join('; '))
      .set('X-CSRF-Token', userA.csrfToken)
      .send({ notifications: { email: false } });
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe('INVALID_CSRF_TOKEN');
  }, 30_000);
});
