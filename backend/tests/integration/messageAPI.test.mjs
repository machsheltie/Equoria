/**
 * Direct Message API Integration Tests (19B-2)
 * Tests for inbox, sent, compose, mark-read, and access control.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestUser, cleanupTestData } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import app from '../../app.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
describe('📬 INTEGRATION: Messages API', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  let sender, senderToken, recipient, recipientToken;
  let sentMessageId;

  beforeAll(async () => {
    const ts = Date.now();
    const s = await createTestUser({ username: `sender_${ts}`, email: `sender_${ts}@test.com` });
    const r = await createTestUser({
      username: `recipient_${ts}`,
      email: `recipient_${ts}@test.com`,
    });
    sender = s.user;
    senderToken = s.token;
    recipient = r.user;
    recipientToken = r.token;
  });

  afterAll(async () => {
    try {
      await prisma.directMessage.deleteMany({
        where: { OR: [{ senderId: sender?.id }, { senderId: recipient?.id }] },
      });
    } catch {
      /* ignore */
    }
    await cleanupTestData();
  });

  describe('Authentication', () => {
    it('should require auth for all message endpoints', async () => {
      const [a, b, c] = await Promise.all([
        request(app).get('/api/messages/inbox').set('Origin', 'http://localhost:3000'),
        request(app).post('/api/messages').set('Origin', 'http://localhost:3000').send({}),
        request(app).get('/api/messages/unread-count').set('Origin', 'http://localhost:3000'),
      ]);
      expect(a.status).toBe(401);
      expect(b.status).toBe(401);
      expect(c.status).toBe(401);
    });
  });

  describe('POST /api/messages', () => {
    it('should send a message', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ recipientId: recipient.id, subject: 'Hello!', content: 'Want to trade horses?' });

      expect(res.status).toBe(201);
      expect(res.body.data.message.subject).toBe('Hello!');
      expect(res.body.data.message.isRead).toBe(false);
      sentMessageId = res.body.data.message.id;
    });

    it('should reject sending to self', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ recipientId: sender.id, subject: 'Hi me', content: 'test' });
      expect(res.status).toBe(400);
    });

    it('should reject missing subject', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ recipientId: recipient.id, content: 'no subject' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/messages/inbox', () => {
    it('should return received messages for recipient', async () => {
      const res = await request(app)
        .get('/api/messages/inbox')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      const msgs = res.body.data.messages;
      expect(msgs.some(m => m.id === sentMessageId)).toBe(true);
    });
  });

  describe('GET /api/messages/unread-count', () => {
    it('should return unread count for recipient', async () => {
      const res = await request(app)
        .get('/api/messages/unread-count')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBeGreaterThan(0);
    });
  });

  describe('GET /api/messages/sent', () => {
    it('should return sent messages for sender', async () => {
      const res = await request(app)
        .get('/api/messages/sent')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${senderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.messages.some(m => m.id === sentMessageId)).toBe(true);
    });
  });

  describe('GET /api/messages/:id', () => {
    it('should return message and mark it read', async () => {
      const res = await request(app)
        .get(`/api/messages/${sentMessageId}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message.isRead).toBe(true);
    });

    it('should block access to messages not yours', async () => {
      const other = await createTestUser({
        username: `other_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        email: `other_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`,
      });
      const res = await request(app)
        .get(`/api/messages/${sentMessageId}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${other.token}`);
      expect(res.status).toBe(403);
    });
  });
});
