/**
 * memoryAdminGuard.integration.test.mjs
 *
 * ATDD RED PHASE — Story 21S-8: the destructive memory-management endpoints
 * (`POST /api/v1/memory/cleanup` and `POST /api/v1/memory/gc`) must reject
 * non-admin authenticated users with 403. Only admin-role accounts should
 * reach the controller body.
 *
 * Routes live under authRouter at /api/v1/memory (Equoria-vivsi: the
 * unversioned /api/* mounts were removed in Equoria-4bs3s; /api/v1 is the
 * canonical surface — verified in backend/app.mjs:290 + backend/app/routers.mjs:188).
 *
 * Real-DB integration test — no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
describe('INTEGRATION: memory-management admin guard (21S-8)', () => {
  // Equoria-vivsi: per-user CSRF binding. On authRouter the chain is
  // authenticateToken → csrfProtection → (route-level) requireRole('admin')
  // (routers.mjs:93,95; memoryManagementRoutes.mjs:196-199,263-266). CSRF
  // therefore validates BEFORE the admin guard runs, so a salt-bound token
  // would 403 on CSRF for ANY authenticated caller — masking the real
  // role-403 (non-admin) and breaking the admin 200/400 path entirely. We
  // mint a CSRF token bound to each user (forward their accessToken on the
  // GET so getCsrfToken's tryPopulateUserFromAccessCookie resolves req.user.id
  // — csrf.mjs:95-108) so the role guard is what the test actually exercises.
  let regularToken;
  let adminToken;
  let regularCsrf;
  let adminCsrf;

  beforeAll(async () => {
    const ts = Date.now();
    const regular = await createTestUser({
      username: `memory_regular_${ts}`,
      email: `memory_regular_${ts}@test.com`,
    });
    regularToken = regular.token;

    const admin = await createTestUser({
      username: `memory_admin_${ts}`,
      email: `memory_admin_${ts}@test.com`,
      role: 'admin',
    });
    adminToken = admin.token;

    regularCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${regularToken}`] });
    adminCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${adminToken}`] });
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  afterAll(async () => {
    await cleanupTestData();
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  describe('POST /api/v1/memory/cleanup', () => {
    it('returns 401 when unauthenticated', async () => {
      // No CSRF/auth headers: authenticateToken (authRouter) 401s before
      // csrfProtection is reached, so no token is needed for this assertion.
      const res = await request(app).post('/api/v1/memory/cleanup').set('Origin', 'http://localhost:3000').send({});
      expect(res.status).toBe(401);
    });

    it('returns 403 for authenticated non-admin user', async () => {
      const res = await request(app)
        .post('/api/v1/memory/cleanup')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', regularCsrf.cookieHeader)
        .set('X-CSRF-Token', regularCsrf.csrfToken)
        .send({ resourceTypes: ['all'] });
      expect(res.status).toBe(403);
    });

    it('returns 200 for admin user', async () => {
      const res = await request(app)
        .post('/api/v1/memory/cleanup')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', adminCsrf.cookieHeader)
        .set('X-CSRF-Token', adminCsrf.csrfToken)
        .send({ resourceTypes: ['all'] });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/memory/gc', () => {
    it('returns 401 when unauthenticated', async () => {
      // No CSRF/auth headers: authenticateToken (authRouter) 401s before
      // csrfProtection is reached, so no token is needed for this assertion.
      const res = await request(app).post('/api/v1/memory/gc').set('Origin', 'http://localhost:3000').send({});
      expect(res.status).toBe(401);
    });

    it('returns 403 for authenticated non-admin user', async () => {
      const res = await request(app)
        .post('/api/v1/memory/gc')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', regularCsrf.cookieHeader)
        .set('X-CSRF-Token', regularCsrf.csrfToken)
        .send({ force: false });
      expect(res.status).toBe(403);
    });

    it('returns 200 or 400 for admin user (400 is acceptable when --expose-gc is off)', async () => {
      // Jest processes don't start with --expose-gc, so the controller returns
      // 400 ("Garbage collection not exposed") rather than 200. Either is
      // proof that the admin guard passed — the non-admin path would have
      // short-circuited with 403 before reaching the controller body.
      const res = await request(app)
        .post('/api/v1/memory/gc')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', adminCsrf.cookieHeader)
        .set('X-CSRF-Token', adminCsrf.csrfToken)
        .send({ force: false });
      expect([200, 400]).toContain(res.status);
    });
  });
});
