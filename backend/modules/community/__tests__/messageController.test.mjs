/**
 * messageController.test.mjs — real DB
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted from
 * jest.unstable_mockModule of prismaClient + logger to a real-DB integration
 * test against the equoria_test database.
 *
 * Coverage: getInbox, getSent, sendMessage, getMessage, markRead, getUnreadCount.
 *
 * Removed (per doctrine):
 *   - "returns 500 on database error" tests that mocked Prisma to reject —
 *     synthetic Prisma fault injection forbidden.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  getInbox,
  getSent,
  sendMessage,
  getMessage,
  markRead,
  getUnreadCount,
} from '../controllers/messageController.mjs';

const SUITE_PREFIX = 'msgc';

function makeReqRes(userId, overrides = {}) {
  let _status = 200;
  let _body = null;
  return {
    req: { user: { id: userId }, body: {}, params: {}, query: {}, ...overrides },
    res: {
      status(c) {
        _status = c;
        return this;
      },
      json(b) {
        _body = b;
        return this;
      },
      get statusValue() {
        return _status;
      },
      get jsonValue() {
        return _body;
      },
    },
  };
}

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Msgc',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function sendMsg(senderId, recipientId, overrides = {}) {
  return prisma.directMessage.create({
    data: {
      sender: { connect: { id: senderId } },
      recipient: { connect: { id: recipientId } },
      subject: overrides.subject ?? 'Test',
      content: overrides.content ?? 'Hello',
      isRead: overrides.isRead ?? false,
    },
  });
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  await prisma.directMessage.deleteMany({
    where: { OR: [{ senderId: { in: userIds } }, { recipientId: { in: userIds } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('messageController (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  describe('getInbox', () => {
    it('returns inbox messages with total and page', async () => {
      const recipient = await createUser();
      const sender = await createUser();
      await sendMsg(sender.id, recipient.id, { content: 'Hi!' });

      const h = makeReqRes(recipient.id, { query: {} });
      await getInbox(h.req, h.res);

      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.messages.length).toBe(1);
      expect(body.data.messages[0].content).toBe('Hi!');
      expect(body.data.total).toBe(1);
      expect(body.data.page).toBe(1);
    });

    it('only returns messages where current user is recipient', async () => {
      const user = await createUser();
      const sender = await createUser();
      const otherRecipient = await createUser();
      await sendMsg(sender.id, user.id, { content: 'For me' });
      await sendMsg(sender.id, otherRecipient.id, { content: 'Not for me' });

      const h = makeReqRes(user.id);
      await getInbox(h.req, h.res);

      const messages = h.res.jsonValue.data.messages;
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('For me');
    });
  });

  describe('sendMessage', () => {
    it('creates message and returns 201', async () => {
      const sender = await createUser();
      const recipient = await createUser();

      const h = makeReqRes(sender.id, {
        body: { recipientId: recipient.id, subject: 'Hello', content: 'Body' },
      });
      await sendMessage(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.message.subject).toBe('Hello');
      expect(body.data.message.content).toBe('Body');

      // Verify the DB row exists.
      const persisted = await prisma.directMessage.findUnique({ where: { id: body.data.message.id } });
      expect(persisted).not.toBeNull();
      expect(persisted.senderId).toBe(sender.id);
      expect(persisted.recipientId).toBe(recipient.id);
    });

    it('returns 400 when sender tries to message themselves', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, {
        body: { recipientId: user.id, subject: 'Self', content: 'Test' },
      });
      await sendMessage(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue).toMatchObject({
        success: false,
        message: expect.stringContaining('yourself'),
      });

      // Verify NO message was created.
      const count = await prisma.directMessage.count({ where: { senderId: user.id } });
      expect(count).toBe(0);
    });

    it('returns 404 when recipient does not exist', async () => {
      const sender = await createUser();
      const h = makeReqRes(sender.id, {
        body: { recipientId: 'ghost-id-that-does-not-exist', subject: 'Hi', content: 'Hello?' },
      });
      await sendMessage(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({
        success: false,
        message: expect.stringContaining('Recipient'),
      });
    });
  });

  describe('getMessage', () => {
    it('returns message when caller is the sender', async () => {
      const sender = await createUser();
      const recipient = await createUser();
      const msg = await sendMsg(sender.id, recipient.id, { isRead: true });

      const h = makeReqRes(sender.id, { params: { id: String(msg.id) } });
      await getMessage(h.req, h.res);

      expect(h.res.jsonValue.success).toBe(true);
      expect(h.res.jsonValue.data.message.id).toBe(msg.id);
    });

    it('auto-marks message as read when recipient fetches it', async () => {
      const sender = await createUser();
      const recipient = await createUser();
      const msg = await sendMsg(sender.id, recipient.id, { isRead: false });

      const h = makeReqRes(recipient.id, { params: { id: String(msg.id) } });
      await getMessage(h.req, h.res);

      // Verify the DB row was updated to isRead=true.
      const after = await prisma.directMessage.findUnique({ where: { id: msg.id } });
      expect(after.isRead).toBe(true);
    });

    it('returns 404 when unrelated user tries to access message (CWE-639 Equoria-y0l4)', async () => {
      const sender = await createUser();
      const recipient = await createUser();
      const intruder = await createUser();
      const msg = await sendMsg(sender.id, recipient.id);

      const h = makeReqRes(intruder.id, { params: { id: String(msg.id) } });
      await getMessage(h.req, h.res);

      // CWE-639: cross-user access must look identical to not-found, not 403.
      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Message not found' });
    });

    it('returns 404 when message does not exist', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '999999999' } });
      await getMessage(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
    });

    it('returns 400 for invalid message ID', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '0' } });
      await getMessage(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
    });
  });

  describe('markRead', () => {
    it('marks message read and returns success', async () => {
      const sender = await createUser();
      const recipient = await createUser();
      const msg = await sendMsg(sender.id, recipient.id, { isRead: false });

      const h = makeReqRes(recipient.id, { params: { id: String(msg.id) } });
      await markRead(h.req, h.res);

      expect(h.res.jsonValue.success).toBe(true);
      const after = await prisma.directMessage.findUnique({ where: { id: msg.id } });
      expect(after.isRead).toBe(true);
    });

    it('returns 404 when non-recipient tries to mark read (CWE-639 Equoria-a3kp)', async () => {
      const sender = await createUser();
      const recipient = await createUser();
      const intruder = await createUser();
      const msg = await sendMsg(sender.id, recipient.id, { isRead: false });

      const h = makeReqRes(intruder.id, { params: { id: String(msg.id) } });
      await markRead(h.req, h.res);

      // CWE-639: non-recipient must look identical to not-found, not 403.
      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Message not found' });

      // Message should NOT have been marked read.
      const after = await prisma.directMessage.findUnique({ where: { id: msg.id } });
      expect(after.isRead).toBe(false);
    });
  });

  describe('getSent', () => {
    it('returns sent messages with total and page', async () => {
      const sender = await createUser();
      const recipient = await createUser();
      await sendMsg(sender.id, recipient.id, { content: 'Yo!' });

      const h = makeReqRes(sender.id, { query: {} });
      await getSent(h.req, h.res);

      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.messages.length).toBe(1);
      expect(body.data.messages[0].content).toBe('Yo!');
      expect(body.data.total).toBe(1);
      expect(body.data.page).toBe(1);
    });

    it('only returns messages where current user is sender', async () => {
      const user = await createUser();
      const recipient = await createUser();
      const otherSender = await createUser();
      await sendMsg(user.id, recipient.id, { content: 'From me' });
      await sendMsg(otherSender.id, recipient.id, { content: 'Not from me' });

      const h = makeReqRes(user.id);
      await getSent(h.req, h.res);

      const messages = h.res.jsonValue.data.messages;
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('From me');
    });
  });

  describe('getUnreadCount', () => {
    it('returns count of unread messages for current user', async () => {
      const user = await createUser();
      const sender = await createUser();
      await sendMsg(sender.id, user.id, { isRead: false });
      await sendMsg(sender.id, user.id, { isRead: false });
      await sendMsg(sender.id, user.id, { isRead: false });
      await sendMsg(sender.id, user.id, { isRead: true }); // already read — not counted

      const h = makeReqRes(user.id);
      await getUnreadCount(h.req, h.res);

      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.count).toBe(3);
    });

    it('returns 0 when no unread messages', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id);
      await getUnreadCount(h.req, h.res);

      expect(h.res.jsonValue.data.count).toBe(0);
    });
  });
});
