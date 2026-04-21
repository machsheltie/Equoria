/**
 * memoryAdminGuard.integration.test.mjs
 *
 * ATDD RED PHASE — Story 21S-8: the destructive memory-management endpoints
 * (`POST /api/memory/cleanup` and `POST /api/memory/gc`) must reject
 * non-admin authenticated users with 403. Only admin-role accounts should
 * reach the controller body.
 *
 * Real-DB integration test — no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

describe('INTEGRATION: memory-management admin guard (21S-8)', () => {
  let regularToken;
  let adminToken;

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
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('POST /api/memory/cleanup', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/memory/cleanup').send({});
      expect(res.status).toBe(401);
    });

    it('returns 403 for authenticated non-admin user', async () => {
      const res = await request(app)
        .post('/api/memory/cleanup')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ resourceTypes: ['all'] });
      expect(res.status).toBe(403);
    });

    it('returns 200 for admin user', async () => {
      const res = await request(app)
        .post('/api/memory/cleanup')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ resourceTypes: ['all'] });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/memory/gc', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/memory/gc').send({});
      expect(res.status).toBe(401);
    });

    it('returns 403 for authenticated non-admin user', async () => {
      const res = await request(app)
        .post('/api/memory/gc')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ force: false });
      expect(res.status).toBe(403);
    });

    it('returns 200 or 400 for admin user (400 is acceptable when --expose-gc is off)', async () => {
      // Jest processes don't start with --expose-gc, so the controller returns
      // 400 ("Garbage collection not exposed") rather than 200. Either is
      // proof that the admin guard passed — the non-admin path would have
      // short-circuited with 403 before reaching the controller body.
      const res = await request(app)
        .post('/api/memory/gc')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ force: false });
      expect([200, 400]).toContain(res.status);
    });
  });
});
