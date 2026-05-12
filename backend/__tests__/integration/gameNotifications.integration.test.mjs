import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf, attachCsrf } from '../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

describe('INTEGRATION: game-notifications endpoints', () => {
  let user;
  let token;
  let csrf;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `notif_api_${Date.now()}@test.com`,
        username: `notif_api_${Date.now()}`,
        password: 'irrelevant',
        firstName: 'Notif',
        lastName: 'Test',
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    csrf = await fetchCsrf(app);
  }, 30000);

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }, 30000);

  it('GET /api/users/me/game-notifications returns rows from Notification table', async () => {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'stat_gain',
        payload: { horseName: 'Blaze', stat: 'speed', amount: 1 },
      },
    });

    const res = await request(app)
      .get('/api/users/me/game-notifications')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    const notif = res.body.data.notifications.find(n => n.type === 'stat_gain');
    expect(notif).toBeDefined();
    expect(notif.payload.horseName).toBe('Blaze');
  });

  it('PATCH /api/users/me/game-notifications/read-all marks Notification rows as read', async () => {
    const created = await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'stat_gain',
        payload: { horseName: 'Thunder' },
        isRead: false,
      },
    });

    const res = await attachCsrf(
      request(app)
        .patch('/api/users/me/game-notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', ORIGIN),
      csrf,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const row = await prisma.notification.findUnique({ where: { id: created.id } });
    expect(row.isRead).toBe(true);

    const followUp = await request(app)
      .get('/api/users/me/game-notifications')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN);
    expect(followUp.body.data.unreadCount).toBe(0);
  });
});
