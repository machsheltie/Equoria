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

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

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

    // Single clock source for the window's upper bound — used by the
    // training-complete + club-election blocks, which need "expired/concluded
    // WITHIN [since, now]" semantics (not just ">= since").
    const now = new Date();

    const items = [];
    const dataWarnings = [];

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
    } catch (err) {
      // WYAG is a low-priority dashboard surface; CompetitionResult is a real
      // model in prisma/schema.prisma. A defensive catch here keeps the
      // dashboard usable when transient query errors occur (FK traversal of
      // soft-deleted horses, etc.) instead of failing the whole response.
      // Surface the failure to the caller via dataWarnings so the UI can
      // signal "data unavailable" instead of crashing.
      logger.warn('WYAGController: competitionResult query failed', {
        error: err.message,
      });
      dataWarnings.push('competition_results_unavailable');
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
    } catch (err) {
      // DirectMessage is a real model in prisma/schema.prisma. Catching here
      // keeps the WYAG dashboard usable if a message query fails (e.g.
      // soft-deleted sender FK). Surfaced to caller via dataWarnings.
      logger.warn('WYAGController: directMessage query failed', {
        error: err.message,
      });
      dataWarnings.push('messages_unavailable');
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
    } catch (err) {
      // FoalDevelopment is a real model in prisma/schema.prisma. The defensive
      // catch covers transient FK errors during foal-relation traversal
      // (parallel to the issue tracked in Equoria-j8s2 for nextActionsController).
      // Surfaced to caller via dataWarnings.
      logger.warn('WYAGController: foalDevelopment query failed', {
        error: err.message,
      });
      dataWarnings.push('foal_milestones_unavailable');
    }

    // 4. Club activity — new members joining the player's clubs + club
    //    elections that concluded, both within the window. Sourced from real
    //    ClubMembership.joinedAt / ClubElection.endsAt rows, scoped to clubs the
    //    player belongs to (the same `club: { members: { some: { userId } } }`
    //    membership scoping the community controller uses for CWE-639).
    try {
      const newMembers = await prisma.clubMembership.findMany({
        where: {
          joinedAt: { gte: since },
          userId: { not: userId },
          club: { members: { some: { userId } } },
        },
        include: { club: { select: { name: true } }, user: { select: { username: true } } },
        orderBy: { joinedAt: 'desc' },
        take: 2,
      });

      for (const m of newMembers) {
        items.push({
          type: 'club-activity',
          priority: 4,
          title: `${m.user?.username ?? 'A new member'} joined ${m.club?.name ?? 'your club'}`,
          description: 'New club member',
          timestamp: m.joinedAt.toISOString(),
          actionUrl: '/clubs',
          metadata: { clubId: m.clubId, membershipId: m.id },
        });
      }

      // Elections that concluded (endsAt) during the window. ClubElection has no
      // `closedAt`; endsAt is the natural "results available" timestamp. A
      // future endsAt means the election is still open — excluded by `lte: now`.
      const concludedElections = await prisma.clubElection.findMany({
        where: {
          endsAt: { gte: since, lte: now },
          club: { members: { some: { userId } } },
        },
        include: { club: { select: { name: true } } },
        orderBy: { endsAt: 'desc' },
        take: 2,
      });

      for (const e of concludedElections) {
        items.push({
          type: 'club-activity',
          priority: 4,
          title: `Election for ${e.position ?? 'a position'} concluded in ${e.club?.name ?? 'your club'}`,
          description: 'Election results are available',
          timestamp: e.endsAt.toISOString(),
          actionUrl: '/clubs',
          metadata: { electionId: e.id, clubId: e.clubId },
        });
      }
    } catch (err) {
      // Club/ClubMembership/ClubElection are real models in prisma/schema.prisma.
      // Defensive catch keeps the WYAG dashboard usable on a transient club-query
      // failure; surfaced to the caller via dataWarnings.
      logger.warn('WYAGController: club activity query failed', {
        error: err.message,
      });
      dataWarnings.push('club_activity_unavailable');
    }

    // 5. Training completions — the player's horses whose training cooldown
    //    EXPIRED during the window (became ready to train while away). NOT
    //    "training happened": a freshly-trained horse has a FUTURE cooldown and
    //    is excluded by `lte: now`. trainingCooldown is the cooldown-end
    //    timestamp (backend/utils/trainingCooldown.mjs#setCooldown).
    try {
      const readyHorses = await prisma.horse.findMany({
        where: {
          userId,
          trainingCooldown: { gte: since, lte: now },
        },
        select: { id: true, name: true, trainingCooldown: true },
        orderBy: { trainingCooldown: 'desc' },
        take: 2,
      });

      for (const h of readyHorses) {
        items.push({
          type: 'training-complete',
          priority: 5,
          title: `${h.name ?? 'Your horse'} is ready to train again`,
          description: 'Training cooldown has expired',
          timestamp: h.trainingCooldown.toISOString(),
          actionUrl: '/training',
          metadata: { horseId: h.id },
        });
      }
    } catch (err) {
      // Horse.trainingCooldown is a real column in prisma/schema.prisma.
      // Defensive catch keeps the dashboard usable on a transient failure;
      // surfaced to the caller via dataWarnings.
      logger.warn('WYAGController: training completions query failed', {
        error: err.message,
      });
      dataWarnings.push('training_completions_unavailable');
    }

    // 6. Market sales — horses the player SOLD while away (HorseSale rows where
    //    the player is the seller, sold within the window). Seller-side is the
    //    passive "happened while you were gone" event; a purchase is an action
    //    the returning player initiated, not away-summary news.
    try {
      const sales = await prisma.horseSale.findMany({
        where: { sellerId: userId, soldAt: { gte: since } },
        include: { buyer: { select: { username: true } } },
        orderBy: { soldAt: 'desc' },
        take: 2,
      });

      for (const s of sales) {
        items.push({
          type: 'market-sale',
          priority: 6,
          title: `${s.horseName ?? 'Your horse'} sold for $${s.salePrice ?? 0}`,
          description: `Purchased by ${s.buyer?.username ?? 'a buyer'}`,
          timestamp: s.soldAt.toISOString(),
          actionUrl: '/marketplace',
          metadata: { saleId: s.id, salePrice: s.salePrice, horseId: s.horseId },
        });
      }
    } catch (err) {
      // HorseSale is a real model in prisma/schema.prisma. Defensive catch keeps
      // the dashboard usable on a transient failure; surfaced via dataWarnings.
      logger.warn('WYAGController: market sales query failed', {
        error: err.message,
      });
      dataWarnings.push('market_sales_unavailable');
    }

    // Sort by priority then by timestamp (newest first within same priority)
    items.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    const limited = items.slice(0, MAX_ITEMS);

    return res.status(200).json({
      success: true,
      data: {
        items: limited,
        since: since.toISOString(),
        hasMore: items.length > MAX_ITEMS,
        ...(dataWarnings.length > 0 && { dataWarnings }),
      },
    });
  } catch (error) {
    logger.error('WYAGController.getWhileYouWereGone error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch activity summary' });
  }
}
