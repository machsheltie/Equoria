/**
 * The hidden old player-guide server is gone (Equoria-a7f1p).
 *
 * Owner ruling q340 (2026-11-03): remove the hidden old player-guide pages.
 * /user-docs and /api/user-docs served one 17-line starter page from
 * backend/docs/user-guide with no screen linking to it; the in-game Guide is
 * the /guide page. The admin cache refresh for those pages went with them.
 *
 * Old contract: GET /user-docs, /api/user-docs and their sub-paths answered
 * 200, and POST /api/v1/admin/docs/refresh answered 200 for a checked-in
 * admin. Ruling: every one answers 404 now. The neighbouring API docs route
 * (/api/docs/health, authenticated) is pinned too, so the removal did not take
 * a live route with it.
 *
 * Real app, real DB, real CSRF and staff check-in, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { checkedInDeviceCookie } from '../tests/helpers/staffDeviceFixture.mjs';

const ORIGIN = 'http://localhost:3000';

describe('the old player-guide server is removed (q340)', () => {
  const tag = randomBytes(5).toString('hex');
  const cleanup = createCleanupTracker();
  let admin;
  let adminToken;
  let adminDevice;

  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [admin?.id].filter(Boolean) } } }), 'admin');

  beforeAll(async () => {
    admin = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `TestFixture-userdocs-${tag}`,
        email: `testfixture-userdocs-${tag}@example.com`,
        password: 'not-a-login-hash',
        firstName: 'TestFixture',
        lastName: 'UserDocs',
        role: 'admin',
      },
    });
    adminToken = generateTestToken({ id: admin.id, role: 'admin' });
    adminDevice = await checkedInDeviceCookie(admin.id);
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it.each([
    '/user-docs',
    '/user-docs/health',
    '/user-docs/feature-guide',
    '/api/user-docs',
    '/api/user-docs/health',
    '/api/user-docs/toc',
    '/api/user-docs/search?q=horse',
    '/api/user-docs/feature-guide',
  ])('GET %s answers 404', async path => {
    const res = await request(app).get(path).set('Origin', ORIGIN);
    expect(res.status).toBe(404);
  });

  it('POST /api/v1/admin/docs/refresh answers 404 for a checked-in admin', async () => {
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [adminDevice] });
    const res = await request(app)
      .post('/api/v1/admin/docs/refresh')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(404);
  });

  it('the API docs neighbour still answers (GET /api/docs/health for a signed-in account)', async () => {
    const res = await request(app)
      .get('/api/docs/health')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
