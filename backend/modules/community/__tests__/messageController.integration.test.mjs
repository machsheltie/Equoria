/**
 * messageRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: inbox, sent, unread-count, getMessage, sendMessage, markRead.
 * Routes are mounted at /api/messages in authRouter.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let sender;
let recipient;
let senderToken;
let recipientToken;
let message;

beforeAll(async () => {
  sender = await prisma.user.create({
    data: {
      email: `msgsend-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `msgsend${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'MsgSend',
      lastName: 'Tester',
      money: 5000,
    },
  });
  recipient = await prisma.user.create({
    data: {
      email: `msgrecv-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `msgrecv${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'MsgRecv',
      lastName: 'Tester',
      money: 5000,
    },
  });
  senderToken = generateTestToken({ id: sender.id, email: sender.email, role: 'user' });
  recipientToken = generateTestToken({
    id: recipient.id,
    email: recipient.email,
    role: 'user',
  });

  // Create a seed message for get/mark-read tests
  message = await prisma.directMessage.create({
    data: {
      senderId: sender.id,
      recipientId: recipient.id,
      subject: 'TestFixture-Message Subject',
      content: 'TestFixture-Message Content',
      isRead: false,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.directMessage
    .deleteMany({
      where: {
        OR: [
          { senderId: sender.id },
          { recipientId: sender.id },
          { senderId: recipient.id },
          { recipientId: recipient.id },
        ],
      },
    })
    .catch(() => {});
  await prisma.user.delete({ where: { id: sender.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: recipient.id } }).catch(() => {});
}, 30000);

// ─── GET /api/messages/inbox ──────────────────────────────────────────────────

describe('GET /api/messages/inbox', () => {
  it('returns 200 with inbox for authenticated user', async () => {
    const res = await request(app)
      .get('/api/messages/inbox')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${recipientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.messages)).toBe(true);
    expect(typeof res.body.data.total).toBe('number');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/messages/inbox').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/messages/sent ───────────────────────────────────────────────────

describe('GET /api/messages/sent', () => {
  it('returns 200 with sent messages for authenticated user', async () => {
    const res = await request(app)
      .get('/api/messages/sent')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.messages)).toBe(true);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/messages/sent').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/messages/unread-count ──────────────────────────────────────────

describe('GET /api/messages/unread-count', () => {
  it('returns 200 with unread count for authenticated user', async () => {
    const res = await request(app)
      .get('/api/messages/unread-count')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${recipientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.count).toBe('number');
    expect(res.body.data.count).toBeGreaterThanOrEqual(1);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/messages/unread-count').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/messages/:id ────────────────────────────────────────────────────

describe('GET /api/messages/:id', () => {
  it('returns 200 with message for sender', async () => {
    const res = await request(app)
      .get(`/api/messages/${message.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message.id).toBe(message.id);
  });

  it('returns 200 with message for recipient', async () => {
    const res = await request(app)
      .get(`/api/messages/${message.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${recipientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for message not accessible by user', async () => {
    const res = await request(app)
      .get('/api/messages/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid message id', async () => {
    const res = await request(app)
      .get('/api/messages/not-a-number')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/messages/${message.id}`).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/messages ───────────────────────────────────────────────────────

describe('POST /api/messages', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/messages')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${senderToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when subject is empty', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/messages')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${senderToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ recipientId: recipient.id, subject: '', content: 'hello' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 when sending a valid message', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/messages')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${senderToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        recipientId: recipient.id,
        subject: 'TestFixture-Integration Subject',
        content: 'TestFixture-Integration Content',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.message.senderId).toBe(sender.id);
    expect(res.body.data.message.recipientId).toBe(recipient.id);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/messages')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        recipientId: recipient.id,
        subject: 'Test',
        content: 'Test content',
      });

    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/messages/:id/read ────────────────────────────────────────────

describe('PATCH /api/messages/:id/read', () => {
  it('returns 200 when recipient marks message as read', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .patch(`/api/messages/${message.id}/read`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${recipientToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when non-participant tries to mark message read', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .patch('/api/messages/999999999/read')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${senderToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .patch(`/api/messages/${message.id}/read`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});
