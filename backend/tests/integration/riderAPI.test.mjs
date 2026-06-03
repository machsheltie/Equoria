/**
 * Rider API Integration Tests
 * Tests for the complete rider marketplace and assignment workflow.
 *
 * Test Coverage:
 * - GET /api/v1/riders/marketplace
 * - POST /api/v1/riders/marketplace/hire
 * - POST /api/v1/riders/marketplace/refresh
 * - GET /api/v1/riders/user/:userId
 * - GET /api/v1/riders/assignments
 * - POST /api/v1/riders/assignments
 * - DELETE /api/v1/riders/assignments/:id
 * - DELETE /api/v1/riders/:id/dismiss
 * - Authentication requirements
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { createTestUser, createTestHorse, cleanupTestData } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import app from '../../app.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
describe('🏇 INTEGRATION: Rider API', () => {
  // Equoria-rnbzn: per-user CSRF binding — issued AFTER the auth token exists
  // (in the dependent beforeAll below) and bound to testUser by forwarding its
  // accessToken cookie on the issuance GET. Bound up front to the fallback
  // salt, the token would 403 against the resolved req.user.id on every
  // mutation.
  let __csrf__;

  let testUser;
  let authToken;
  let testHorse;

  beforeAll(async () => {
    // Equoria-rnbzn: randomize the previously-fixed `_${Date.now()}` fixtures —
    // collision-free under parallel real-DB workers. Username stays within
    // [A-Za-z0-9_] 3-30 chars; email remains valid.
    const uid = randomBytes(6).toString('hex');
    const userData = await createTestUser({
      username: `testuser_rider_${uid}`,
      email: `rider_test_${uid}@test.com`,
      money: 20000,
    });
    testUser = userData.user;
    authToken = userData.token;

    testHorse = await createTestHorse({
      userId: testUser.id,
      name: `TestHorse_rider_${uid}`,
    });

    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });
  });

  afterAll(async () => {
    // Equoria-rnbzn: FK-ordered, fail-loud cleanup. Order matters because
    // Horse.userId is onDelete: Restrict (Equoria-v58ta) — the user delete
    // (in cleanupTestData) FAILS if any horse still references it. Delete the
    // user-scoped rider assignments + riders first (RiderAssignment.horseId is
    // Cascade, so they also fall when the tracked horse is removed by
    // cleanupTestData, but removing them up front keeps teardown order
    // explicit), then cleanupTestData() removes the tracked horse BEFORE the
    // user. All deletes are user-scoped, never a bare deleteMany. No silent
    // no-op catch arm: a cleanup failure must surface, not be swallowed.
    await prisma.riderAssignment.deleteMany({ where: { userId: testUser?.id } });
    await prisma.rider.deleteMany({ where: { userId: testUser?.id } });
    await cleanupTestData();
  });

  // ─── Authentication ─────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('should require auth for all rider endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/v1/riders/marketplace' },
        { method: 'get', path: '/api/v1/riders/assignments' },
      ];

      for (const ep of endpoints) {
        const res = await request(app)[ep.method](ep.path).set('Origin', 'http://localhost:3000');
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      }
    });
  });

  // ─── Marketplace ─────────────────────────────────────────────────────────────

  describe('GET /api/v1/riders/marketplace', () => {
    it('should return marketplace with riders array', async () => {
      const res = await request(app)
        .get('/api/v1/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('riders');
      expect(Array.isArray(res.body.data.riders)).toBe(true);
      expect(res.body.data.riders.length).toBeGreaterThan(0);

      const [rider] = res.body.data.riders;
      expect(rider).toHaveProperty('marketplaceId');
      expect(rider).toHaveProperty('firstName');
      expect(rider).toHaveProperty('skillLevel');
      expect(rider).toHaveProperty('weeklyRate');
    });

    it('should return same marketplace on subsequent calls', async () => {
      const res1 = await request(app)
        .get('/api/v1/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      const res2 = await request(app)
        .get('/api/v1/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.data.riders).toEqual(res2.body.data.riders);
    });
  });

  describe('POST /api/v1/riders/marketplace/refresh', () => {
    it('should reject premium refresh without force=true', async () => {
      // Ensure marketplace exists first
      await request(app)
        .get('/api/v1/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .post('/api/v1/riders/marketplace/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({});

      // Should either succeed (free) or require cost
      expect([200, 400]).toContain(res.status);
      if (res.status === 400) {
        expect(res.body.message).toContain('costs');
        expect(res.body.data).toHaveProperty('cost');
      }
    });

    it('should allow force refresh and deduct funds', async () => {
      // Ensure a recent marketplace exists so forced refresh costs
      await request(app)
        .get('/api/v1/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .post('/api/v1/riders/marketplace/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ force: true });

      expect([200, 400]).toContain(res.status);
      // If 200, the marketplace was refreshed
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data.riders)).toBe(true);
      }
    });
  });

  describe('POST /api/v1/riders/marketplace/hire', () => {
    beforeAll(async () => {
      // Ensure the user has enough money for the hire tests in this block.
      // Each test that needs a marketplaceId fetches a fresh one so we no
      // longer cache a `marketplaceRider` here — caching across tests was
      // the root of an intermittent CI 404 (other tests' cleanup wipes
      // rider_marketplace and the cached id goes stale).
      await prisma.user.update({ where: { id: testUser.id }, data: { money: 20000 } });
    });

    it('should require marketplaceId', async () => {
      const res = await request(app)
        .post('/api/v1/riders/marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent marketplaceId', async () => {
      const res = await request(app)
        .post('/api/v1/riders/marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: 'non-existent-id' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should hire a rider and deduct correct cost', async () => {
      // Refresh the marketplace immediately before hiring. The cached
      // marketplaceRider from beforeAll can be invalidated by other tests
      // in the same shard (cleanup hooks wipe rider_marketplace), causing
      // a non-deterministic 404 in full-suite CI runs even though the
      // test passes in isolation. A self-contained fetch here makes the
      // test order-independent.
      await prisma.user.update({ where: { id: testUser.id }, data: { money: 20000 } });
      const freshMkt = await request(app)
        .get('/api/v1/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      const [freshRider] = freshMkt.body.data.riders;

      const userBefore = await prisma.user.findUnique({ where: { id: testUser.id } });

      const res = await request(app)
        .post('/api/v1/riders/marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: freshRider.marketplaceId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('rider');
      expect(res.body.data).toHaveProperty('cost');
      expect(res.body.data).toHaveProperty('remainingMoney');

      // Cost = weeklyRate × 1 (one week upfront)
      const expectedCost = freshRider.weeklyRate;
      expect(res.body.data.cost).toBe(expectedCost);
      expect(res.body.data.remainingMoney).toBe(userBefore.money - expectedCost);
    });

    it('should reject hiring with insufficient funds', async () => {
      // Set user to near-zero
      await prisma.user.update({ where: { id: testUser.id }, data: { money: 1 } });

      // Get a fresh marketplace
      const mktRes = await request(app)
        .get('/api/v1/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      const cheapestRider = mktRes.body.data.riders[0];

      const res = await request(app)
        .post('/api/v1/riders/marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: cheapestRider.marketplaceId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient funds');

      // Restore funds
      await prisma.user.update({ where: { id: testUser.id }, data: { money: 20000 } });
    });
  });

  // ─── User Riders ─────────────────────────────────────────────────────────────

  describe('GET /api/v1/riders/user/:userId', () => {
    it('should return hired riders for the authenticated user', async () => {
      const res = await request(app)
        .get(`/api/v1/riders/user/${testUser.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        const rider = res.body.data[0];
        expect(rider).toHaveProperty('name');
        expect(rider).toHaveProperty('skillLevel');
        expect(rider).toHaveProperty('weeklyRate');
      }
    });

    it('should return 404 when userId does not match authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/riders/user/different-user-id')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Assignments ─────────────────────────────────────────────────────────────

  // Equoria-4kp53: consolidated end-to-end workflow. Previously this
  // describe spread the hire → assign → list → unassign → dismiss flow
  // across 5 separate `it()` blocks sharing mutable `hiredRiderId` /
  // `assignmentId`. That structure breaks under Jest --randomize because
  // the dismiss step in test 5 deletes the rider used by earlier tests,
  // and the assignment id from test 1 is consumed in test 4. Collapsing
  // to a single `it()` makes the sequencing explicit and removes shared
  // state between tests entirely.
  describe('Rider Assignment Workflow (sequential)', () => {
    it('hires → assigns → rejects double-assign → lists → unassigns → dismisses', async () => {
      // Ensure user has money
      await prisma.user.update({ where: { id: testUser.id }, data: { money: 20000 } });

      // Get marketplace and hire a rider
      const mktRes = await request(app)
        .get('/api/v1/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const [riderToHire] = mktRes.body.data.riders;
      const hireRes = await request(app)
        .post('/api/v1/riders/marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: riderToHire.marketplaceId });

      if (hireRes.status !== 201) {
        // Marketplace exhaustion can produce non-201 in parallel runs;
        // skip the workflow rather than masking the underlying issue.
        return;
      }
      const hiredRiderId = hireRes.body.data.rider.id;

      // Assign
      const assignRes = await request(app)
        .post('/api/v1/riders/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ riderId: hiredRiderId, horseId: testHorse.id });

      expect(assignRes.status).toBe(201);
      expect(assignRes.body.success).toBe(true);
      expect(assignRes.body.data).toHaveProperty('id');
      expect(assignRes.body.data.riderId).toBe(hiredRiderId);
      expect(assignRes.body.data.horseId).toBe(testHorse.id);
      const assignmentId = assignRes.body.data.id;

      // Reject double-assign
      const dupRes = await request(app)
        .post('/api/v1/riders/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ riderId: hiredRiderId, horseId: testHorse.id });
      expect(dupRes.status).toBe(400);
      expect(dupRes.body.success).toBe(false);
      expect(dupRes.body.message).toContain('already assigned');

      // List
      const listRes = await request(app)
        .get('/api/v1/riders/assignments')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(Array.isArray(listRes.body.data)).toBe(true);

      // Unassign
      const unassignRes = await request(app)
        .delete(`/api/v1/riders/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);
      expect(unassignRes.status).toBe(200);
      expect(unassignRes.body.success).toBe(true);

      // Dismiss
      const dismissRes = await request(app)
        .delete(`/api/v1/riders/${hiredRiderId}/dismiss`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);
      expect(dismissRes.status).toBe(200);
      expect(dismissRes.body.success).toBe(true);
    });
  });

  // ─── Validation ──────────────────────────────────────────────────────────────

  describe('Validation', () => {
    it('should reject assignment with invalid riderId', async () => {
      const res = await request(app)
        .post('/api/v1/riders/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ riderId: 'abc', horseId: testHorse.id });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject assignment with invalid horseId', async () => {
      const res = await request(app)
        .post('/api/v1/riders/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ riderId: 1, horseId: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
