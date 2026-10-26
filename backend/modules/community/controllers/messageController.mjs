/**
 * Message Controller (19B-2)
 * Handles DirectMessage inbox, sent, compose, and mark-read.
 *
 * Routes:
 *   GET  /api/messages/inbox                → inbox for authenticated user
 *   GET  /api/messages/sent                 → sent messages for authenticated user
 *   GET  /api/messages/unread-count         → count of unread messages
 *   GET  /api/messages/conversations-count  → count of distinct correspondents
 *   GET  /api/messages/:id           → single message (marks as read for recipient)
 *   POST /api/messages               → compose + send
 *   PATCH /api/messages/:id/read     → mark as read
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  InvalidCursorError,
  findKeysetPage,
  readKeysetParams,
} from '../../../utils/paginationHelper.mjs';
// Equoria-lewrv (ADR-011): publish a low-latency 'message' SSE nudge to the
// recipient AFTER the DirectMessage row is persisted. Fire-and-forget — bus
// delivery must never affect the send (the DB row is the source of truth).
import { publishUserEvent } from '../../../services/eventBus.mjs';
import { runRetryableTransaction } from '../../../utils/retryableTransaction.mjs';
import { isStaffRole } from '../../staff/index.mjs';
import { sendHelpMessageTx } from '../services/helpGuardrails.mjs';

const USER_SELECT = { id: true, username: true };

const PAGE_SIZE = 50;

// Newest first, ties on the instant broken by id (Equoria-cmw85.20), so a message
// written while the player pages through the box is neither skipped nor repeated.
const MESSAGE_SORT = [
  { key: 'createdAt', dir: 'desc', type: 'date' },
  { key: 'id', dir: 'desc', type: 'int' },
];

/**
 * One keyset page of a message box plus the box's total. `?cursor` continues a
 * list; `?page` still works without one. Replies with the shape the screen has
 * always read, plus `pageInfo`.
 */
async function respondWithMessageBox(req, res, { where, counterpart, label }) {
  try {
    const { limit, cursor, skip } = readKeysetParams(req.query, { def: PAGE_SIZE, max: 100 });
    const [{ items, pageInfo }, total] = await Promise.all([
      findKeysetPage(args => prisma.directMessage.findMany(args), {
        where,
        sort: MESSAGE_SORT,
        limit,
        cursor,
        skip,
        extra: { include: { [counterpart]: { select: USER_SELECT } } },
      }),
      prisma.directMessage.count({ where }),
    ]);
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10) || 1);
    return res.json({ success: true, data: { messages: items, total, page, pageInfo } });
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    logger.error(`[messageController.${label}] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: `Failed to fetch ${label === 'getInbox' ? 'inbox' : 'sent messages'}`,
    });
  }
}

/** GET /api/messages/inbox?page=1 (or ?cursor=...) */
export function getInbox(req, res) {
  return respondWithMessageBox(req, res, {
    where: { recipientId: req.user.id },
    counterpart: 'sender',
    label: 'getInbox',
  });
}

/** GET /api/messages/sent?page=1 (or ?cursor=...) */
export function getSent(req, res) {
  return respondWithMessageBox(req, res, {
    where: { senderId: req.user.id },
    counterpart: 'recipient',
    label: 'getSent',
  });
}

/** GET /api/messages/unread-count */
export async function getUnreadCount(req, res) {
  const userId = req.user.id;
  try {
    const count = await prisma.directMessage.count({
      where: { recipientId: userId, isRead: false },
    });
    return res.json({ success: true, data: { count } });
  } catch (error) {
    logger.error(`[messageController.getUnreadCount] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
  }
}

/**
 * GET /api/messages/conversations-count
 *
 * Count of distinct correspondents — users the caller has exchanged at least
 * one DirectMessage with, in either direction (Equoria-r4cyk: backs the
 * community-hub "Conversations" stat with real data instead of a stub).
 * Deduplicates across directions: sending to AND receiving from the same
 * user is ONE conversation.
 */
