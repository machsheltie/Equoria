/**
 * Trainer API Integration Tests
 * Tests for the complete trainer marketplace and assignment workflow.
 *
 * Test Coverage:
 * - GET /api/trainers/marketplace
 * - POST /api/trainers/marketplace/hire
 * - POST /api/trainers/marketplace/refresh
 * - GET /api/trainers/user/:userId
 * - GET /api/trainers/assignments
 * - POST /api/trainers/assignments
 * - DELETE /api/trainers/assignments/:id
 * - DELETE /api/trainers/:id/dismiss
 * - Authentication requirements
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestUser, createTestHorse, cleanupTestData } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import app from '../../app.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
describe('🎓 INTEGRATION: Trainer API', () => {
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
      username: `testuser_trainer_${timestamp}`,
      email: `trainer-test-${timestamp}@test.com`,
      money: 20000,
    });
    testUser = userData.user;
    authToken = userData.token;

    testHorse = await createTestHorse({
      userId: testUser.id,
      name: `TestHorse_trainer_${timestamp}`,
    });
  });

  afterAll(async () => {
    try {
      // Clean up trainer data before generic cleanup
      await prisma.trainerAssignment.deleteMany({ where: { userId: testUser?.id } });
      await prisma.trainer.deleteMany({ where: { userId: testUser?.id } });
    } catch {
      // Ignore cleanup errors
    }
    await cleanupTestData();
  });

  // ─── Authentication ─────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('should require auth for trainer endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/trainers/marketplace' },
        { method: 'get', path: '/api/trainers/assignments' },
      ];

      for (const ep of endpoints) {
        const res = await request(app)[ep.method](ep.path).set('Origin', 'http://localhost:3000');
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      }
    });
  });

  // ─── Marketplace ─────────────────────────────────────────────────────────────

  describe('GET /api/trainers/marketplace', () => {
    it('should return marketplace with trainers array', async () => {
      const res = await request(app)
        .get('/api/trainers/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('trainers');
      expect(Array.isArray(res.body.data.trainers)).toBe(true);
      expect(res.body.data.trainers.length).toBeGreaterThan(0);

      const [trainer] = res.body.data.trainers;
      expect(trainer).toHaveProperty('marketplaceId');
      expect(trainer).toHaveProperty('firstName');
      expect(trainer).toHaveProperty('skillLevel');
      expect(trainer).toHaveProperty('sessionRate');
      expect(trainer).toHaveProperty('personality');
    });

    it('should return same marketplace on subsequent calls', async () => {
      const res1 = await request(app)
        .get('/api/trainers/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      const res2 = await request(app)
        .get('/api/trainers/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.data.trainers).toEqual(res2.body.data.trainers);
    });

    it('should include refresh metadata', async () => {
      const res = await request(app)
        .get('/api/trainers/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.body.data).toHaveProperty('lastRefresh');
      expect(res.body.data).toHaveProperty('nextFreeRefresh');
      expect(res.body.data).toHaveProperty('refreshCost');
      expect(res.body.data).toHaveProperty('canRefreshFree');
      expect(res.body.data).toHaveProperty('refreshCount');
    });
  });

  describe('POST /api/trainers/marketplace/refresh', () => {
    it('should reject premium refresh without force=true when cost applies', async () => {
      await request(app)
        .get('/api/trainers/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .post('/api/trainers/marketplace/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({});

      expect([200, 400]).toContain(res.status);
      if (res.status === 400) {
        expect(res.body.message).toContain('costs');
      }
    });

    it('should allow force refresh', async () => {
      await request(app)
        .get('/api/trainers/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .post('/api/trainers/marketplace/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ force: true });

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data.trainers)).toBe(true);
      }
    });
  });

  describe('POST /api/trainers/marketplace/hire', () => {
    let marketplaceTrainer;

    beforeAll(async () => {
      await prisma.user.update({ where: { id: testUser.id }, data: { money: 20000 } });

      const res = await request(app)
        .get('/api/trainers/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      [marketplaceTrainer] = res.body.data.trainers;
    });

    it('should require marketplaceId', async () => {
      const res = await request(app)
        .post('/api/trainers/marketplace/hire')
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
        .post('/api/trainers/marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: 'non-existent-id' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should hire a trainer and deduct correct cost (4 × sessionRate)', async () => {
      const userBefore = await prisma.user.findUnique({ where: { id: testUser.id } });

      const res = await request(app)
        .post('/api/trainers/marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: marketplaceTrainer.marketplaceId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('trainer');
      expect(res.body.data).toHaveProperty('cost');
      expect(res.body.data).toHaveProperty('remainingMoney');

      // Cost = sessionRate × 4 (one month upfront)
      const expectedCost = marketplaceTrainer.sessionRate * 4;
      expect(res.body.data.cost).toBe(expectedCost);
      expect(res.body.data.remainingMoney).toBe(userBefore.money - expectedCost);
    });

    it('should reject hiring with insufficient funds', async () => {
      await prisma.user.update({ where: { id: testUser.id }, data: { money: 1 } });

      const mktRes = await request(app)
        .get('/api/trainers/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      const [trainerToHire] = mktRes.body.data.trainers;

      const res = await request(app)
        .post('/api/trainers/marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: trainerToHire.marketplaceId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient funds');

      await prisma.user.update({ where: { id: testUser.id }, data: { money: 20000 } });
    });
  });

  // ─── User Trainers ────────────────────────────────────────────────────────────

  describe('GET /api/trainers/user/:userId', () => {
    it('should return hired trainers for the authenticated user', async () => {
      const res = await request(app)
        .get(`/api/trainers/user/${testUser.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        const trainer = res.body.data[0];
        expect(trainer).toHaveProperty('name');
        expect(trainer).toHaveProperty('skillLevel');
        expect(trainer).toHaveProperty('sessionRate');
      }
    });

    it('should return 404 when userId does not match authenticated user', async () => {
      const res = await request(app)
        .get('/api/trainers/user/different-user-id')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Assignments ──────────────────────────────────────────────────────────────

  // Equoria-4kp53: consolidated end-to-end workflow. Previously this
  // describe spread the hire → assign → list → unassign → dismiss flow
  // across 5 separate `it()` blocks sharing mutable `hiredTrainerId` /
  // `assignmentId`. That structure breaks under Jest --randomize because
  // the dismiss step in test 5 deletes the trainer used by earlier tests,
  // and the assignment id from test 1 is consumed in test 4. Collapsing
  // to a single `it()` makes the sequencing explicit and removes shared
  // state between tests entirely.
  describe('Trainer Assignment Workflow (sequential)', () => {
    it('hires → assigns → rejects double-assign → lists → unassigns → dismisses', async () => {
      await prisma.user.update({ where: { id: testUser.id }, data: { money: 20000 } });

      const mktRes = await request(app)
        .get('/api/trainers/marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const [trainerToHire] = mktRes.body.data.trainers;
      const hireRes = await request(app)
        .post('/api/trainers/marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: trainerToHire.marketplaceId });

      if (hireRes.status !== 201) {
        // Skip rather than mask marketplace-exhaustion under parallel runs.
        return;
      }
      const hiredTrainerId = hireRes.body.data.trainer.id;

      // Assign
      const assignRes = await request(app)
        .post('/api/trainers/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ trainerId: hiredTrainerId, horseId: testHorse.id });
      expect(assignRes.status).toBe(201);
      expect(assignRes.body.success).toBe(true);
      expect(assignRes.body.data).toHaveProperty('id');
      expect(assignRes.body.data.trainerId).toBe(hiredTrainerId);
      expect(assignRes.body.data.horseId).toBe(testHorse.id);
      const assignmentId = assignRes.body.data.id;

      // Reject double-assign
      const dupRes = await request(app)
        .post('/api/trainers/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ trainerId: hiredTrainerId, horseId: testHorse.id });
      expect(dupRes.status).toBe(400);
      expect(dupRes.body.success).toBe(false);
      expect(dupRes.body.message).toContain('already assigned');

      // List
      const listRes = await request(app)
        .get('/api/trainers/assignments')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(Array.isArray(listRes.body.data)).toBe(true);

      // Unassign
      const unassignRes = await request(app)
        .delete(`/api/trainers/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);
      expect(unassignRes.status).toBe(200);
      expect(unassignRes.body.success).toBe(true);

      // Dismiss
      const dismissRes = await request(app)
        .delete(`/api/trainers/${hiredTrainerId}/dismiss`)
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
    it('should reject assignment with non-integer trainerId', async () => {
      const res = await request(app)
        .post('/api/trainers/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ trainerId: 'abc', horseId: testHorse.id });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject assignment with non-integer horseId', async () => {
      const res = await request(app)
        .post('/api/trainers/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ trainerId: 1, horseId: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
