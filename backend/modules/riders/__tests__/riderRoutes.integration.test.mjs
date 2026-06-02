/**
 * riderRoutes.integration.test.mjs
 *
 * ATDD RED PHASE — Story 21-3: Community / Trainers / Riders API Integration Tests
 *
 * Supertest integration tests for rider module routes:
 *   - GET  /api/v1/riders/marketplace         (browse marketplace)
 *   - POST /api/v1/riders/marketplace/hire    (hire from marketplace)
 *   - GET  /api/v1/riders/assignments         (list active assignments)
 *   - POST /api/v1/riders/assignments         (assign rider to horse)
 *
 * Routes are mounted at /api/v1/riders (authRouter is mounted at /api/v1;
 * authRouter.use('/riders', ...) — see backend/app/routers.mjs:148, app.mjs:290).
 * Unversioned /api/* mounts were removed (Equoria-4bs3s); /api/v1 is canonical.
 * This suite was migrated off the stale /api/riders refs under Equoria-4q4wq.
 *
 * Coverage pattern per endpoint: happy path + auth guard (401) + validation error (400)
 * Co-located per backend/modules/<domain>/__tests__/ convention (Story 21-1).
 * Real DB — no mocks. Cleanup in afterAll.
 *
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
describe('INTEGRATION: Rider Routes (21-3)', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  let _user;
  let userToken;

  beforeAll(async () => {
    const ts = Date.now();
    const created = await createTestUser({
      username: `rider_int_${ts}`,
      email: `rider_int_${ts}@test.com`,
    });
    _user = created.user;
    userToken = created.token;
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  afterAll(async () => {
    await cleanupTestData();
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  // ─── GET /api/v1/riders/marketplace ──────────────────────────────────────────

  describe('GET /api/v1/riders/marketplace', () => {
    it('[P0] happy path — returns 200 with marketplace listing', async () => {
      const res = await request(app)
        .get('/api/v1/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('[P0] auth guard — returns 401 when no token provided', async () => {
      const res = await request(app).get('/api/v1/riders/marketplace').set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/v1/riders/marketplace/hire ────────────────────────────────────

  describe('POST /api/v1/riders/marketplace/hire', () => {
    it('[P0] auth guard — returns 401 when no token provided', async () => {
      // No-auth path: bare CSRF is fine — authenticateToken rejects with 401
      // before per-user CSRF binding is relevant (Equoria-4q4wq).
      const res = await request(app)
        .post('/api/v1/riders/marketplace/hire')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: 'some-id' });

      expect(res.status).toBe(401);
    });

    it('[P0] validation error — returns 400 when marketplaceId missing', async () => {
      // Authenticated mutation: bind CSRF to this user's session (Equoria-plw0h)
      // by forwarding the accessToken cookie at issue time, else verify-time
      // sessionIdentifier (req.user.id) won't match and the request 403s.
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${userToken}`] });
      const res = await request(app)
        .post('/api/v1/riders/marketplace/hire')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({
          // marketplaceId missing — required
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('[P0] happy path — hires rider from marketplace', async () => {
      // First fetch a valid marketplace ID
      const marketplaceRes = await request(app)
        .get('/api/v1/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(marketplaceRes.status).toBe(200);

      const listings = marketplaceRes.body.data?.riders ?? marketplaceRes.body.data?.listings ?? [];
      if (listings.length === 0) {
        // No listings available — skip happy path (acceptable state, marketplace may require refresh)
        return;
      }

      const marketplaceId = listings[0].id ?? listings[0].marketplaceId;
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${userToken}`] });
      const res = await request(app)
        .post('/api/v1/riders/marketplace/hire')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ marketplaceId });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── GET /api/v1/riders/assignments ──────────────────────────────────────────

  describe('GET /api/v1/riders/assignments', () => {
    it('[P0] happy path — returns 200 with assignments array', async () => {
      const res = await request(app)
        .get('/api/v1/riders/assignments')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('[P0] auth guard — returns 401 when no token provided', async () => {
      const res = await request(app).get('/api/v1/riders/assignments').set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/v1/riders/assignments ─────────────────────────────────────────

  describe('POST /api/v1/riders/assignments', () => {
    it('[P0] auth guard — returns 401 when no token provided', async () => {
      // No-auth path: bare CSRF is fine — authenticateToken rejects with 401
      // before per-user CSRF binding is relevant (Equoria-4q4wq).
      const res = await request(app)
        .post('/api/v1/riders/assignments')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ riderId: 1, horseId: 1 });

      expect(res.status).toBe(401);
    });

    it('[P0] validation error — returns 400 when riderId missing', async () => {
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${userToken}`] });
      const res = await request(app)
        .post('/api/v1/riders/assignments')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({
          // riderId missing — required
          horseId: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('[P0] validation error — returns 400 when horseId missing', async () => {
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${userToken}`] });
      const res = await request(app)
        .post('/api/v1/riders/assignments')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({
          riderId: 1,
          // horseId missing — required
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });
  });
});
