/**
 * Forum API Integration Tests (19B-1)
 * Tests for GET/POST forum threads and posts.
 *
 * SHARED-STATE NOTE (Equoria-4kp53):
 * createdThreadId is shared across describes. To make this suite
 * order-independent, the thread is created in a top-level beforeAll
 * (not inside `describe('POST /api/v1/forum/threads')`), so all later
 * describes that reference createdThreadId work even if Jest reorders
 * describe blocks. The 'should create a thread' test below asserts the
 * pre-created thread's properties rather than mutating shared state.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { createTestUser } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';
import app from '../../app.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
describe('💬 INTEGRATION: Forum API', () => {
  // Equoria-rnbzn: __csrf__ is fetched AFTER the user/token exist and bound to
  // that user (extraCookies: accessToken). The POST forum endpoints below
  // authenticate via the Bearer token, so csrfProtection resolves the
  // sessionIdentifier from req.user.id; a token issued without the user's
  // accessToken binds to the fallback salt and 403s the legitimate mutation.
  let __csrf__;

  let testUser;
  let authToken;
  let createdThreadId;

  beforeAll(async () => {
    // Equoria-rnbzn: randomize the fixture identifiers (was a fixed Date.now()
    // timestamp that collides with a crashed prior run's partial cleanup on the
    // User.username / User.email unique constraints). Keep within the valid
    // 3-30 [A-Za-z0-9_] username window.
    const suffix = randomBytes(6).toString('hex');
    const userData = await createTestUser({
      username: `testuser_forum_${suffix}`,
      email: `forum_test_${suffix}@example.com`,
    });
    testUser = userData.user;
    authToken = userData.token;

    // Bind the CSRF token to this user (per-user CSRF, Equoria-plw0h).
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });
  });

  // Equoria-4kp53: lift shared-thread creation to top-level beforeAll so
  // any describe order can reference createdThreadId. The 'POST /threads'
  // describe below independently creates its own thread to validate the
  // create-thread behavior, so the two no longer share mutable state.
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/forum/threads')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        section: 'general',
        title: 'Shared fixture thread (Equoria-4kp53)',
        content: 'Fixture thread for cross-describe reads',
        tags: ['guide'],
      });
    createdThreadId = res.body?.data?.thread?.id;
  });

  afterAll(async () => {
    // FK-ordered, scoped, fail-loud teardown (Equoria-rnbzn).
    //
    // Order: forumPost → forumThread → user.
    //   - ForumPost.author and ForumThread.author have no onDelete (default
    //     Restrict), so the user CANNOT be deleted while it authors posts or
    //     threads → delete those (scoped to this user's authorId) first.
    //   - ForumPost.thread cascades from ForumThread, but the post delete is
    //     scoped by authorId and runs first so the order is FK-safe either way.
    //   - This user is created via createTestUser (a direct prisma.user.create),
    //     so there is NO register-flow starter horse to clean here.
    //
    // Replaces the previous silent no-op catch arm (the `catch {}` that
    // swallowed a failed delete): createCleanupTracker runs every task even
    // if one throws, then throws ONE aggregated error so a leak into the
    // canonical DB (CLAUDE.md §2) fails the suite loudly instead of being
    // swallowed.
    const cleanup = createCleanupTracker();
    cleanup.add(() => {
      if (testUser?.id) {
        return prisma.forumPost.deleteMany({ where: { authorId: testUser.id } });
      }
    }, 'testUser forum posts');
    cleanup.add(() => {
      if (testUser?.id) {
        return prisma.forumThread.deleteMany({ where: { authorId: testUser.id } });
      }
    }, 'testUser forum threads');
    cleanup.add(() => {
      if (testUser?.id) {
        return prisma.user.deleteMany({ where: { id: testUser.id } });
      }
    }, 'testUser');
    await cleanup.run();
  });

  describe('Authentication', () => {
    it('should require auth for creating threads', async () => {
      const res = await request(app).post('/api/v1/forum/threads').set('Origin', 'http://localhost:3000').send({
        section: 'general',
        title: 'Test',
        content: 'Hello',
        tags: [],
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/forum/threads', () => {
    it('should create a thread', async () => {
      // Equoria-4kp53: this test creates and asserts its OWN thread.
      // The shared `createdThreadId` is provisioned in the top-level
      // beforeAll above so this test no longer mutates shared state.
      const res = await request(app)
        .post('/api/v1/forum/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          section: 'general',
          title: 'My test thread',
          content: 'First post!',
          tags: ['guide'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.thread.title).toBe('My test thread');
      expect(res.body.data.thread.section).toBe('general');
      expect(res.body.data.firstPost.content).toBe('First post!');
    });

    it('should reject missing title', async () => {
      const res = await request(app)
        .post('/api/v1/forum/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ section: 'general', content: 'oops' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid section', async () => {
      const res = await request(app)
        .post('/api/v1/forum/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ section: 'invalid', title: 'Test', content: 'test' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/forum/threads', () => {
    it('should list threads for a section', async () => {
      const res = await request(app)
        .get('/api/v1/forum/threads?section=general')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.threads)).toBe(true);
      expect(res.body.data.threads.length).toBeGreaterThan(0);
    });

    it('should return pinned threads first', async () => {
      const res = await request(app)
        .get('/api/v1/forum/threads?section=general')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      const threads = res.body.data.threads;
      const pinnedIndexes = threads.map((t, i) => (t.isPinned ? i : -1)).filter(i => i >= 0);
      const unpinnedIndexes = threads.map((t, i) => (!t.isPinned ? i : -1)).filter(i => i >= 0);
      if (pinnedIndexes.length > 0 && unpinnedIndexes.length > 0) {
        expect(Math.max(...pinnedIndexes)).toBeLessThan(Math.min(...unpinnedIndexes));
      }
    });

    it('should include replyCount on each thread', async () => {
      const res = await request(app)
        .get('/api/v1/forum/threads?section=general')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      const thread = res.body.data.threads.find(t => t.id === createdThreadId);
      expect(thread).toBeDefined();
      expect(typeof thread.replyCount).toBe('number');
    });
  });

  describe('GET /api/v1/forum/threads/:id', () => {
    it('should return thread with posts', async () => {
      const res = await request(app)
        .get(`/api/v1/forum/threads/${createdThreadId}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.thread.id).toBe(createdThreadId);
      expect(Array.isArray(res.body.data.posts)).toBe(true);
      expect(res.body.data.posts.length).toBe(1);
    });

    it('should return 404 for non-existent thread', async () => {
      const res = await request(app)
        .get('/api/v1/forum/threads/99999999')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/forum/threads/:id/posts', () => {
    it('should add a reply to a thread', async () => {
      const res = await request(app)
        .post(`/api/v1/forum/threads/${createdThreadId}/posts`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ content: 'Great thread!' });

      expect(res.status).toBe(201);
      expect(res.body.data.post.content).toBe('Great thread!');
    });

    it('should reject empty content', async () => {
      const res = await request(app)
        .post(`/api/v1/forum/threads/${createdThreadId}/posts`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ content: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/forum/threads/:id/view', () => {
    it('should increment viewCount', async () => {
      const before = await prisma.forumThread.findUnique({ where: { id: createdThreadId } });
      await request(app)
        .post(`/api/v1/forum/threads/${createdThreadId}/view`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);
      const after = await prisma.forumThread.findUnique({ where: { id: createdThreadId } });
      expect(after.viewCount).toBe(before.viewCount + 1);
    });
  });
});
