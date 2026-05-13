/**
 * userController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getUser, getUserProgressAPI, getUserCompetitionStats,
 * getGameNotifications, markGameNotificationsRead, getCommunityActivity.
 * All routes live under authRouter → real auth + real CSRF for PATCH.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `uc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `uc${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'UC',
      lastName: 'Tester',
      money: 1000,
      settings: {},
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
}, 30000);

afterAll(async () => {
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/users/community/activity ───────────────────────────────────────

describe('GET /api/users/community/activity', () => {
  it('returns 200 with activity array', async () => {
    const res = await request(app)
      .get('/api/users/community/activity')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/users/community/activity').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/users/me/game-notifications ─────────────────────────────────────

describe('GET /api/users/me/game-notifications', () => {
  it('returns 200 with empty notifications for new user', async () => {
    const res = await request(app)
      .get('/api/users/me/game-notifications')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('notifications');
    expect(Array.isArray(res.body.data.notifications)).toBe(true);
    expect(res.body.data).toHaveProperty('unreadCount');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/users/me/game-notifications').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/users/me/game-notifications/read-all ─────────────────────────

describe('PATCH /api/users/me/game-notifications/read-all', () => {
  it('returns 200 and marks notifications as read', async () => {
    // Seed a real Notification row (not JSONB) so the handler has something to mark
    const seeded = await prisma.notification.create({
      data: { userId: user.id, type: 'stat_gain', payload: { message: 'test' }, isRead: false },
    });

    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .patch('/api/users/me/game-notifications/read-all')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify the row was actually marked read in the DB
    const updated = await prisma.notification.findUnique({ where: { id: seeded.id } });
    expect(updated.isRead).toBe(true);

    await prisma.notification.delete({ where: { id: seeded.id } }).catch(() => {});
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .patch('/api/users/me/game-notifications/read-all')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/users/:id ───────────────────────────────────────────────────────

describe('GET /api/users/:id', () => {
  it('returns 200 with user data for self', async () => {
    const res = await request(app)
      .get(`/api/users/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data).toHaveProperty('currentHorses');
    expect(res.body.data).toHaveProperty('stableLimit');
  });

  it('returns 403 when accessing another user', async () => {
    const other = await prisma.user.create({
      data: {
        email: `uc-other-${Date.now()}@test.com`,
        username: `ucother${Date.now()}`,
        password: 'hash',
        firstName: 'Other',
        lastName: 'User',
        money: 0,
      },
    });

    try {
      const res = await request(app)
        .get(`/api/users/${other.id}`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    } finally {
      await prisma.user.delete({ where: { id: other.id } }).catch(() => {});
    }
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/users/${user.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/users/:id/progress ─────────────────────────────────────────────

describe('GET /api/users/:id/progress', () => {
  it('returns 200 with progress data for self', async () => {
    const res = await request(app)
      .get(`/api/users/${user.id}/progress`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('userId');
    expect(res.body.data).toHaveProperty('level');
    expect(res.body.data).toHaveProperty('xp');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/users/${user.id}/progress`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/users/:userId/competition-stats ─────────────────────────────────

describe('GET /api/users/:userId/competition-stats', () => {
  it('returns 200 with zero stats for a user with no competition history', async () => {
    const res = await request(app)
      .get(`/api/users/${user.id}/competition-stats`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId');
    expect(res.body.totalCompetitions).toBe(0);
    expect(res.body.totalWins).toBe(0);
  });

  it('returns 400 for non-UUID userId', async () => {
    const res = await request(app)
      .get('/api/users/notauuid/competition-stats')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/users/${user.id}/competition-stats`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
