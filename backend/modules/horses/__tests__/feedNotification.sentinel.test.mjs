/**
 * Sentinel test: feeding a horse creates a Notification row when a stat boost fires.
 *
 * The old JSONB code never wrote to the Notification table, so this test fails
 * before the fix.
 *
 * Equoria-ltm3l: the boost roll is Math.random (elite feed: 25%). The test used
 * to feed up to 20 times hoping one boost fired, so 0.75^20 = 0.32% of runs saw
 * no boost and failed (pre-push gate 2026-09-15). Math.random is now pinned for
 * the request — the whole real route, service, claim UPDATE and notification
 * write still run — so the roll is decided: a value below the tier's 25% fires
 * a boost on the first feed, and a value above it fires none. The pair proves
 * the notification is written exactly when a boost fires, not on every feed.
 */
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf, attachCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const ORIGIN = 'http://localhost:3000';

describe('SENTINEL: feed → statGain Notification', () => {
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
        ...fixtureColor(),
        name: `TestFixture-FeedNotifHorse-${Date.now()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId: user.id,
        equippedFeedType: 'elite',
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    // Per-user CSRF binding (Equoria-plw0h): the POST /feed mutation authenticates
    // via the Bearer token, so its sessionIdentifier resolves to user.id. The CSRF
    // token must be issued under the same identifier or doubleCsrf 403s. Pass the
    // access cookie so /csrf-token decodes it and binds the token to user.id.
    csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  }, 60000);

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.horse.delete({ where: { id: horse.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }, 30000);

  const feed = () =>
    attachCsrf(
      request(app)
        .post(`/api/v1/horses/${horse.id}/feed`)
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', ORIGIN),
      csrf,
    );

  // Each feed is a new game day for the horse: clear the claim column the
  // service guards on ("already fed today"), as the old loop did between feeds.
  const nextDay = () => prisma.horse.update({ where: { id: horse.id }, data: { lastFedDate: null } });

  it('writes no statGain Notification when the boost roll misses', async () => {
    // 0.99 * 100 = 99 >= the elite tier's statRollPct (25): rollStatBoost returns null.
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const res = await feed();
      expect(res.status).toBe(200);
      expect(res.body.data.statBoost).toBeNull();
    } finally {
      random.mockRestore();
    }
    const rows = await prisma.notification.findMany({ where: { userId: user.id, type: 'statGain' } });
    expect(rows).toHaveLength(0);
    await nextDay();
  }, 60000);

  it('creates a statGain Notification row when a stat boost fires', async () => {
    // First draw 0.01 * 100 = 1 < 25: a boost fires; the second draw picks
    // STATS[floor(0.01 * 12)] = STATS[0] = 'precision'.
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.01);
    try {
      const res = await feed();
      expect(res.status).toBe(200);
      expect(res.body.data.statBoost).toEqual({ stat: 'precision', amount: 1 });
    } finally {
      random.mockRestore();
    }
    const rows = await prisma.notification.findMany({ where: { userId: user.id, type: 'statGain' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toMatchObject({ horseName: horse.name, stat: 'precision', amount: 1 });
    await nextDay();
  }, 60000);
});
