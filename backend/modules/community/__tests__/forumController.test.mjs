/**
 * forumController.test.mjs — real DB
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted
 * from jest.unstable_mockModule of prismaClient + logger to a real-DB
 * integration test.
 *
 * Coverage: getThreads, createThread, createPost, incrementView, getThread.
 *
 * Removed (per doctrine):
 *   - "returns 500 on database error" / "returns 500 on transaction
 *     failure" tests that mocked Prisma to reject — synthetic Prisma
 *     fault injection forbidden.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import {
  getThreads,
  getThread,
  createThread,
  createPost,
  incrementView,
  pinThread,
} from '../controllers/forumController.mjs';

const SUITE_PREFIX = 'forum';

function makeReqRes(userId, overrides = {}) {
  let _status = 200;
  let _body = null;
  return {
    req: {
      user: userId === undefined ? undefined : { id: userId },
      body: {},
      params: {},
      query: {},
      ...overrides,
    },
    res: {
      status(c) {
        _status = c;
        return this;
      },
      json(b) {
        _body = b;
        return this;
      },
      get statusValue() {
        return _status;
      },
      get jsonValue() {
        return _body;
      },
    },
  };
}

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Forum',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createThreadInDb(authorId, overrides = {}) {
  return prisma.forumThread.create({
    data: {
      section: overrides.section ?? 'general',
      title: overrides.title ?? `${SUITE_PREFIX}-${randomBytes(4).toString('hex')}`,
      author: { connect: { id: authorId } },
      tags: overrides.tags ?? [],
      ...overrides.extra,
    },
  });
}

async function createPostInDb(threadId, authorId, content) {
  return prisma.forumPost.create({
    data: {
      thread: { connect: { id: threadId } },
      author: { connect: { id: authorId } },
      content,
    },
  });
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  // Forum posts cascade via thread; threads cascade via author? Check schema:
  // ForumThread.author has no onDelete clause, so manual deletion required.
  // ForumPost.thread has onDelete: Cascade.
  await prisma.forumThread.deleteMany({ where: { authorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('forumController (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  describe('getThreads', () => {
    it('returns shaped threads with replyCount and pagination data', async () => {
      const user = await createUser();
      const thread = await createThreadInDb(user.id, { section: 'general' });
      // Add 3 posts (all by same author for simplicity).
      await createPostInDb(thread.id, user.id, 'post 1');
      await createPostInDb(thread.id, user.id, 'post 2');
      await createPostInDb(thread.id, user.id, 'post 3');

      const h = makeReqRes(user.id, { query: { section: 'general' } });
      await getThreads(h.req, h.res);

      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.threads.length).toBeGreaterThan(0);
      const matched = body.data.threads.find(t => t.id === thread.id);
      expect(matched).toMatchObject({ replyCount: 3 });
      expect(typeof body.data.total).toBe('number');
      expect(body.data.page).toBe(1);
    });

    it('filters by valid section', async () => {
      const user = await createUser();
      const general = await createThreadInDb(user.id, { section: 'general' });
      const art = await createThreadInDb(user.id, { section: 'art' });

      const h = makeReqRes(user.id, { query: { section: 'art' } });
      await getThreads(h.req, h.res);

      const ids = h.res.jsonValue.data.threads.map(t => t.id);
      expect(ids).toContain(art.id);
      expect(ids).not.toContain(general.id);
    });

    it('returns 400 for invalid section values', async () => {
      const user = await createUser();

      const h = makeReqRes(user.id, { query: { section: 'INVALID_SECTION' } });
      await getThreads(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.success).toBe(false);
      expect(h.res.jsonValue.message).toMatch(/Invalid section/);
    });
  });

  describe('getThread', () => {
    it('returns thread and posts when found', async () => {
      const user = await createUser();
      const thread = await createThreadInDb(user.id, { title: 'Test' });
      await createPostInDb(thread.id, user.id, 'first post');

      const h = makeReqRes(user.id, { params: { id: String(thread.id) } });
      await getThread(h.req, h.res);

      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.posts.length).toBeGreaterThanOrEqual(1);
      expect(body.data.posts[0].content).toBe('first post');
    });

    it('returns 404 when thread not found', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '999999999' } });
      await getThread(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Thread not found' });
    });

    it('returns 400 for non-numeric thread ID', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: 'not-a-number' } });
      await getThread(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
    });
  });

  describe('createThread', () => {
    it('creates thread and first post atomically, returns 201', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, {
        body: { section: 'general', title: 'New topic', content: 'Body text' },
      });
      await createThread(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.thread).toMatchObject({ title: 'New topic', section: 'general' });
      expect(body.data.firstPost).toMatchObject({ content: 'Body text' });

      // Verify both rows exist.
      const persistedThread = await prisma.forumThread.findUnique({ where: { id: body.data.thread.id } });
      expect(persistedThread).not.toBeNull();
      const persistedPost = await prisma.forumPost.findUnique({ where: { id: body.data.firstPost.id } });
      expect(persistedPost).not.toBeNull();
    });

    it('uses authorId from req.user.id', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, {
        body: { section: 'art', title: 'Art share', content: 'My drawing' },
      });
      await createThread(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      const persistedThread = await prisma.forumThread.findUnique({ where: { id: h.res.jsonValue.data.thread.id } });
      expect(persistedThread.authorId).toBe(user.id);
    });
  });

  describe('createPost', () => {
    it('creates reply, updates lastActivityAt, returns 201', async () => {
      const user = await createUser();
      const thread = await createThreadInDb(user.id);
      // Anchor lastActivityAt to a known past time so the controller's update
      // is unambiguously later. Comparing the schema-default Postgres now() to
      // the controller's JS new Date() at ms resolution is racy across the
      // SQL/JS clock boundary.
      const pastAnchor = new Date(Date.now() - 60_000);
      await prisma.forumThread.update({
        where: { id: thread.id },
        data: { lastActivityAt: pastAnchor },
      });

      const h = makeReqRes(user.id, {
        params: { id: String(thread.id) },
        body: { content: 'Reply content' },
      });
      await createPost(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      expect(h.res.jsonValue.data.post.content).toBe('Reply content');

      // Verify thread.lastActivityAt advanced past the anchor.
      const after = await prisma.forumThread.findUnique({ where: { id: thread.id } });
      expect(after.lastActivityAt.getTime()).toBeGreaterThan(pastAnchor.getTime());
    });

    it('returns 404 when thread does not exist', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '999999999' }, body: { content: 'Reply' } });
      await createPost(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Thread not found' });
    });

    it('returns 400 for invalid thread ID', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: 'bad' }, body: { content: 'x' } });
      await createPost(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
    });
  });

  describe('incrementView', () => {
    it('increments viewCount and returns success', async () => {
      const user = await createUser();
      const thread = await createThreadInDb(user.id);
      const beforeCount = thread.viewCount;

      // Use a different user (the in-memory cooldown would bypass on
      // self-views from the same user within the cooldown window).
      const viewer = await createUser();
      const h = makeReqRes(viewer.id, { params: { id: String(thread.id) } });
      await incrementView(h.req, h.res);

      expect(h.res.jsonValue.success).toBe(true);
      const after = await prisma.forumThread.findUnique({ where: { id: thread.id }, select: { viewCount: true } });
      expect(after.viewCount).toBeGreaterThan(beforeCount);
    });

    it('returns 400 for invalid thread ID (id=0)', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '0' } });
      await incrementView(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
    });
  });

  describe('pinThread', () => {
    it('toggles isPinned from false to true and persists to DB', async () => {
      const user = await createUser();
      const thread = await createThreadInDb(user.id); // isPinned defaults to false

      const h = makeReqRes(user.id, { params: { id: String(thread.id) } });
      await pinThread(h.req, h.res);

      expect(h.res.jsonValue.success).toBe(true);
      expect(h.res.jsonValue.data.isPinned).toBe(true);
      const persisted = await prisma.forumThread.findUnique({ where: { id: thread.id } });
      expect(persisted.isPinned).toBe(true);
    });

    it('toggles isPinned from true to false', async () => {
      const user = await createUser();
      const thread = await createThreadInDb(user.id, { extra: { isPinned: true } });

      const h = makeReqRes(user.id, { params: { id: String(thread.id) } });
      await pinThread(h.req, h.res);

      expect(h.res.jsonValue.success).toBe(true);
      expect(h.res.jsonValue.data.isPinned).toBe(false);
      const persisted = await prisma.forumThread.findUnique({ where: { id: thread.id } });
      expect(persisted.isPinned).toBe(false);
    });

    it('returns 404 when thread does not exist', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '999999999' } });
      await pinThread(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Thread not found' });
    });
  });
});
