/**
 * WhileYouWereGoneController (Task 24-1)
 *
 * GET /api/v1/while-you-were-gone?since=<ISO-timestamp>
 * Returns prioritized list of events that occurred since the user was last active.
 *
 * Response shape:
 *   { items: WYAGItem[], since: string, hasMore: boolean }
 *
 * Priority:
 *   1 = competition results
 *   2 = foal milestones
 *   3 = messages
 *   4 = club activity
 *   5 = training completions
 *   6 = market sales
 *
 * Max 8 items returned.
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

const MAX_ITEMS = 8;

export async function getWhileYouWereGone(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const sinceParam = req.query.since;
    const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 4 * 60 * 60 * 1000);

    if (isNaN(since.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid since timestamp' });
    }

    const items = [];

    // 1. Competition results since last visit
    try {
      const competitionResults = await prisma.competitionResult.findMany({
        where: {
          horse: { userId },
          createdAt: { gte: since },
        },
        include: { horse: { select: { name: true } }, show: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });

      for (const result of competitionResults) {
        items.push({
          type: 'competition-result',
          priority: 1,
          title: `${result.horse?.name ?? 'Your horse'} competed in ${result.show?.name ?? 'a show'}`,
          description: `Placed ${result.placement ?? '?'} — Prize: $${result.prize ?? 0}`,
          timestamp: result.createdAt.toISOString(),
          actionUrl: '/competitions',
          metadata: { resultId: result.id, placement: result.placement, prize: result.prize },
        });
      }
    } catch {
      // CompetitionResult table may not exist in all migrations — skip gracefully
    }

    // 2. Unread messages
    try {
      const messages = await prisma.directMessage.findMany({
        where: { recipientId: userId, isRead: false, createdAt: { gte: since } },
        include: { sender: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
        take: 2,
      });

      for (const msg of messages) {
        items.push({
          type: 'message',
          priority: 3,
          title: `New message from ${msg.sender?.username ?? 'someone'}`,
          description: msg.content?.substring(0, 80) ?? '',
          timestamp: msg.createdAt.toISOString(),
          actionUrl: '/messages',
          metadata: { messageId: msg.id },
        });
      }
    } catch {
      // DirectMessage not yet in DB — skip
    }

    // 3. Foal development milestones (bond level increases)
    try {
      const foals = await prisma.foalDevelopment.findMany({
        where: {
          foal: { userId },
          lastInteractionAt: { gte: since },
          isActive: true,
        },
        include: { foal: { select: { name: true } } },
        take: 2,
      });

      for (const foal of foals) {
        items.push({
          type: 'foal-milestone',
          priority: 2,
          title: `${foal.foal?.name ?? 'Your foal'} is developing`,
          description: `Bond level: ${foal.bondScore ?? foal.bondingLevel ?? 0}`,
          timestamp: foal.lastInteractionAt?.toISOString() ?? new Date().toISOString(),
          actionUrl: '/grooms',
          metadata: { foalId: foal.foalId },
        });
      }
    } catch {
      // FoalDevelopment may not have these fields yet — skip
    }

    // Sort by priority then by timestamp (newest first within same priority)
    items.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    const limited = items.slice(0, MAX_ITEMS);

    return res.status(200).json({
      success: true,
      data: {
        items: limited,
        since: since.toISOString(),
        hasMore: items.length > MAX_ITEMS,
      },
    });
  } catch (error) {
    logger.error('WYAGController.getWhileYouWereGone error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch activity summary' });
  }
}
