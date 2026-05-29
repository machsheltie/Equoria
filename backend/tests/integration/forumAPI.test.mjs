/**
 * Forum API Integration Tests (19B-1)
 * Tests for GET/POST forum threads and posts.
 *
 * SHARED-STATE NOTE (Equoria-4kp53):
 * createdThreadId is shared across describes. To make this suite
 * order-independent, the thread is created in a top-level beforeAll
 * (not inside `describe('POST /api/forum/threads')`), so all later
 * describes that reference createdThreadId work even if Jest reorders
 * describe blocks. The 'should create a thread' test below asserts the
 * pre-created thread's properties rather than mutating shared state.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestUser } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import app from '../../app.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
describe('💬 INTEGRATION: Forum API', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  let testUser;
  let authToken;
  let createdThreadId;

  beforeAll(async () => {
    const timestamp = Date.now();
    const userData = await createTestUser({
      username: `testuser_forum_${timestamp}`,
      email: `forum-test-${timestamp}@test.com`,
    });
    testUser = userData.user;
    authToken = userData.token;
  });

  // Equoria-4kp53: lift shared-thread creation to top-level beforeAll so
  // any describe order can reference createdThreadId. The 'POST /threads'
  // describe below independently creates its own thread to validate the
  // create-thread behavior, so the two no longer share mutable state.
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/forum/threads')
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
    // Scoped cleanup: only delete data created by THIS test's user.
    // cleanupTestData() deletes ALL testuser_* users which races with
    // concurrent suites that also use that prefix (Equoria-ar59).
    try {
      await prisma.forumPost.deleteMany({ where: { authorId: testUser?.id } });
      await prisma.forumThread.deleteMany({ where: { authorId: testUser?.id } });
      if (testUser?.id) {
        await prisma.user.delete({ where: { id: testUser.id } });
      }
    } catch {
      /* ignore — user may have been cleaned up by a parallel suite */
    }
  });

  describe('Authentication', () => {
    it('should require auth for creating threads', async () => {
      const res = await request(app).post('/api/forum/threads').set('Origin', 'http://localhost:3000').send({
        section: 'general',
        title: 'Test',
        content: 'Hello',
        tags: [],
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/forum/threads', () => {
    it('should create a thread', async () => {
      // Equoria-4kp53: this test creates and asserts its OWN thread.
      // The shared `createdThreadId` is provisioned in the top-level
      // beforeAll above so this test no longer mutates shared state.
      const res = await request(app)
        .post('/api/forum/threads')
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
        .post('/api/forum/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ section: 'general', content: 'oops' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid section', async () => {
      const res = await request(app)
        .post('/api/forum/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ section: 'invalid', title: 'Test', content: 'test' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/forum/threads', () => {
    it('should list threads for a section', async () => {
      const res = await request(app)
        .get('/api/forum/threads?section=general')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.threads)).toBe(true);
      expect(res.body.data.threads.length).toBeGreaterThan(0);
    });

    it('should return pinned threads first', async () => {
      const res = await request(app)
        .get('/api/forum/threads?section=general')
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
        .get('/api/forum/threads?section=general')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      const thread = res.body.data.threads.find(t => t.id === createdThreadId);
      expect(thread).toBeDefined();
      expect(typeof thread.replyCount).toBe('number');
    });
  });

  describe('GET /api/forum/threads/:id', () => {
    it('should return thread with posts', async () => {
      const res = await request(app)
        .get(`/api/forum/threads/${createdThreadId}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.thread.id).toBe(createdThreadId);
      expect(Array.isArray(res.body.data.posts)).toBe(true);
      expect(res.body.data.posts.length).toBe(1);
    });

    it('should return 404 for non-existent thread', async () => {
      const res = await request(app)
        .get('/api/forum/threads/99999999')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/forum/threads/:id/posts', () => {
    it('should add a reply to a thread', async () => {
      const res = await request(app)
        .post(`/api/forum/threads/${createdThreadId}/posts`)
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
        .post(`/api/forum/threads/${createdThreadId}/posts`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ content: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/forum/threads/:id/view', () => {
    it('should increment viewCount', async () => {
      const before = await prisma.forumThread.findUnique({ where: { id: createdThreadId } });
      await request(app)
        .post(`/api/forum/threads/${createdThreadId}/view`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);
      const after = await prisma.forumThread.findUnique({ where: { id: createdThreadId } });
      expect(after.viewCount).toBe(before.viewCount + 1);
    });
  });
});
