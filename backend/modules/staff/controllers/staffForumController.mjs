/**
 * Staff forum moderation (Equoria-puj1e.3, owner rulings q375 and q376).
 *
 * - `post.moderate`: edit or remove any forum post. Removing a thread's opening
 *   post removes the thread, since a thread is its opening post.
 * - `post.review`: the queue of held posts, oldest first; accept or reject each.
 *   A held post is shown only to its author, marked as awaiting a moderator, and
 *   nobody else sees it until it is accepted (q376). Accepting publishes it (and
 *   its thread, when it is the opening post) and counts as the thread's latest
 *   activity. Rejecting removes it (the whole thread when it is the opening post)
 *   and leaves its author a short note.
 *
 * The post's author is judged by staffTargetRefusal under their row lock, then the
 * post row is locked, so two stewards deciding one post serialise and the second
 * is refused. Every action and its staff log entry commit together.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  Refusal,
  fail,
  intId,
  isText,
  lockAndJudgeOwner,
  runContentAction,
} from '../services/staffContentAction.mjs';

const maxContent = 10000;
const heldPage = 50;

const noSuchPost = () => new Refusal(404, 'No such post', 'forumPostNotFound');

/**
 * Lock the post's author, then the post. Returns the locked post with its thread
 * and whether it is the thread's opening post.
 */
async function lockPost(tx, actor, rawId) {
  const id = intId(rawId);
  const seen = id
    ? await tx.forumPost.findUnique({ where: { id }, select: { authorId: true } })
    : null;
  if (!seen) {
    throw noSuchPost();
  }
  await lockAndJudgeOwner(tx, actor, seen.authorId);
  const rows = await tx.$queryRaw`
    SELECT id, "threadId", "authorId", content, status
    FROM "ForumPost" WHERE id = ${id} FOR UPDATE`;
  const post = rows[0];
  if (!post || post.authorId !== seen.authorId) {
    throw noSuchPost();
  }
  const thread = await tx.forumThread.findUnique({
    where: { id: post.threadId },
    select: { id: true, title: true, status: true },
  });
  const opening = await tx.forumPost.findFirst({
    where: { threadId: post.threadId },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  return { post, thread, isOpening: opening?.id === post.id };
}

/** Remove a post, or its whole thread when it is the opening post. */
async function removePostOrThread(tx, { post, thread, isOpening }) {
  if (isOpening) {
    await tx.forumThread.delete({ where: { id: thread.id } });
  } else {
    await tx.forumPost.delete({ where: { id: post.id } });
  }
}

/** POST /api/v1/staff/forum/posts/:postId/edit { content, reason } */
export function editPost(req, res, next) {
  const raw = req.body?.content;
  if (!isText(raw, maxContent)) {
    return fail(res, 400, 'A post needs some words, up to 10,000 characters.', 'forumPostContent');
  }
  const content = raw.trim();
  return runContentAction(req, res, next, {
    capability: 'post.moderate',
    targetType: 'post',
    async apply(tx, { actor }) {
      const { post } = await lockPost(tx, actor, req.params.postId);
      await tx.forumPost.update({ where: { id: post.id }, data: { content } });
      return {
        targetId: String(post.id),
        before: { content: post.content },
        after: { content },
        body: { id: post.id, threadId: post.threadId, content },
      };
    },
  });
}

/** POST /api/v1/staff/forum/posts/:postId/remove { reason } */
export const removePost = (req, res, next) =>
  runContentAction(req, res, next, {
    capability: 'post.moderate',
    targetType: 'post',
    async apply(tx, { actor }) {
      const locked = await lockPost(tx, actor, req.params.postId);
      await removePostOrThread(tx, locked);
      const { post, thread, isOpening } = locked;
      return {
        targetId: String(post.id),
        before: {
          content: post.content,
          threadId: thread.id,
          threadTitle: thread.title,
          isOpening,
        },
        after: { removed: isOpening ? 'thread' : 'post' },
        body: { id: post.id, threadId: thread.id, removed: isOpening ? 'thread' : 'post' },
      };
    },
  });

/** GET /api/v1/staff/forum/held?after=<postId>: held posts, oldest first. */
export async function listHeldPosts(req, res, next) {
  try {
    const rawAfter = req.query?.after;
    const after = rawAfter === undefined ? null : intId(rawAfter);
    if (rawAfter !== undefined && after === null) {
      return fail(res, 400, 'Invalid page', 'forumHeldPage');
    }
    const rows = await prisma.forumPost.findMany({
      where: { status: 'held', ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: 'asc' },
      take: heldPage + 1,
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, username: true } },
        thread: { select: { id: true, title: true, section: true, status: true } },
      },
    });
    const posts = rows.slice(0, heldPage).map(row => ({
      id: row.id,
      content: row.content,
      createdAt: row.createdAt,
      author: row.author,
      thread: { id: row.thread.id, title: row.thread.title, section: row.thread.section },
      // A held thread is held for its opening post: accepting this post opens it.
      startsThread: row.thread.status === 'held',
    }));
    const nextAfter = rows.length > heldPage ? posts[posts.length - 1].id : null;
    return res.status(200).json({ posts, nextAfter });
  } catch (error) {
    logger.error(`[staff] held posts failed: ${error.message}`);
    return next(error);
  }
}

const notHeld = () =>
  new Refusal(409, 'A moderator has already decided this post.', 'forumPostNotHeld');

/** POST /api/v1/staff/forum/held/:postId/accept */
export const acceptHeldPost = (req, res, next) =>
  runContentAction(req, res, next, {
    capability: 'post.review',
    targetType: 'post',
    reasonRequired: false,
    async apply(tx, { actor }) {
      const { post, thread, isOpening } = await lockPost(tx, actor, req.params.postId);
      if (post.status !== 'held') {
        throw notHeld();
      }
      await tx.forumPost.update({ where: { id: post.id }, data: { status: 'published' } });
      const opensThread = isOpening && thread.status === 'held';
      await tx.forumThread.update({
        where: { id: thread.id },
        data: { lastActivityAt: new Date(), ...(opensThread ? { status: 'published' } : {}) },
      });
      return {
        targetId: String(post.id),
        before: { status: 'held' },
        after: { status: 'published', ...(opensThread ? { threadStatus: 'published' } : {}) },
        body: { id: post.id, threadId: thread.id, status: 'published' },
      };
    },
  });

/** POST /api/v1/staff/forum/held/:postId/reject { reason } */
export const rejectHeldPost = (req, res, next) =>
  runContentAction(req, res, next, {
    capability: 'post.review',
    targetType: 'post',
    async apply(tx, { actor }) {
      const locked = await lockPost(tx, actor, req.params.postId);
      const { post, thread, isOpening } = locked;
      if (post.status !== 'held') {
        throw notHeld();
      }
      await removePostOrThread(tx, locked);
      return {
        targetId: String(post.id),
        before: { status: 'held', content: post.content, threadId: thread.id, isOpening },
        after: { removed: isOpening ? 'thread' : 'post' },
        body: { id: post.id, threadId: thread.id, removed: isOpening ? 'thread' : 'post' },
        // q376: the author gets a short note. The steward's reason stays in the ledger.
        notify: {
          userId: post.authorId,
          type: 'forumPostRejected',
          payload: { threadTitle: thread.title, startedThread: isOpening },
        },
      };
    },
  });
