/**
 * leaderboardController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getLeaderboardStats, getTopPlayersByLevel, getTopHorsesByEarnings,
 * getRecentWinners, getUserRankSummary.
 * All leaderboard routes require auth (authRouter).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';

const ORIGIN = 'http://localhost:3000';

// One shared user is enough — all these are read-only GETs
let user;
let token;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `lb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `lb${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'LB',
      lastName: 'Tester',
      money: 0,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
}, 30000);

afterAll(async () => {
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/leaderboards/stats ─────────────────────────────────────────────

describe('GET /api/leaderboards/stats', () => {
  it('returns 200 with leaderboard stats', async () => {
    const res = await request(app)
      .get('/api/leaderboards/stats')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('userCount');
    expect(res.body.data).toHaveProperty('horseCount');
    expect(res.body.data).toHaveProperty('showCount');
    expect(res.body.data).toHaveProperty('totalEarnings');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/leaderboards/stats').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/leaderboards/players/level ─────────────────────────────────────

describe('GET /api/leaderboards/players/level', () => {
  it('returns 200 with top players by level', async () => {
    const res = await request(app)
      .get('/api/leaderboards/players/level')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.users)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/leaderboards/players/level').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/leaderboards/horses/earnings ────────────────────────────────────

describe('GET /api/leaderboards/horses/earnings', () => {
  it('returns 200 with top horses by earnings', async () => {
    const res = await request(app)
      .get('/api/leaderboards/horses/earnings')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.horses)).toBe(true);
  });
});

// ─── GET /api/leaderboards/recent-winners ────────────────────────────────────

describe('GET /api/leaderboards/recent-winners', () => {
  it('returns 200 with recent winners', async () => {
    const res = await request(app)
      .get('/api/leaderboards/recent-winners')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.winners)).toBe(true);
  });
});

// ─── GET /api/leaderboards/user-summary/:userId ───────────────────────────────

describe('GET /api/leaderboards/user-summary/:userId', () => {
  it('returns 200 with rank summary for the authenticated user', async () => {
    const res = await request(app)
      .get(`/api/leaderboards/user-summary/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId');
  });

  it('returns 200 with empty rankings for a non-existent userId', async () => {
    const res = await request(app)
      .get('/api/leaderboards/user-summary/00000000-0000-0000-0000-000000000000')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userName).toBe('Unknown');
    expect(Array.isArray(res.body.rankings)).toBe(true);
  });
});
