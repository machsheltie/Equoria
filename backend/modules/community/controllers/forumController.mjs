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

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  InvalidCursorError,
  findKeysetPage,
  readKeysetParams,
} from '../../../utils/paginationHelper.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
// Equoria-pwwuz (ADR-011): publish a low-latency 'forumReply' SSE nudge to the
// thread author when someone replies to their thread. Mirrors the DM 'message'
// producer (Equoria-lewrv). Fire-and-forget — the DB write is the source of
// truth and must never be coupled to bus delivery.
import { publishUserEvent } from '../../../services/eventBus.mjs';
// Equoria-puj1e.3 (owner ruling q375): a steward's posting cooldown stops new threads
// and replies until it ends.
// Owner rulings q380/q381: a blocked word refuses the post; a review word holds it.
import {
  blockedWordRefusal,
  forumWordVerdict,
  postingCooldownRefusal,
  postingCooldownUntil,
} from '../../staff/index.mjs';

/** In-memory dedup map: key = `${userId}:${threadId}`, value = timestamp of last view increment */
const _viewLog = new Map();
const viewCooldownMs = 60 * 60 * 1000; // 1 hour

const validSections = ['general', 'art', 'sales', 'services', 'venting'];
const threadsPerPage = 20;

/**
 * Owner ruling q376 (Equoria-puj1e.3): a held post or thread is shown only to its
 * author, marked as awaiting a moderator; nobody else sees it until a moderator
 * accepts it. These are the read filters every forum read applies. A missing viewer
 * must never reach `authorId: undefined`, which Prisma reads as no filter at all.
 */
const visibleTo = viewerId =>
  typeof viewerId === 'string' && viewerId !== ''
    ? { OR: [{ status: 'published' }, { authorId: viewerId }] }
    : { status: 'published' };

/** A refusal decided inside a posting transaction: nothing is written, the body is sent. */
class PostingRefusal extends Error {
  constructor(status, body) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
}

const threadNotFound = () =>
  new PostingRefusal(404, { success: false, message: 'Thread not found' });
const busyMessage = { message: 'Forum service is busy right now, please retry in a moment.' };

/**
 * The first step of every posting transaction (Equoria-puj1e.3, q375): lock the
 * author's account row, then read their posting cooldown. A steward's cooldown is
 * written under FOR UPDATE on the same row (staffConductController runAction), so a
 * post and a cooldown serialise: the post either commits before the cooldown exists
 * or, waiting on the lock, reads it here and is refused. The same lock orders a reply
 * after a steward's accept or reject of its author's held opening post.
 */
