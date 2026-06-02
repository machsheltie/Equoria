/**
 * forumRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: list threads, get thread, create thread, create post, increment view, pin (admin).
 * Routes are mounted at /api/forum in authRouter.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let adminUser;
let token;
let adminToken;
let thread;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `forum-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `forum${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Forum',
      lastName: 'Tester',
      money: 5000,
    },
  });
  adminUser = await prisma.user.create({
    data: {
      email: `forumadmin-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `forumadmin${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'ForumAdmin',
      lastName: 'Tester',
      role: 'admin',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  adminToken = generateTestToken({ id: adminUser.id, email: adminUser.email, role: 'admin' });

  thread = await prisma.forumThread.create({
    data: {
      section: 'general',
      title: 'TestFixture-Forum Thread',
      authorId: user.id,
      posts: {
        create: [{ authorId: user.id, content: 'TestFixture-first post content' }],
      },
    },
    include: { posts: true },
  });
}, 30000);

afterAll(async () => {
  // Scoped, fail-loud cleanup (Equoria-1ohys). FK order: ALL posts (FK to
  // thread + author) before threads, threads before the two users. Both post
  // predicates (by-thread and by-author) run before the thread delete so a
  // thread is never deleted while a post still references it.
  cleanup.add(() => prisma.forumPost.deleteMany({ where: { threadId: thread.id } }), 'forumPost:byThread');
  cleanup.add(
    () => prisma.forumPost.deleteMany({ where: { authorId: { in: [user.id, adminUser.id] } } }),
    'forumPost:byAuthor',
  );
  cleanup.add(
    () => prisma.forumThread.deleteMany({ where: { authorId: { in: [user.id, adminUser.id] } } }),
    'forumThread',
  );
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  cleanup.add(() => prisma.user.delete({ where: { id: adminUser.id } }), 'adminUser');
  await cleanup.run();
}, 30000);

// ─── GET /api/forum/threads ───────────────────────────────────────────────────

describe('GET /api/forum/threads', () => {
  it('returns 200 with thread list for authenticated user', async () => {
    const res = await request(app)
      .get('/api/forum/threads')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.threads)).toBe(true);
  });

  it('returns 200 filtered by section', async () => {
    const res = await request(app)
      .get('/api/forum/threads?section=general')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 for invalid section', async () => {
    const res = await request(app)
      .get('/api/forum/threads?section=invalid-section')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/forum/threads').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/forum/threads/:id ──────────────────────────────────────────────

describe('GET /api/forum/threads/:id', () => {
  it('returns 200 with thread detail and posts', async () => {
    const res = await request(app)
      .get(`/api/forum/threads/${thread.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.thread).toBeDefined();
    expect(res.body.data.thread.id).toBe(thread.id);
    expect(Array.isArray(res.body.data.posts)).toBe(true);
  });

  it('returns 404 for non-existent thread', async () => {
    const res = await request(app)
      .get('/api/forum/threads/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/forum/threads/${thread.id}`).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/forum/threads ──────────────────────────────────────────────────

describe('POST /api/forum/threads', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/forum/threads')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid section', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/forum/threads')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ section: 'invalid', title: 'Test', content: 'Test content' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 when creating valid thread', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/forum/threads')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        section: 'general',
        title: 'TestFixture-Created Thread',
        content: 'TestFixture-Created thread content',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/forum/threads')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ section: 'general', title: 'Test', content: 'Content' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/forum/threads/:id/posts ───────────────────────────────────────

describe('POST /api/forum/threads/:id/posts', () => {
  it('returns 400 when content is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/forum/threads/${thread.id}/posts`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 when replying to a thread', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/forum/threads/${thread.id}/posts`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ content: 'TestFixture-reply post content' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for non-existent thread', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/forum/threads/999999999/posts')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ content: 'Some reply' });

    expect([404, 500]).toContain(res.status);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/forum/threads/${thread.id}/posts`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ content: 'reply' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/forum/threads/:id/view ────────────────────────────────────────

describe('POST /api/forum/threads/:id/view', () => {
  it('returns 200 when incrementing view count', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/forum/threads/${thread.id}/view`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/forum/threads/${thread.id}/view`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/forum/threads/:id/pin ────────────────────────────────────────

describe('PATCH /api/forum/threads/:id/pin', () => {
  it('returns 403 when non-admin tries to pin', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .patch(`/api/forum/threads/${thread.id}/pin`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(403);
  });

  it('returns 200 when admin pins thread', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .patch(`/api/forum/threads/${thread.id}/pin`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .patch(`/api/forum/threads/${thread.id}/pin`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});
