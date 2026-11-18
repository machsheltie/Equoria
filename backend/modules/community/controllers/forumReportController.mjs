/**
 * A player reports someone else's forum post (Equoria-puj1e.3, owner ruling q382).
 *
 * POST /api/v1/forum/posts/:postId/report { reason, note? }
 *
 * The reasons are a short list: rude or bullying, spam or selling, personal
 * information, or other with a note. The report goes to the moderators in the
 * Steward's Office. A player has at most one open report per post: a second while
 * the first is open is refused (a partial unique index holds this under a race).
 * A player cannot report their own post, or a post they cannot see (a held post,
 * or anything in a held thread, answers like a missing one).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

export const forumReportReasons = Object.freeze([
  'rudeOrBullying',
  'spamOrSelling',
  'personalInformation',
  'other',
]);

export const maxReportNote = 500;

const refuse = (res, status, code, message) =>
  res.status(status).json({ success: false, code, message });

/** A positive integer id from a path segment, or null. */
function postIdFrom(raw) {
  if (typeof raw !== 'string' || !/^[1-9][0-9]{0,9}$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  return id <= 2_147_483_647 ? id : null;
}

class ReportRefusal extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const isUniqueViolation = error =>
  error?.code === 'P2002' ||
  (error?.code === 'P2010' && error?.meta?.code === '23505') ||
  /forum_reports_open_postId_reporterId_key/.test(String(error?.message ?? ''));

/** POST /api/v1/forum/posts/:postId/report */
export async function reportPost(req, res) {
  const postId = postIdFrom(req.params.postId);
  if (postId === null) {
    return refuse(res, 400, 'forumReportPost', 'That post could not be found.');
  }
  const { reason } = req.body ?? {};
  if (!forumReportReasons.includes(reason)) {
    return refuse(res, 400, 'forumReportReason', 'Choose why you are reporting this post.');
  }
  const rawNote = req.body?.note;
  if (rawNote !== undefined && rawNote !== null && typeof rawNote !== 'string') {
    return refuse(res, 400, 'forumReportNote', 'The note must be words.');
  }
  const note = typeof rawNote === 'string' && rawNote.trim() !== '' ? rawNote.trim() : null;
  if (note !== null && note.length > maxReportNote) {
    return refuse(res, 400, 'forumReportNote', `Keep the note to ${maxReportNote} characters.`);
  }
  if (reason === 'other' && note === null) {
    return refuse(res, 400, 'forumReportNote', 'Say a few words about what is wrong.');
  }
  const reporterId = req.user.id;

  try {
    await prisma.$transaction(async tx => {
      const post = await tx.forumPost.findUnique({
        where: { id: postId },
        select: { authorId: true, status: true, thread: { select: { status: true } } },
      });
      // A post the reporter cannot see answers exactly like a missing one.
      if (!post || post.status !== 'published' || post.thread.status !== 'published') {
        throw new ReportRefusal(404, 'forumReportPost', 'That post could not be found.');
      }
      if (post.authorId === reporterId) {
        throw new ReportRefusal(400, 'forumReportOwnPost', 'You cannot report your own post.');
      }
      const open = await tx.forumReport.findFirst({
        where: { postId, reporterId, status: 'open' },
        select: { id: true },
      });
      if (open) {
        throw new ReportRefusal(
          409,
          'forumReportDuplicate',
          'You have already reported this post.',
        );
      }
      await tx.forumReport.create({ data: { postId, reporterId, reason, note } });
    });
    logger.info(`[forum] user ${reporterId} reported post ${postId}`);
    return res.status(201).json({ success: true, data: { postId, reportedByMe: true } });
  } catch (error) {
    if (error instanceof ReportRefusal) {
      return refuse(res, error.status, error.code, error.message);
    }
    if (isUniqueViolation(error)) {
      return refuse(res, 409, 'forumReportDuplicate', 'You have already reported this post.');
    }
    logger.error(`[forum] report on post ${postId} failed: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to send the report' });
  }
}
