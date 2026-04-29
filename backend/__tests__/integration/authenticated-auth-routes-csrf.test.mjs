/**
 * Authenticated auth-route CSRF protection — regression canary.
 *
 * Every authenticated state-changing route under /api/auth/* MUST traverse
 * the authRouter's `authenticateToken` + `csrfProtection` middleware stack.
 * This file asserts each one in turn:
 *
 *   - PUT    /api/auth/profile
 *   - POST   /api/auth/logout
 *   - POST   /api/auth/change-password
 *   - POST   /api/auth/resend-verification
 *   - POST   /api/auth/complete-onboarding
 *   - POST   /api/auth/advance-onboarding
 *   - PATCH  /api/auth/profile/preferences
 *
 * For each, we prove:
 *   A) without a CSRF cookie+header, the authenticated call returns 403
 *      INVALID_CSRF_TOKEN (i.e. it actually hits csrfProtection).
 *
 * If any of these routes accidentally gets remounted on `publicRouter`, or
 * its handler stops traversing authRouter, the authenticated call will
 * either succeed or return a non-CSRF error — both break this suite.
 *
 * @module __tests__/integration/authenticated-auth-routes-csrf.test
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { jest as _jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';

_jest.setTimeout(120000);

const ORIGIN = 'http://localhost:3000';
const PREFIX = 'authcsrf';

const extractAccessCookie = setCookieHeader => {
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  const match = cookies.find(c => c.startsWith('accessToken='));
  return match ? match.split(';')[0] : null;
};

describe('authenticated auth routes — CSRF enforcement canary', () => {
  let testUser;
  let accessCookie;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });

  beforeEach(async () => {
    const unique = `${randomBytes(8).toString('hex')}${Math.floor(Math.random() * 10000)}`;
    const email = `${PREFIX}${unique}@test.com`;
    const username = `${PREFIX}${unique}`;

    const res = await request(app).post('/auth/register').set('Origin', ORIGIN).send({
      email,
      username,
      password: 'TestPass123!',
      firstName: 'Auth',
      lastName: 'CSRF',
    });

    expect(res.status).toBe(201);
    accessCookie = extractAccessCookie(res.headers['set-cookie']);
    expect(accessCookie).toBeTruthy();

    testUser = await prisma.user.findUnique({ where: { email } });
  });

  afterEach(async () => {
    if (testUser) {
      await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      testUser = null;
    }
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });

  const authenticatedMutations = [
    { method: 'put', path: '/api/auth/profile', body: { firstName: 'X' } },
    { method: 'post', path: '/api/auth/logout', body: {} },
    {
      method: 'post',
      path: '/api/auth/change-password',
      body: { oldPassword: 'TestPass123!', newPassword: 'NewPass123!' },
    },
    { method: 'post', path: '/api/auth/resend-verification', body: {} },
    { method: 'post', path: '/api/auth/complete-onboarding', body: {} },
    { method: 'post', path: '/api/auth/advance-onboarding', body: {} },
    { method: 'patch', path: '/api/auth/profile/preferences', body: {} },
  ];

  describe.each(authenticatedMutations)('$method $path', ({ method, path, body }) => {
    it('rejects the authenticated call without CSRF with 403 INVALID_CSRF_TOKEN', async () => {
      const res = await request(app)[method](path).set('Origin', ORIGIN).set('Cookie', accessCookie).send(body);

      // If this endpoint is correctly behind authRouter's csrfProtection,
      // the rejection is specifically INVALID_CSRF_TOKEN, not NOT_FOUND,
      // not METHOD_NOT_ALLOWED, not a generic 500, not a success. A
      // regression that remounts this route on publicRouter fails here.
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('INVALID_CSRF_TOKEN');
    });
  });
});
