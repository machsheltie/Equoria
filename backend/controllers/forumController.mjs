/**
 * Forum Controller (19B-1)
 * Handles CRUD for ForumThread and ForumPost.
 *
 * Routes:
 *   GET  /api/forum/threads           → list threads by section, pinned first
 *   GET  /api/forum/threads/:id       → thread detail with posts
 *   POST /api/forum/threads           → create thread (first post included)
 *   POST /api/forum/threads/:id/posts → reply to thread
 *   POST /api/forum/threads/:id/view  → increment viewCount
 *   PATCH /api/forum/threads/:id/pin  → toggle isPinned (admin)
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

const VALID_SECTIONS = ['general', 'art', 'sales', 'services', 'venting'];
const THREADS_PER_PAGE = 20;

/**
 * GET /api/forum/threads?section=&page=
 * Returns threads for a section, pinned first, then by lastActivityAt desc.
 */
export async function getThreads(req, res) {
  const { section, page = '1' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const skip = (pageNum - 1) * THREADS_PER_PAGE;

  const where = section && VALID_SECTIONS.includes(section) ? { section } : {};

  try {
    const [threads, total] = await Promise.all([
      prisma.forumThread.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { lastActivityAt: 'desc' }],
        skip,
        take: THREADS_PER_PAGE,
        include: {
          author: { select: { id: true, username: true } },
          _count: { select: { posts: true } },
        },
      }),
      prisma.forumThread.count({ where }),
    ]);

    const shaped = threads.map(t => ({
      id: t.id,
      section: t.section,
      title: t.title,
      author: t.author,
      tags: t.tags,
      isPinned: t.isPinned,
      viewCount: t.viewCount,
      replyCount: t._count.posts,
      lastActivityAt: t.lastActivityAt,
      createdAt: t.createdAt,
    }));

    return res.json({ success: true, data: { threads: shaped, total, page: pageNum } });
  } catch (error) {
    logger.error(`[forumController.getThreads] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch threads' });
  }
}

/**
 * GET /api/forum/threads/:id
 * Returns a single thread with all its posts.
 */
export async function getThread(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) return res.status(400).json({ success: false, message: 'Invalid thread ID' });

  try {
    const thread = await prisma.forumThread.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true } },
        posts: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, username: true } } },
        },
      },
    });

    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });

    const { posts, ...threadData } = thread;
    return res.json({ success: true, data: { thread: threadData, posts } });
  } catch (error) {
    logger.error(`[forumController.getThread] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch thread' });
  }
}

/**
 * POST /api/forum/threads
 * Creates a thread and its first post atomically.
 * Body: { section, title, content, tags? }
 */
export async function createThread(req, res) {
  const { section, title, content, tags = [] } = req.body;
  const authorId = req.user.id;

  try {
    const [thread, firstPost] = await prisma.$transaction(async tx => {
      const t = await tx.forumThread.create({
        data: { section, title, authorId, tags },
        include: { author: { select: { id: true, username: true } } },
      });
      const p = await tx.forumPost.create({
        data: { threadId: t.id, authorId, content },
        include: { author: { select: { id: true, username: true } } },
      });
      return [t, p];
    });

    logger.info(`[forumController.createThread] User ${authorId} created thread ${thread.id}`);
    return res.status(201).json({ success: true, data: { thread, firstPost } });
  } catch (error) {
    logger.error(`[forumController.createThread] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create thread' });
  }
}

/**
 * POST /api/forum/threads/:id/posts
 * Adds a reply to a thread and updates lastActivityAt.
 * Body: { content }
 */
export async function createPost(req, res) {
  const threadId = parseInt(req.params.id, 10);
  const { content } = req.body;
  const authorId = req.user.id;

  if (!threadId || threadId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid thread ID' });

  try {
    const thread = await prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });

    const [post] = await prisma.$transaction([
      prisma.forumPost.create({
        data: { threadId, authorId, content },
        include: { author: { select: { id: true, username: true } } },
      }),
      prisma.forumThread.update({
        where: { id: threadId },
        data: { lastActivityAt: new Date() },
      }),
    ]);

    return res.status(201).json({ success: true, data: { post } });
  } catch (error) {
    logger.error(`[forumController.createPost] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create post' });
  }
}

/**
 * POST /api/forum/threads/:id/view
 * Increments viewCount by 1.
 */
export async function incrementView(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) return res.status(400).json({ success: false, message: 'Invalid thread ID' });

  try {
    await prisma.forumThread.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
    return res.json({ success: true });
  } catch (error) {
    logger.error(`[forumController.incrementView] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update view count' });
  }
}

/**
 * PATCH /api/forum/threads/:id/pin
 * Toggles isPinned. Admin only (enforced in routes).
 */
export async function pinThread(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) return res.status(400).json({ success: false, message: 'Invalid thread ID' });

  try {
    const thread = await prisma.forumThread.findUnique({ where: { id } });
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });

    const updated = await prisma.forumThread.update({
      where: { id },
      data: { isPinned: !thread.isPinned },
    });
    return res.json({ success: true, data: { isPinned: updated.isPinned } });
  } catch (error) {
    logger.error(`[forumController.pinThread] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update pin status' });
  }
}