async function lockAuthorOffCooldown(tx, authorId) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${authorId} FOR SHARE`;
  const until = await postingCooldownUntil(tx, authorId);
  if (until) {
    const refusal = postingCooldownRefusal(until);
    throw new PostingRefusal(refusal.status, refusal.body);
  }
}

/**
 * Ask the word lists about a new thread or reply (Equoria-puj1e.3, q380). Throws the
 * refusal for a blocked word (the player is never told which); otherwise returns the
 * status to save: 'held' for a review word, else 'published'.
 */
async function statusForWords(tx, texts) {
  const verdict = await forumWordVerdict(tx, texts);
  if (verdict === 'blocked') {
    throw new PostingRefusal(blockedWordRefusal.status, blockedWordRefusal.body);
  }
  return verdict === 'review' ? 'held' : 'published';
}

/** Answer a posting failure: a refusal, the retryable 503, or a logged 500. */
function answerPostingError(res, error, where, fallback) {
  if (error instanceof PostingRefusal) {
    return res.status(error.status).json(error.body);
  }
  // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
  if (error?.status === 503) {
    return res.status(503).json({ success: false, message: error.message });
  }
  logger.error(`[forumController.${where}] ${error.message}`);
  return res.status(500).json({ success: false, message: fallback });
}

// Pinned threads first, then the most recently active, ties broken by id
// (Equoria-cmw85.21). A thread that is bumped or pinned while a player pages moves to the
// FRONT of this order, ahead of any cursor already issued, so it is never shown twice.
const threadSort = [
  { key: 'isPinned', dir: 'desc', type: 'bool' },
  { key: 'lastActivityAt', dir: 'desc', type: 'date' },
  { key: 'id', dir: 'desc', type: 'int' },
];

/**
 * GET /api/forum/threads?section=&page= (or ?cursor=&limit=)
 * Returns threads for a section, pinned first, then by lastActivityAt desc.
 * A numbered-page request (?page, no cursor) also gets the section's `total`;
 * a cursor request does not pay for the count.
 */
export async function getThreads(req, res) {
  const { section } = req.query;
  const { limit, cursor, skip } = readKeysetParams(req.query, {
    def: threadsPerPage,
    max: 100,
  });
  const pageNum = Math.max(1, parseInt(req.query.page ?? '1', 10) || 1);

  if (section && !validSections.includes(section)) {
    return res.status(400).json({
      success: false,
      message: `Invalid section. Valid sections: ${validSections.join(', ')}`,
    });
  }
  const where = { ...(section ? { section } : {}), ...visibleTo(req.user?.id) };

  try {
    const [{ items: threads, pageInfo }, total] = await Promise.all([
      findKeysetPage(args => prisma.forumThread.findMany(args), {
        where,
        sort: threadSort,
        limit,
        cursor,
        skip,
        extra: {
          include: {
            author: { select: { id: true, username: true } },
            _count: { select: { posts: { where: { status: 'published' } } } },
          },
        },
      }),
      cursor ? Promise.resolve(undefined) : prisma.forumThread.count({ where }),
    ]);

    const shaped = threads.map(t => ({
      id: t.id,
      section: t.section,
      title: t.title,
      author: t.author,
      tags: t.tags,
      isPinned: t.isPinned,
      status: t.status,
      viewCount: t.viewCount,
      replyCount: t._count.posts,
      lastActivityAt: t.lastActivityAt,
      createdAt: t.createdAt,
    }));

    return res.json({
      success: true,
      data: { threads: shaped, total, page: pageNum, pageInfo },
    });
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return res.status(400).json({ success: false, message: error.message });
    }
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
  if (!id || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid thread ID' });
  }

  try {
    const viewerId = req.user?.id;
    const thread = await prisma.forumThread.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true } },
        posts: {
          where: visibleTo(viewerId),
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, username: true } } },
        },
      },
    });

    // A held thread answers exactly like a missing one to everyone but its author.
    if (!thread || (thread.status === 'held' && thread.authorId !== viewerId)) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }

    const { posts, ...threadData } = thread;
    // q382: the viewer's own open reports, so a post they reported says so.
    const reported =
      typeof viewerId === 'string' && viewerId !== '' && posts.length > 0
        ? await prisma.forumReport.findMany({
            where: { reporterId: viewerId, status: 'open', postId: { in: posts.map(p => p.id) } },
            select: { postId: true },
          })
        : [];
    const reportedIds = new Set(reported.map(r => r.postId));
    const shaped = posts.map(p => ({ ...p, reportedByMe: reportedIds.has(p.id) }));
    return res.json({ success: true, data: { thread: threadData, posts: shaped } });
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
    // Equoria-7x9po: transient P2028 tx-timeout -> retryable 503 (catch honours error.status).
    const [thread, firstPost] = await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        await lockAuthorOffCooldown(tx, authorId);
        const status = await statusForWords(tx, [
          title,
          content,
          ...(Array.isArray(tags) ? tags : []),
        ]);
        const t = await tx.forumThread.create({
          data: { section, title, authorId, tags, status },
          include: { author: { select: { id: true, username: true } } },
        });
        const p = await tx.forumPost.create({
          data: { threadId: t.id, authorId, content, status },
          include: { author: { select: { id: true, username: true } } },
        });
        return [t, p];
      }),
      busyMessage,
    );

    logger.info(`[forumController.createThread] User ${authorId} created thread ${thread.id}`);
    return res.status(201).json({ success: true, data: { thread, firstPost } });
  } catch (error) {
    return answerPostingError(res, error, 'createThread', 'Failed to create thread');
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

  if (!threadId || threadId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid thread ID' });
  }

  try {
    const { thread, post, status } = await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        await lockAuthorOffCooldown(tx, authorId);
        // Read under the author's lock: a steward deciding this author's held opening
        // post holds the same row, so the thread's status here is the settled one.
        const found = await tx.forumThread.findUnique({ where: { id: threadId } });
        // A held thread is missing to everyone but its author (q376).
        if (!found || (found.status === 'held' && found.authorId !== authorId)) {
          throw threadNotFound();
        }
        const byWords = await statusForWords(tx, [content]);
        // A reply in a thread still awaiting a moderator waits too: accepting the
        // opening post must never publish a reply nobody has reviewed (q376).
        const saved = found.status === 'held' ? 'held' : byWords;
        const created = await tx.forumPost.create({
          data: { threadId, authorId, content, status: saved },
          include: { author: { select: { id: true, username: true } } },
        });
        // A held reply is not activity yet: accepting it bumps the thread (q376).
        if (saved === 'published') {
          await tx.forumThread.update({
            where: { id: threadId },
            data: { lastActivityAt: new Date() },
          });
        }
        return { thread: found, post: created, status: saved };
      }),
      busyMessage,
    );

    // Equoria-pwwuz (ADR-011): real-time receipt to the thread author AFTER the
    // DB write succeeded — mirrors the DM 'message' producer (Equoria-lewrv).
    // Only fire when the replier is NOT the thread author (no self-notify).
    // publishUserEvent never throws, but guard anyway so a future change cannot
    // couple the reply write to bus delivery.
    // Nobody else hears of a held reply until a moderator accepts it.
    if (status === 'published' && thread.authorId && thread.authorId !== authorId) {
      try {
        publishUserEvent(thread.authorId, 'forumReply', {
          threadId,
          postId: post.id,
          threadTitle: thread.title ?? null,
          replierId: authorId,
        });
      } catch (busError) {
        logger.error(`[forumController.createPost] event bus publish failed: ${busError.message}`);
      }
    }

    return res.status(201).json({ success: true, data: { post } });
  } catch (error) {
    return answerPostingError(res, error, 'createPost', 'Failed to create post');
  }
}

/**
 * POST /api/forum/threads/:id/view
 * Increments viewCount by 1, deduplicated per user per thread per hour. A thread the
 * viewer may not see (missing, or held and not theirs, q376) answers 404 and is not
 * counted, so the endpoint never tells whether a held thread exists.
 */
export async function incrementView(req, res) {
  const id = parseInt(req.params.id, 10);
  const userId = req.user.id;
  if (!id || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid thread ID' });
  }

  // Only a counted view is remembered, so a hit here means this viewer saw the thread.
  const key = `${userId}:${id}`;
  const now = Date.now();
  const last = _viewLog.get(key);
  if (last && now - last < viewCooldownMs) {
    return res.json({ success: true });
  }

  try {
    const { count } = await prisma.forumThread.updateMany({
      where: { id, ...visibleTo(userId) },
      data: { viewCount: { increment: 1 } },
    });
    if (count === 0) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    _viewLog.set(key, now);
    // Prune entries older than the cooldown window to prevent unbounded growth
    for (const [k, ts] of _viewLog) {
      if (now - ts >= viewCooldownMs) {
        _viewLog.delete(k);
      }
    }
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
  if (!id || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid thread ID' });
  }

  try {
    const thread = await prisma.forumThread.findUnique({ where: { id } });
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }

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
