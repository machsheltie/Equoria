/**
 * leaderboardController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getLeaderboardStats, getTopPlayersByLevel, getTopHorsesByEarnings,
 * getRecentWinners, getUserRankSummary, getTopHorsesByPerformance (win-rate).
 * All leaderboard routes require auth (authRouter).
 *
 * Equoria-847r: getTopHorsesByPerformance must use MAX(CompetitionResult.score)
 * not the non-existent performanceScore column.
 *
 * Equoria-ombe: getUserRankSummary must return 400 for non-UUID userId.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { invalidateCachePattern } from '../../../utils/cacheHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `lb-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `lb${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
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

describe('GET /api/leaderboards/win-rate (Equoria-847r)', () => {
  it('returns 200 with rankings array (empty-results case)', async () => {
    const res = await request(app)
      .get('/api/leaderboards/win-rate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('rankings');
    expect(Array.isArray(res.body.data.rankings)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/leaderboards/win-rate').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });

  it('returns 200 with populated rankings including maxScore when results exist', async () => {
    // Bust any stale leaderboard cache from earlier tests (in-memory cache persists
    // across tests within the same Jest worker; without this a cached empty-rankings
    // result from the first win-rate test can mask newly created competition data).
    await invalidateCachePattern('leaderboard:*');

    const show = await prisma.show.create({
      data: {
        name: `TestFixture-WinRateShow-${Date.now()}`,
        discipline: 'Racing',
        levelMin: 1,
        levelMax: 10,
        entryFee: 0,
        prize: 100,
        runDate: new Date('2024-01-15'),
        status: 'open',
      },
    });

    const breed = await prisma.breed.findFirst();
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-WinRateHorse-${Date.now()}`,
        userId: user.id,
        breedId: breed ? breed.id : null,
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 4,
      },
    });

    await prisma.competitionResult.create({
      data: {
        horseId: horse.id,
        showId: show.id,
        showName: show.name,
        discipline: 'Racing',
        placement: '1',
        score: 87.5,
        runDate: new Date('2024-01-15'),
      },
    });

    try {
      const res = await request(app)
        .get('/api/leaderboards/win-rate')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.rankings)).toBe(true);
      expect(res.body.data.rankings.length).toBeGreaterThanOrEqual(1);
      for (const entry of res.body.data.rankings) {
        expect(entry).toHaveProperty('maxScore');
        expect(entry).toHaveProperty('horseId');
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('rank');
        expect(typeof entry.maxScore).toBe('number');
      }
    } finally {
      await prisma.competitionResult.deleteMany({ where: { horseId: horse.id } });
      await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
      await prisma.show.delete({ where: { id: show.id } }).catch(() => {});
    }
  });
});

describe('GET /api/leaderboards/user-summary/:userId (Equoria-ombe)', () => {
  it('returns 200 with rank summary for the authenticated user', async () => {
    const res = await request(app)
      .get(`/api/leaderboards/user-summary/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId');
  });

  it('returns 200 with empty rankings for a non-existent valid-UUID userId', async () => {
    const res = await request(app)
      .get('/api/leaderboards/user-summary/00000000-0000-0000-0000-000000000000')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userName).toBe('Unknown');
    expect(Array.isArray(res.body.rankings)).toBe(true);
  });

  it('returns 400 for a malformed non-UUID userId (Equoria-ombe)', async () => {
    const res = await request(app)
      .get('/api/leaderboards/user-summary/not-a-uuid')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid userId format');
  });

  it('returns 400 for a numeric userId', async () => {
    const res = await request(app)
      .get('/api/leaderboards/user-summary/12345')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid userId format');
  });
});
