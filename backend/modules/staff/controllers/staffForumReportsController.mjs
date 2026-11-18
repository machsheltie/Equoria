/**
 * Players' reports of forum posts in the Steward's Office (Equoria-puj1e.3, owner
 * ruling q382).
 *
 * `report.review` (moderators, admins and the owner): the open reports, oldest
 * first, each with its reason, the reporter's note, the post and a link to its
 * thread. A steward resolves a report (something was done about it, with the
 * existing post tools) or dismisses it (nothing needed doing). A decided report
 * leaves the list; deciding it again is refused.
 *
 * The reported post's author is judged by staffTargetRefusal under their row lock,
 * as for held posts: nobody decides a report about their own post, and a moderator
 * or admin never decides one about another steward's post (only the owner can).
 * Then the report row is locked, so two stewards deciding one report serialise and
 * the second is refused. Every decision and its staff log entry commit together.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  Refusal,
  fail,
  intId,
  lockAndJudgeOwner,
  runContentAction,
} from '../services/staffContentAction.mjs';

const reportPage = 50;

/** GET /api/v1/staff/forum/reports?after=<reportId>: open reports, oldest first. */
export async function listForumReports(req, res, next) {
  try {
    const rawAfter = req.query?.after;
    const after = rawAfter === undefined ? null : intId(rawAfter);
    if (rawAfter !== undefined && after === null) {
      return fail(res, 400, 'Invalid page', 'forumReportPage');
    }
    const rows = await prisma.forumReport.findMany({
      where: { status: 'open', ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: 'asc' },
      take: reportPage + 1,
      select: {
        id: true,
        reason: true,
        note: true,
        createdAt: true,
        reporter: { select: { id: true, username: true } },
        post: {
          select: {
            id: true,
            content: true,
            status: true,
            author: { select: { id: true, username: true } },
            thread: { select: { id: true, title: true } },
          },
        },
      },
    });
    const reports = rows.slice(0, reportPage);
    const nextAfter = rows.length > reportPage ? reports[reports.length - 1].id : null;
    return res.status(200).json({ reports, nextAfter });
  } catch (error) {
    logger.error(`[staff] forum reports failed: ${error.message}`);
    return next(error);
  }
}

const noSuchReport = () => new Refusal(404, 'No such report', 'forumReportNotFound');

/** Decide one open report: 'resolved' or 'dismissed'. */
const decideReport = status => (req, res, next) =>
  runContentAction(req, res, next, {
    capability: 'report.review',
    targetType: 'report',
    reasonRequired: false,
    async apply(tx, { actor }) {
      const id = intId(req.params.reportId);
      const seen = id
        ? await tx.forumReport.findUnique({
            where: { id },
            select: { post: { select: { authorId: true } } },
          })
        : null;
      if (!seen) {
        throw noSuchReport();
      }
      await lockAndJudgeOwner(tx, actor, seen.post.authorId);
      const rows = await tx.$queryRaw`
        SELECT id, "postId", status FROM "forum_reports" WHERE id = ${id} FOR UPDATE`;
      const report = rows[0];
      if (!report) {
        throw noSuchReport();
      }
      if (report.status !== 'open') {
        throw new Refusal(409, 'A steward has already decided this report.', 'forumReportDecided');
      }
      await tx.forumReport.update({
        where: { id },
        data: { status, decidedAt: new Date(), decidedById: actor.id },
      });
      return {
        targetId: String(id),
        before: { status: 'open', postId: report.postId },
        after: { status },
        body: { id, status },
      };
    },
  });

/** POST /api/v1/staff/forum/reports/:reportId/resolve { reason? } */
export const resolveForumReport = decideReport('resolved');

/** POST /api/v1/staff/forum/reports/:reportId/dismiss { reason? } */
export const dismissForumReport = decideReport('dismissed');