export async function getConversationsCount(req, res) {
  const userId = req.user.id;
  try {
    const [inboundSenders, outboundRecipients] = await Promise.all([
      prisma.directMessage.findMany({
        where: { recipientId: userId },
        distinct: ['senderId'],
        select: { senderId: true },
      }),
      prisma.directMessage.findMany({
        where: { senderId: userId },
        distinct: ['recipientId'],
        select: { recipientId: true },
      }),
    ]);
    const correspondents = new Set([
      ...inboundSenders.map(m => m.senderId),
      ...outboundRecipients.map(m => m.recipientId),
    ]);
    return res.json({ success: true, data: { count: correspondents.size } });
  } catch (error) {
    logger.error(`[messageController.getConversationsCount] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch conversations count' });
  }
}

/** GET /api/messages/:id — marks as read for recipient */
export async function getMessage(req, res) {
  const id = parseInt(req.params.id, 10);
  const userId = req.user.id;
  if (!id || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid message ID' });
  }

  try {
    // CWE-639 (Equoria-y0l4): scope by sender/recipient so cross-user access
    // is indistinguishable from not-found — same 404 + same body for both.
    const message = await prisma.directMessage.findFirst({
      where: {
        id,
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      include: {
        sender: { select: USER_SELECT },
        recipient: { select: USER_SELECT },
      },
    });

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Auto-mark as read when recipient fetches
    if (message.recipientId === userId && !message.isRead) {
      await prisma.directMessage.update({ where: { id }, data: { isRead: true } });
      message.isRead = true;
    }

    return res.json({ success: true, data: { message } });
  } catch (error) {
    logger.error(`[messageController.getMessage] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch message' });
  }
}

/** POST /api/messages — compose + send */
export async function sendMessage(req, res) {
  const { recipientId, subject, content, tag } = req.body;
  const senderId = req.user.id;

  if (senderId === recipientId) {
    return res.status(400).json({ success: false, message: 'Cannot send a message to yourself' });
  }

  try {
    const recipientExists = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipientExists) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    // Equoria-vc5x1: a player writing to a staff member is asking for help, and
    // the Need Help? guardrails apply however the message was composed.
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { role: true },
    });
    let message;
    if (isStaffRole(recipientExists.role) && !isStaffRole(sender?.role)) {
      const outcome = await runRetryableTransaction(prisma, tx =>
        sendHelpMessageTx(tx, {
          senderId,
          recipient: recipientExists,
          subject,
          content,
          now: new Date(),
        }),
      );
      if (outcome.refused) {
        const { status, code, message: refusalMessage, retryAfterSeconds } = outcome.refused;
        return res.status(status).json({
          success: false,
          message: refusalMessage,
          code,
          ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
        });
      }
      message = outcome.message;
    } else {
      message = await prisma.directMessage.create({
        data: { senderId, recipientId, subject, content, tag },
        include: {
          sender: { select: USER_SELECT },
          recipient: { select: USER_SELECT },
        },
      });
    }

    logger.info(`[messageController.sendMessage] ${senderId} → ${recipientId}`);

    // Equoria-lewrv (ADR-011): real-time receipt to the recipient AFTER the
    // DB write succeeded. Emitted as type 'message' — per the SSE spec a
    // frame with `event: message` dispatches to the EventSource onmessage
    // catch-all (useEventStream.ts), which invalidates the messages
    // unread-count query live. publishUserEvent never throws, but guard
    // anyway so a future change cannot couple the send to bus delivery.
    try {
      publishUserEvent(recipientId, 'message', {
        messageId: message.id,
        senderId,
        subject: message.subject ?? null,
      });
    } catch (busError) {
      logger.error(`[messageController.sendMessage] event bus publish failed: ${busError.message}`);
    }

    return res.status(201).json({ success: true, data: { message } });
  } catch (error) {
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message });
    }
    logger.error(`[messageController.sendMessage] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
}

/** PATCH /api/messages/:id/read */
export async function markRead(req, res) {
  const id = parseInt(req.params.id, 10);
  const userId = req.user.id;
  if (!id || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid message ID' });
  }

  try {
    // CWE-639 (Equoria-a3kp): scope by recipient so non-recipient is
    // indistinguishable from not-found.
    const message = await prisma.directMessage.findFirst({
      where: { id, recipientId: userId },
    });
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    await prisma.directMessage.update({ where: { id }, data: { isRead: true } });
    return res.json({ success: true });
  } catch (error) {
    logger.error(`[messageController.markRead] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to mark message as read' });
  }
}
