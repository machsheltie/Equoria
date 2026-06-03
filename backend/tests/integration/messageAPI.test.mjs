/**
 * Direct Message API Integration Tests (19B-2)
 * Tests for inbox, sent, compose, mark-read, and access control.
 *
 * SHARED-STATE NOTE (Equoria-4kp53):
 * sentMessageId is used across multiple describes. To make this suite
 * order-independent, a shared fixture message is created in a top-level
 * beforeAll. The 'GET /:id should return message and mark it read' test
 * sends its OWN throwaway message (not the shared one) because that
 * test mutates isRead, which would clash with the unread-count assertion.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { createTestUser, cleanupTestData } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import app from '../../app.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
describe('📬 INTEGRATION: Messages API', () => {
  // Equoria-rnbzn: per-user CSRF binding. The CSRF token must be issued under
  // the same sessionIdentifier (user.id) the mutation will resolve. Every
  // mutating call here is made by the sender, so the token is bound to the
  // sender by forwarding its accessToken cookie on the issuance GET. Fetched
  // AFTER the user exists (in the dependent beforeAll below), not up front.
  let __csrf__;

  let sender, senderToken, recipient, recipientToken;
  let sentMessageId;

  beforeAll(async () => {
    // Equoria-rnbzn: randomize the previously-fixed `_${Date.now()}` fixtures.
    // Date.now() collides across parallel real-DB workers; randomBytes hex is
    // collision-free. Username stays within [A-Za-z0-9_] 3-30 chars.
    const uid = randomBytes(6).toString('hex');
    const s = await createTestUser({ username: `sender_${uid}`, email: `sender_${uid}@test.com` });
    const r = await createTestUser({
      username: `recipient_${uid}`,
      email: `recipient_${uid}@test.com`,
    });
    sender = s.user;
    senderToken = s.token;
    recipient = r.user;
    recipientToken = r.token;

    // Bind CSRF to the sender (the only mutating identity in this suite).
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${senderToken}`] });
  });

  // Equoria-4kp53: lift shared message creation to top-level beforeAll so
  // describes can run in any order. The 'should send a message' test below
  // independently sends its own message rather than mutating the shared id.
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        recipientId: recipient.id,
        subject: 'Shared fixture message (Equoria-4kp53)',
        content: 'For cross-describe reads — must remain unread.',
      });
    sentMessageId = res.body?.data?.message?.id;
  });

  afterAll(async () => {
    // Equoria-rnbzn: FK-ordered, fail-loud cleanup. DirectMessage has FKs to
    // User (sender + recipient) with no cascade, so every message touching
    // either fixture user MUST be deleted BEFORE cleanupTestData() removes the
    // users — otherwise the user delete violates the FK. Scoped by the
    // fixture user ids (both senderId AND recipientId), never a bare
    // deleteMany. No silent no-op catch arm: a cleanup failure must surface so
    // a leaked row can't masquerade as a passing teardown.
    await prisma.directMessage.deleteMany({
      where: {
        OR: [
          { senderId: sender?.id },
          { recipientId: sender?.id },
          { senderId: recipient?.id },
          { recipientId: recipient?.id },
        ],
      },
    });
    await cleanupTestData();
  });

  describe('Authentication', () => {
    it('should require auth for all message endpoints', async () => {
      const [a, b, c] = await Promise.all([
        request(app).get('/api/v1/messages/inbox').set('Origin', 'http://localhost:3000'),
        request(app).post('/api/v1/messages').set('Origin', 'http://localhost:3000').send({}),
        request(app).get('/api/v1/messages/unread-count').set('Origin', 'http://localhost:3000'),
      ]);
      expect(a.status).toBe(401);
      expect(b.status).toBe(401);
      expect(c.status).toBe(401);
    });
  });

  describe('POST /api/v1/messages', () => {
    it('should send a message', async () => {
      // Equoria-4kp53: this test creates and asserts its OWN message.
      // The shared `sentMessageId` is provisioned in the top-level
      // beforeAll above so this test no longer mutates shared state.
      const res = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ recipientId: recipient.id, subject: 'Hello!', content: 'Want to trade horses?' });

      expect(res.status).toBe(201);
      expect(res.body.data.message.subject).toBe('Hello!');
      expect(res.body.data.message.isRead).toBe(false);
    });

    it('should reject sending to self', async () => {
      const res = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ recipientId: sender.id, subject: 'Hi me', content: 'test' });
      expect(res.status).toBe(400);
    });

    it('should reject missing subject', async () => {
      const res = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ recipientId: recipient.id, content: 'no subject' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/messages/inbox', () => {
    it('should return received messages for recipient', async () => {
      const res = await request(app)
        .get('/api/v1/messages/inbox')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      const msgs = res.body.data.messages;
      expect(msgs.some(m => m.id === sentMessageId)).toBe(true);
    });
  });

  describe('GET /api/v1/messages/unread-count', () => {
    it('should return unread count for recipient', async () => {
      const res = await request(app)
        .get('/api/v1/messages/unread-count')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/messages/sent', () => {
    it('should return sent messages for sender', async () => {
      const res = await request(app)
        .get('/api/v1/messages/sent')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${senderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.messages.some(m => m.id === sentMessageId)).toBe(true);
    });
  });

  describe('GET /api/v1/messages/:id', () => {
    it('should return message and mark it read', async () => {
      // Equoria-4kp53: this test mutates isRead, so it must NOT touch the
      // shared `sentMessageId` (which must remain unread for the
      // unread-count assertion). Create a throwaway message inline.
      const send = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          recipientId: recipient.id,
          subject: 'Mark-read fixture (Equoria-4kp53)',
          content: 'Throwaway; will be marked read.',
        });
      const throwawayId = send.body?.data?.message?.id;

      const res = await request(app)
        .get(`/api/v1/messages/${throwawayId}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message.isRead).toBe(true);
    });

    it('should block access to messages not yours', async () => {
      const other = await createTestUser({
        username: `other_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        email: `other_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@test.com`,
      });
      const res = await request(app)
        .get(`/api/v1/messages/${sentMessageId}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${other.token}`);
      // CWE-639: controller scopes by OR[senderId, recipientId]; non-participant
      // is indistinguishable from not-found → 404 (not 403) prevents ID enumeration.
      expect(res.status).toBe(404);
    });
  });
});
