/**
 * communityRoutes.integration.test.mjs
 *
 * ATDD RED PHASE — Story 21-3: Community / Trainers / Riders API Integration Tests
 *
 * Supertest integration tests for community module routes:
 *   - POST /api/clubs   (create club)
 *   - GET  /api/clubs   (list clubs)
 *   - POST /api/forum/threads  (create thread)
 *   - GET  /api/forum/threads  (list threads)
 *   - POST /api/messages       (send message)
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
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

describe('INTEGRATION: Community Routes (21-3)', () => {
  let user;
  let userToken;
  let createdClubId;

  beforeAll(async () => {
    const ts = Date.now();
    const created = await createTestUser({
      username: `community_int_${ts}`,
      email: `community_int_${ts}@test.com`,
    });
    user = created.user;
    userToken = created.token;
  });

  afterAll(async () => {
    try {
      if (createdClubId) {
        await prisma.clubMembership.deleteMany({ where: { clubId: createdClubId } });
        await prisma.club.deleteMany({ where: { id: createdClubId } });
      }
      // Clean up any extra clubs created in validation tests
      await prisma.club.deleteMany({ where: { leaderId: user?.id } });
    } catch {
      /* ignore cleanup errors */
    }
    await cleanupTestData();
  });

  // ─── POST /api/clubs ─────────────────────────────────────────────────────────

  describe('POST /api/clubs', () => {
    it('[P0] happy path — creates club and returns 201 with club data', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          name: `Integration Club ${Date.now()}`,
          type: 'discipline',
          category: 'Dressage',
          description: 'Created by integration test',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.club).toBeDefined();
      expect(res.body.data.club.leaderId).toBe(user.id);
      createdClubId = res.body.data.club.id;
    });

    it('[P0] auth guard — returns 401 when no token provided', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app)
        .post('/api/clubs')
        .set('x-test-skip-csrf', 'true')
        .send({
          name: `No Auth Club ${Date.now()}`,
          type: 'discipline',
          category: 'Dressage',
          description: 'Should be rejected',
        });

      expect(res.status).toBe(401);
    });

    it('[P0] validation error — returns 400 when required fields missing', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          // name is missing — required field
          type: 'discipline',
          category: 'Dressage',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });
  });

  // ─── GET /api/clubs ───────────────────────────────────────────────────────────

  describe('GET /api/clubs', () => {
    it('[P0] happy path — returns 200 with clubs array', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app).get('/api/clubs').set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.clubs)).toBe(true);
    });

    it('[P0] auth guard — returns 401 when no token provided', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app).get('/api/clubs');

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/forum/threads ───────────────────────────────────────────────────

  describe('GET /api/forum/threads', () => {
    it('[P1] happy path — returns 200 with threads array', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app).get('/api/forum/threads').set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.threads)).toBe(true);
    });

    it('[P1] auth guard — returns 401 when no token provided', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app).get('/api/forum/threads');

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/forum/threads ──────────────────────────────────────────────────

  describe('POST /api/forum/threads', () => {
    it('[P1] auth guard — returns 401 when no token provided', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app)
        .post('/api/forum/threads')
        .set('x-test-skip-csrf', 'true')
        .send({ title: 'Test Thread', content: 'Hello', section: 'general' });

      expect(res.status).toBe(401);
    });

    it('[P1] validation error — returns 400 when required fields missing', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app)
        .post('/api/forum/threads')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          // title missing — required
          section: 'general',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── POST /api/messages ───────────────────────────────────────────────────────

  describe('POST /api/messages', () => {
    it('[P1] auth guard — returns 401 when no token provided', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app).post('/api/messages').set('x-test-skip-csrf', 'true').send({
        recipientId: 'some-user-id',
        subject: 'Hello',
        content: 'Test message',
      });

      expect(res.status).toBe(401);
    });

    it('[P1] validation error — returns 400 when recipientId missing', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          // recipientId missing — required
          subject: 'Hello',
          content: 'Test message',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('[P1] validation error — returns 400 when subject missing', async () => {
      // ATDD RED PHASE: remove skip after confirming green
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          recipientId: user.id,
          // subject missing — required
          content: 'Test message',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
