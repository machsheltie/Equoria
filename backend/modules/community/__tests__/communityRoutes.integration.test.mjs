/**
 * communityRoutes.integration.test.mjs
 *
 * ATDD RED PHASE — Story 21-3: Community / Trainers / Riders API Integration Tests
 *
 * Supertest integration tests for community module routes:
 *   - POST /api/v1/clubs   (create club)
 *   - GET  /api/v1/clubs   (list clubs)
 *   - POST /api/v1/forum/threads  (create thread)
 *   - GET  /api/v1/forum/threads  (list threads)
 *   - POST /api/v1/messages       (send message)
 *
 * Coverage pattern per endpoint: happy path + auth guard (401) + validation error (400)
 * Co-located per backend/modules/<domain>/__tests__/ convention (Story 21-1).
 * Real DB — no mocks. Cleanup in afterAll.
 *
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
describe('INTEGRATION: Community Routes (21-3)', () => {
  let __csrf__;
  let user;
  let userToken;
  let recipientUser;
  let createdClubId;
  let createdThreadId;
  let createdMessageId;

  beforeAll(async () => {
    const ts = Date.now();
    const created = await createTestUser({
      username: `community_int_${ts}`,
      email: `community_int_${ts}@test.com`,
    });
    user = created.user;
    userToken = created.token;

    // Create a second user to act as message recipient
    const ts2 = Date.now() + 1;
    const created2 = await createTestUser({
      username: `community_rcpt_${ts2}`,
      email: `community_rcpt_${ts2}@test.com`,
    });
    recipientUser = created2.user;

    // Equoria-iae9v: per-user CSRF binding (Equoria-plw0h). The CSRF token must
    // be minted under the same sessionIdentifier (user.id) that the
    // authenticated mutations resolve via authenticateToken — otherwise every
    // POST/PATCH carrying `Authorization: Bearer ${userToken}` 403s on an
    // HMAC mismatch. Fetched AFTER userToken exists and bound to it.
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${userToken}`] });
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  afterAll(async () => {
    try {
      // Clean up created thread (posts cascade-delete with thread)
      if (createdThreadId) {
        await prisma.forumPost.deleteMany({ where: { threadId: createdThreadId } });
        await prisma.forumThread.deleteMany({ where: { id: createdThreadId } });
      }
      // Clean up created message
      if (createdMessageId) {
        await prisma.directMessage.deleteMany({ where: { id: createdMessageId } });
      }
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
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  // ─── POST /api/v1/clubs ─────────────────────────────────────────────────────────

  describe('POST /api/v1/clubs', () => {
    it('[P0] happy path — creates club and returns 201 with club data', async () => {
      const res = await request(app)
        .post('/api/v1/clubs')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
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
      const res = await request(app)
        .post('/api/v1/clubs')
        .set('Origin', 'http://localhost:3000')
        // No auth + no CSRF: authenticateToken 401s before csrfProtection runs.
        .send({
          name: `No Auth Club ${Date.now()}`,
          type: 'discipline',
          category: 'Dressage',
          description: 'Should be rejected',
        });

      expect(res.status).toBe(401);
    });

    it('[P0] validation error — returns 400 when required fields missing', async () => {
      const res = await request(app)
        .post('/api/v1/clubs')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
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

  // ─── GET /api/v1/clubs ───────────────────────────────────────────────────────────

  describe('GET /api/v1/clubs', () => {
    it('[P0] happy path — returns 200 with clubs array', async () => {
      const res = await request(app)
        .get('/api/v1/clubs')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.clubs)).toBe(true);
    });

    it('[P0] auth guard — returns 401 when no token provided', async () => {
      const res = await request(app).get('/api/v1/clubs').set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/v1/forum/threads ───────────────────────────────────────────────────

  describe('GET /api/v1/forum/threads', () => {
    it('[P1] happy path — returns 200 with threads array', async () => {
      const res = await request(app)
        .get('/api/v1/forum/threads')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.threads)).toBe(true);
    });

    it('[P1] auth guard — returns 401 when no token provided', async () => {
      const res = await request(app).get('/api/v1/forum/threads').set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/v1/forum/threads ──────────────────────────────────────────────────

  describe('POST /api/v1/forum/threads', () => {
    it('[P0] happy path — creates thread and returns 201 with thread and firstPost (Equoria-wfmq)', async () => {
      const res = await request(app)
        .post('/api/v1/forum/threads')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          section: 'general',
          title: `TestFixture-Thread-${Date.now()}`,
          content: 'Integration test thread content',
          tags: ['test'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.thread).toBeDefined();
      expect(res.body.data.thread.authorId).toBe(user.id);
      expect(res.body.data.firstPost).toBeDefined();
      createdThreadId = res.body.data.thread.id;
    });

    it('[P1] auth guard — returns 401 when no token provided', async () => {
      const res = await request(app)
        .post('/api/v1/forum/threads')
        .set('Origin', 'http://localhost:3000')
        // No auth + no CSRF: authenticateToken 401s before csrfProtection runs.
        .send({ title: 'Test Thread', content: 'Hello', section: 'general' });

      expect(res.status).toBe(401);
    });

    it('[P1] validation error — returns 400 when required fields missing', async () => {
      const res = await request(app)
        .post('/api/v1/forum/threads')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          // title missing — required
          section: 'general',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── PATCH /api/v1/forum/threads/:id/pin ────────────────────────────────────────

  describe('PATCH /api/v1/forum/threads/:id/pin', () => {
    it('[P1] auth guard — returns 403 for non-admin user', async () => {
      const res = await request(app)
        .patch('/api/v1/forum/threads/999999/pin')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(res.status).toBe(403);
    });
  });

  // ─── POST /api/v1/messages ───────────────────────────────────────────────────────

  describe('POST /api/v1/messages', () => {
    it('[P0] happy path — sends message and returns 201 with message data (Equoria-q6t9)', async () => {
      const res = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          recipientId: recipientUser.id,
          subject: `TestFixture-Subject-${Date.now()}`,
          content: 'Integration test message content',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.message).toBeDefined();
      expect(res.body.data.message.senderId).toBe(user.id);
      expect(res.body.data.message.recipientId).toBe(recipientUser.id);
      createdMessageId = res.body.data.message.id;
    });

    it('[P1] auth guard — returns 401 when no token provided', async () => {
      const res = await request(app)
        .post('/api/v1/messages')
        .set('Origin', 'http://localhost:3000')
        // No auth + no CSRF: authenticateToken 401s before csrfProtection runs.
        .send({
          recipientId: 'some-user-id',
          subject: 'Hello',
          content: 'Test message',
        });

      expect(res.status).toBe(401);
    });

    it('[P1] validation error — returns 400 when recipientId missing', async () => {
      const res = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
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
      const res = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
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
