/**
 * Sentinel test: feeding a horse creates a Notification row when a stat boost fires.
 *
 * Feed stat boosts are probabilistic, so the test feeds the horse up to 20 times
 * and asserts at least one stat_gain notification was inserted into the Notification
 * table. The old JSONB code never wrote to this table, so this test fails before fix.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf, attachCsrf } from '../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

describe('SENTINEL: feed → stat_gain Notification', () => {
  let user;
  let horse;
  let token;
  let csrf;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `feed_notif_${Date.now()}@test.com`,
        username: `feed_notif_${Date.now()}`,
        password: 'irrelevant',
        firstName: 'Feed',
        lastName: 'Notif',
        settings: {
          inventory: [{ id: 'feed-elite', quantity: 50, category: 'feed' }],
        },
      },
    });
    horse = await prisma.horse.create({
      data: {
        name: `TestFixture-FeedNotifHorse-${Date.now()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId: user.id,
        equippedFeedType: 'elite',
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    csrf = await fetchCsrf(app);
  }, 60000);

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.horse.delete({ where: { id: horse.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }, 30000);

  it('creates a stat_gain Notification row when a stat boost fires', async () => {
    let boostFound = false;
    for (let i = 0; i < 20; i++) {
      await attachCsrf(
        request(app).post(`/api/horses/${horse.id}/feed`).set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN),
        csrf,
      );

      const rows = await prisma.notification.findMany({
        where: { userId: user.id, type: 'stat_gain' },
      });
      if (rows.length > 0) {
        boostFound = true;
        expect(rows[0].payload).toHaveProperty('horseName');
        expect(rows[0].payload).toHaveProperty('stat');
        expect(rows[0].payload).toHaveProperty('amount');
        break;
      }
      await prisma.horse.update({
        where: { id: horse.id },
        data: { lastFedDate: null },
      });
    }
    expect(boostFound).toBe(true);
  }, 120000);
});
