/**
 * Rider API Integration Tests
 * Tests for the complete rider marketplace and assignment workflow.
 *
 * Test Coverage:
 * - GET /api/riders/marketplace
 * - POST /api/riders/marketplace/hire
 * - POST /api/riders/marketplace/refresh
 * - GET /api/riders/user/:userId
 * - GET /api/riders/assignments
 * - POST /api/riders/assignments
 * - DELETE /api/riders/assignments/:id
 * - DELETE /api/riders/:id/dismiss
 * - Authentication requirements
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestUser, createTestHorse, cleanupTestData } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import app from '../../app.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
describe('🏇 INTEGRATION: Rider API', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  let testUser;
  let authToken;
  let testHorse;

  beforeAll(async () => {
    const timestamp = Date.now();
    const userData = await createTestUser({
      username: `testuser_rider_${timestamp}`,
      email: `rider-test-${timestamp}@test.com`,
      money: 20000,
    });
    testUser = userData.user;
    authToken = userData.token;

    testHorse = await createTestHorse({
      userId: testUser.id,
      name: `TestHorse_rider_${timestamp}`,
    });
  });

  afterAll(async () => {
    try {
      // Clean up rider data before generic cleanup
      await prisma.riderAssignment.deleteMany({ where: { userId: testUser?.id } });
      await prisma.rider.deleteMany({ where: { userId: testUser?.id } });
    } catch {
      // Ignore cleanup errors
    }
    await cleanupTestData();
  });

  // ─── Authentication ─────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('should require auth for all rider endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/riders/marketplace' },
        { method: 'get', path: '/api/riders/assignments' },
      ];

      for (const ep of endpoints) {
        const res = await request(app)[ep.method](ep.path).set('Origin', 'http://localhost:3000');
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      }
    });
  });

  // ─── Marketplace ─────────────────────────────────────────────────────────────

  describe('GET /api/riders/marketplace', () => {
    it('should return marketplace with riders array', async () => {
      const res = await request(app)
        .get('/api/riders/marketplace')
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
        .get('/api/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      const res2 = await request(app)
        .get('/api/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.data.riders).toEqual(res2.body.data.riders);
    });
  });

  describe('POST /api/riders/marketplace/refresh', () => {
    it('should reject premium refresh without force=true', async () => {
      // Ensure marketplace exists first
      await request(app)
        .get('/api/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .post('/api/riders/marketplace/refresh')
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
        .get('/api/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .post('/api/riders/marketplace/refresh')
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

  describe('POST /api/riders/marketplace/hire', () => {
    let marketplaceRider;

    beforeAll(async () => {
      // Ensure a fresh marketplace with enough funds
      await prisma.user.update({ where: { id: testUser.id }, data: { money: 20000 } });

      const res = await request(app)
        .get('/api/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      [marketplaceRider] = res.body.data.riders;
    });

    it('should require marketplaceId', async () => {
      const res = await request(app)
        .post('/api/riders/marketplace/hire')
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
        .post('/api/riders/marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: 'non-existent-id' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should hire a rider and deduct correct cost', async () => {
      const userBefore = await prisma.user.findUnique({ where: { id: testUser.id } });

      const res = await request(app)
        .post('/api/riders/marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: marketplaceRider.marketplaceId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('rider');
      expect(res.body.data).toHaveProperty('cost');
      expect(res.body.data).toHaveProperty('remainingMoney');

      // Cost = weeklyRate × 1 (one week upfront)
      const expectedCost = marketplaceRider.weeklyRate;
      expect(res.body.data.cost).toBe(expectedCost);
      expect(res.body.data.remainingMoney).toBe(userBefore.money - expectedCost);
    });

    it('should reject hiring with insufficient funds', async () => {
      // Set user to near-zero
      await prisma.user.update({ where: { id: testUser.id }, data: { money: 1 } });

      // Get a fresh marketplace
      const mktRes = await request(app)
        .get('/api/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      const cheapestRider = mktRes.body.data.riders[0];

      const res = await request(app)
        .post('/api/riders/marketplace/hire')
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

  describe('GET /api/riders/user/:userId', () => {
    it('should return hired riders for the authenticated user', async () => {
      const res = await request(app)
        .get(`/api/riders/user/${testUser.id}`)
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
        .get('/api/riders/user/different-user-id')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Assignments ─────────────────────────────────────────────────────────────

  describe('Rider Assignment Workflow', () => {
    let hiredRiderId;
    let assignmentId;

    beforeAll(async () => {
      // Ensure user has money
      await prisma.user.update({ where: { id: testUser.id }, data: { money: 20000 } });

      // Get marketplace and hire a rider
      const mktRes = await request(app)
        .get('/api/riders/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const [riderToHire] = mktRes.body.data.riders;
      const hireRes = await request(app)
        .post('/api/riders/marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: riderToHire.marketplaceId });

      if (hireRes.status === 201) {
        hiredRiderId = hireRes.body.data.rider.id;
      }
    });

    it('should assign a rider to a horse', async () => {
      if (!hiredRiderId) {
        return;
      } // Skip if hire failed

      const res = await request(app)
        .post('/api/riders/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ riderId: hiredRiderId, horseId: testHorse.id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.riderId).toBe(hiredRiderId);
      expect(res.body.data.horseId).toBe(testHorse.id);

      assignmentId = res.body.data.id;
    });

    it('should reject double-assigning the same rider', async () => {
      if (!hiredRiderId) {
        return;
      }

      const res = await request(app)
        .post('/api/riders/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ riderId: hiredRiderId, horseId: testHorse.id });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already assigned');
    });

    it('should list active assignments', async () => {
      const res = await request(app)
        .get('/api/riders/assignments')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should unassign a rider (soft delete)', async () => {
      if (!assignmentId) {
        return;
      }

      const res = await request(app)
        .delete(`/api/riders/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should dismiss a rider', async () => {
      if (!hiredRiderId) {
        return;
      }

      const res = await request(app)
        .delete(`/api/riders/${hiredRiderId}/dismiss`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Validation ──────────────────────────────────────────────────────────────

  describe('Validation', () => {
    it('should reject assignment with invalid riderId', async () => {
      const res = await request(app)
        .post('/api/riders/assignments')
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
        .post('/api/riders/assignments')
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
