/**
 * Message Controller (19B-2)
 * Handles DirectMessage inbox, sent, compose, and mark-read.
 *
 * Routes:
 *   GET  /api/messages/inbox         → inbox for authenticated user
 *   GET  /api/messages/sent          → sent messages for authenticated user
 *   GET  /api/messages/unread-count  → count of unread messages
 *   GET  /api/messages/:id           → single message (marks as read for recipient)
 *   POST /api/messages               → compose + send
 *   PATCH /api/messages/:id/read     → mark as read
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
// Equoria-lewrv (ADR-011): publish a low-latency 'message' SSE nudge to the
// recipient AFTER the DirectMessage row is persisted. Fire-and-forget — bus
// delivery must never affect the send (the DB row is the source of truth).
import { publishUserEvent } from '../../../services/eventBus.mjs';

const USER_SELECT = { id: true, username: true };

const PAGE_SIZE = 50;

/** GET /api/messages/inbox?page=1 */
export async function getInbox(req, res) {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10) || 1);
  try {
    const [messages, total] = await prisma.$transaction([
      prisma.directMessage.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        include: { sender: { select: USER_SELECT } },
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      }),
      prisma.directMessage.count({ where: { recipientId: userId } }),
    ]);
    return res.json({ success: true, data: { messages, total, page } });
  } catch (error) {
    logger.error(`[messageController.getInbox] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch inbox' });
  }
}

/** GET /api/messages/sent?page=1 */
export async function getSent(req, res) {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10) || 1);
  try {
    const [messages, total] = await prisma.$transaction([
      prisma.directMessage.findMany({
        where: { senderId: userId },
        orderBy: { createdAt: 'desc' },
        include: { recipient: { select: USER_SELECT } },
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      }),
      prisma.directMessage.count({ where: { senderId: userId } }),
    ]);
    return res.json({ success: true, data: { messages, total, page } });
  } catch (error) {
    logger.error(`[messageController.getSent] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch sent messages' });
  }
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

    const message = await prisma.directMessage.create({
      data: { senderId, recipientId, subject, content, tag },
      include: {
        sender: { select: USER_SELECT },
        recipient: { select: USER_SELECT },
      },
    });

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
