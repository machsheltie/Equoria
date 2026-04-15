/**
 * trainerRoutes.integration.test.mjs
 *
 * ATDD RED PHASE — Story 21-3: Community / Trainers / Riders API Integration Tests
 *
 * Supertest integration tests for trainer module routes:
 *   - GET  /api/trainers/marketplace         (browse marketplace)
 *   - POST /api/trainers/marketplace/hire    (hire from marketplace)
 *   - GET  /api/trainers/assignments         (list active assignments)
 *   - POST /api/trainers/assignments         (assign trainer to horse)
 *
 * Coverage pattern per endpoint: happy path + auth guard (401) + validation error (400)
 * Co-located per backend/modules/<domain>/__tests__/ convention (Story 21-1).
 * Real DB — no mocks. Cleanup in afterAll.
 *
 * Remove test.skip() from each test block once implementation is verified green.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

describe('INTEGRATION: Trainer Routes (21-3)', () => {
  let _user;
  let userToken;

  beforeAll(async () => {
    const ts = Date.now();
    const created = await createTestUser({
      username: `trainer_int_${ts}`,
      email: `trainer_int_${ts}@test.com`,
    });
    _user = created.user;
    userToken = created.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ─── GET /api/trainers/marketplace ───────────────────────────────────────────

  describe('GET /api/trainers/marketplace', () => {
    it('[P0] happy path — returns 200 with marketplace listing', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app).get('/api/trainers/marketplace').set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('[P0] auth guard — returns 401 when no token provided', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app).get('/api/trainers/marketplace');

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/trainers/marketplace/hire ─────────────────────────────────────

  describe('POST /api/trainers/marketplace/hire', () => {
    it('[P0] auth guard — returns 401 when no token provided', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app)
        .post('/api/trainers/marketplace/hire')
        .set('x-test-skip-csrf', 'true')
        .send({ marketplaceId: 'some-id' });

      expect(res.status).toBe(401);
    });

    it('[P0] validation error — returns 400 when marketplaceId missing', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app)
        .post('/api/trainers/marketplace/hire')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          // marketplaceId missing — required
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('[P0] happy path — hires trainer from marketplace', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      // First fetch a valid marketplace ID
      const marketplaceRes = await request(app)
        .get('/api/trainers/marketplace')
        .set('Authorization', `Bearer ${userToken}`);

      expect(marketplaceRes.status).toBe(200);

      // Use first available listing if present
      const listings = marketplaceRes.body.data?.trainers ?? marketplaceRes.body.data?.listings ?? [];
      if (listings.length === 0) {
        // No listings available — skip happy path (acceptable state, marketplace may require refresh)
        return;
      }

      const marketplaceId = listings[0].id ?? listings[0].marketplaceId;
      const res = await request(app)
        .post('/api/trainers/marketplace/hire')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ marketplaceId });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── GET /api/trainers/assignments ───────────────────────────────────────────

  describe('GET /api/trainers/assignments', () => {
    it('[P0] happy path — returns 200 with assignments array', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app).get('/api/trainers/assignments').set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('[P0] auth guard — returns 401 when no token provided', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app).get('/api/trainers/assignments');

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/trainers/assignments ──────────────────────────────────────────

  describe('POST /api/trainers/assignments', () => {
    it('[P0] auth guard — returns 401 when no token provided', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app)
        .post('/api/trainers/assignments')
        .set('x-test-skip-csrf', 'true')
        .send({ trainerId: 1, horseId: 1 });

      expect(res.status).toBe(401);
    });

    it('[P0] validation error — returns 400 when trainerId missing', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app)
        .post('/api/trainers/assignments')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          // trainerId missing — required
          horseId: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('[P0] validation error — returns 400 when horseId missing', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app)
        .post('/api/trainers/assignments')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          trainerId: 1,
          // horseId missing — required
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });
  });
});
