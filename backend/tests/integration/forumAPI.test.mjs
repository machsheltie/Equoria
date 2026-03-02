/**
 * Forum API Integration Tests (19B-1)
 * Tests for GET/POST forum threads and posts.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestUser, cleanupTestData } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import app from '../../app.mjs';

describe('💬 INTEGRATION: Forum API', () => {
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

  afterAll(async () => {
    try {
      await prisma.forumPost.deleteMany({ where: { authorId: testUser?.id } });
      await prisma.forumThread.deleteMany({ where: { authorId: testUser?.id } });
    } catch {
      /* ignore */
    }
    await cleanupTestData();
  });

  describe('Authentication', () => {
    it('should require auth for creating threads', async () => {
      const res = await request(app).post('/api/forum/threads').send({
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
      const res = await request(app)
        .post('/api/forum/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
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
      createdThreadId = res.body.data.thread.id;
    });

    it('should reject missing title', async () => {
      const res = await request(app)
        .post('/api/forum/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ section: 'general', content: 'oops' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid section', async () => {
      const res = await request(app)
        .post('/api/forum/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ section: 'invalid', title: 'Test', content: 'test' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/forum/threads', () => {
    it('should list threads for a section', async () => {
      const res = await request(app)
        .get('/api/forum/threads?section=general')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.threads)).toBe(true);
      expect(res.body.data.threads.length).toBeGreaterThan(0);
    });

    it('should return pinned threads first', async () => {
      const res = await request(app)
        .get('/api/forum/threads?section=general')
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
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.thread.id).toBe(createdThreadId);
      expect(Array.isArray(res.body.data.posts)).toBe(true);
      expect(res.body.data.posts.length).toBe(1);
    });

    it('should return 404 for non-existent thread', async () => {
      const res = await request(app).get('/api/forum/threads/99999999').set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/forum/threads/:id/posts', () => {
    it('should add a reply to a thread', async () => {
      const res = await request(app)
        .post(`/api/forum/threads/${createdThreadId}/posts`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ content: 'Great thread!' });

      expect(res.status).toBe(201);
      expect(res.body.data.post.content).toBe('Great thread!');
    });

    it('should reject empty content', async () => {
      const res = await request(app)
        .post(`/api/forum/threads/${createdThreadId}/posts`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
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
        .set('x-test-skip-csrf', 'true');
      const after = await prisma.forumThread.findUnique({ where: { id: createdThreadId } });
      expect(after.viewCount).toBe(before.viewCount + 1);
    });
  });
});
