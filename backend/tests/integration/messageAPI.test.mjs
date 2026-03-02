/**
 * Direct Message API Integration Tests (19B-2)
 * Tests for inbox, sent, compose, mark-read, and access control.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestUser, cleanupTestData } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import app from '../../app.mjs';

describe('📬 INTEGRATION: Messages API', () => {
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
        request(app).get('/api/messages/inbox'),
        request(app).post('/api/messages').send({}),
        request(app).get('/api/messages/unread-count'),
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
        .set('x-test-skip-csrf', 'true')
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
        .set('x-test-skip-csrf', 'true')
        .send({ recipientId: sender.id, subject: 'Hi me', content: 'test' });
      expect(res.status).toBe(400);
    });

    it('should reject missing subject', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ recipientId: recipient.id, content: 'no subject' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/messages/inbox', () => {
    it('should return received messages for recipient', async () => {
      const res = await request(app).get('/api/messages/inbox').set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      const msgs = res.body.data.messages;
      expect(msgs.some(m => m.id === sentMessageId)).toBe(true);
    });
  });

  describe('GET /api/messages/unread-count', () => {
    it('should return unread count for recipient', async () => {
      const res = await request(app).get('/api/messages/unread-count').set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBeGreaterThan(0);
    });
  });

  describe('GET /api/messages/sent', () => {
    it('should return sent messages for sender', async () => {
      const res = await request(app).get('/api/messages/sent').set('Authorization', `Bearer ${senderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.messages.some(m => m.id === sentMessageId)).toBe(true);
    });
  });

  describe('GET /api/messages/:id', () => {
    it('should return message and mark it read', async () => {
      const res = await request(app)
        .get(`/api/messages/${sentMessageId}`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message.isRead).toBe(true);
    });

    it('should block access to messages not yours', async () => {
      const other = await createTestUser({
        username: `other_${Date.now()}`,
        email: `other_${Date.now()}@test.com`,
      });
      const res = await request(app)
        .get(`/api/messages/${sentMessageId}`)
        .set('Authorization', `Bearer ${other.token}`);
      expect(res.status).toBe(403);
    });
  });
});
