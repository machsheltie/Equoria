/**
 * forumController.test.mjs
 *
 * Unit tests for backend/modules/community/controllers/forumController.mjs
 * Co-located per the backend/modules/<domain>/__tests__/ convention (Story 21-1).
 *
 * Coverage: getThreads, createThread, createPost, incrementView, getThread
 * Mocks: prisma, logger (external deps only)
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';

// ── Mock setup ────────────────────────────────────────────────────────────────

const mockPrisma = {
  forumThread: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  forumPost: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('../../packages/database/prismaClient.mjs', () => ({
  default: mockPrisma,
}));
jest.unstable_mockModule('../utils/logger.mjs', () => ({
  default: mockLogger,
}));

const { getThreads, getThread, createThread, createPost, incrementView } = await import(
  '../controllers/forumController.mjs'
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockReqRes(overrides = {}) {
  const req = {
    user: { id: 'user-uuid-1' },
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

// ── getThreads ────────────────────────────────────────────────────────────────

describe('getThreads', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns shaped threads with replyCount and pagination data', async () => {
    const rawThread = {
      id: 1,
      section: 'general',
      title: 'Hello world',
      author: { id: 'user-uuid-1', username: 'heirr' },
      tags: [],
      isPinned: false,
      viewCount: 10,
      lastActivityAt: new Date(),
      createdAt: new Date(),
      _count: { posts: 3 },
    };
    mockPrisma.forumThread.findMany.mockResolvedValue([rawThread]);
    mockPrisma.forumThread.count.mockResolvedValue(1);

    const { req, res } = mockReqRes({ query: { section: 'general' } });
    await getThreads(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          threads: expect.arrayContaining([expect.objectContaining({ replyCount: 3 })]),
          total: 1,
          page: 1,
        }),
      }),
    );
  });

  it('filters by valid section', async () => {
    mockPrisma.forumThread.findMany.mockResolvedValue([]);
    mockPrisma.forumThread.count.mockResolvedValue(0);

    const { req, res } = mockReqRes({ query: { section: 'art' } });
    await getThreads(req, res);

    expect(mockPrisma.forumThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ section: 'art' }) }),
    );
  });

  it('ignores invalid section values', async () => {
    mockPrisma.forumThread.findMany.mockResolvedValue([]);
    mockPrisma.forumThread.count.mockResolvedValue(0);

    const { req, res } = mockReqRes({ query: { section: 'INVALID_SECTION' } });
    await getThreads(req, res);

    // Should query with empty where (no section filter applied)
    expect(mockPrisma.forumThread.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('returns 500 on database error', async () => {
    mockPrisma.forumThread.findMany.mockRejectedValue(new Error('db error'));
    const { req, res } = mockReqRes({ query: {} });
    await getThreads(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ── getThread ─────────────────────────────────────────────────────────────────

describe('getThread', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns thread and posts when found', async () => {
    const thread = {
      id: 1,
      title: 'Test',
      author: { id: 'u1', username: 'heirr' },
      posts: [{ id: 1, content: 'first post', author: { id: 'u1', username: 'heirr' } }],
    };
    mockPrisma.forumThread.findUnique.mockResolvedValue(thread);

    const { req, res } = mockReqRes({ params: { id: '1' } });
    await getThread(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          posts: expect.arrayContaining([expect.objectContaining({ id: 1 })]),
        }),
      }),
    );
  });

  it('returns 404 when thread not found', async () => {
    mockPrisma.forumThread.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '999' } });
    await getThread(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Thread not found' }));
  });

  it('returns 400 for non-numeric thread ID', async () => {
    const { req, res } = mockReqRes({ params: { id: 'not-a-number' } });
    await getThread(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ── createThread ──────────────────────────────────────────────────────────────

describe('createThread', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates thread and first post atomically, returns 201', async () => {
    const thread = { id: 10, section: 'general', title: 'New topic', authorId: 'user-uuid-1', author: {} };
    const firstPost = { id: 100, threadId: 10, content: 'Body text', author: {} };

    mockPrisma.$transaction.mockImplementation(fn => fn(mockPrisma));
    mockPrisma.forumThread.create.mockResolvedValue(thread);
    mockPrisma.forumPost.create.mockResolvedValue(firstPost);

    const { req, res } = mockReqRes({
      body: { section: 'general', title: 'New topic', content: 'Body text' },
    });
    await createThread(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ thread, firstPost }),
      }),
    );
  });

  it('uses authorId from req.user.id', async () => {
    mockPrisma.$transaction.mockImplementation(fn => fn(mockPrisma));
    mockPrisma.forumThread.create.mockResolvedValue({ id: 1, authorId: 'user-uuid-1', author: {} });
    mockPrisma.forumPost.create.mockResolvedValue({ id: 1, author: {} });

    const { req, res } = mockReqRes({
      user: { id: 'user-uuid-1' },
      body: { section: 'art', title: 'Art share', content: 'My drawing' },
    });
    await createThread(req, res);

    expect(mockPrisma.forumThread.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: 'user-uuid-1' }),
      }),
    );
  });

  it('returns 500 on transaction failure', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('transaction failed'));
    const { req, res } = mockReqRes({ body: { section: 'general', title: 'T', content: 'C' } });
    await createThread(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ── createPost ────────────────────────────────────────────────────────────────

describe('createPost', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates reply and updates lastActivityAt, returns 201', async () => {
    const post = { id: 50, threadId: 1, content: 'Reply content', author: {} };
    mockPrisma.forumThread.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.$transaction.mockResolvedValue([post]);

    const { req, res } = mockReqRes({
      params: { id: '1' },
      body: { content: 'Reply content' },
    });
    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ post }),
      }),
    );
  });

  it('returns 404 when thread does not exist', async () => {
    mockPrisma.forumThread.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '999' }, body: { content: 'Reply' } });
    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Thread not found' }));
  });

  it('returns 400 for invalid thread ID', async () => {
    const { req, res } = mockReqRes({ params: { id: 'bad' }, body: { content: 'x' } });
    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ── incrementView ─────────────────────────────────────────────────────────────

describe('incrementView', () => {
  beforeEach(() => jest.clearAllMocks());

  it('increments viewCount and returns success', async () => {
    mockPrisma.forumThread.update.mockResolvedValue({ id: 1, viewCount: 11 });

    // Use unique user ID to avoid in-memory cooldown collision with other tests
    const { req, res } = mockReqRes({
      user: { id: 'view-test-user-unique' },
      params: { id: '1' },
    });
    await incrementView(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(mockPrisma.forumThread.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ viewCount: { increment: 1 } }),
      }),
    );
  });

  it('returns 400 for invalid thread ID', async () => {
    const { req, res } = mockReqRes({ params: { id: '0' } });
    await incrementView(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
