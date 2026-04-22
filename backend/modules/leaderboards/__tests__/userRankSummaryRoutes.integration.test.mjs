/**
 * userRankSummaryRoutes.integration.test.mjs
 *
 * ATDD RED PHASE — Story 21S-1: Implement GET /api/leaderboards/user-summary/:userId
 *
 * Real-DB integration test for the missing user-rank-summary endpoint that
 * `/leaderboards` is classified `beta-live` against but does not exist in
 * the backend today.
 *
 * Coverage:
 *   - unauthenticated → 401
 *   - ghost userId (no user, no horses, no xp) → 200 with empty arrays
 *   - real user with no horses/xp → 200 with 4 rankings, 0 bestRankings
 *   - real user with level/xp/horses → 200 with rankings populated and
 *     bestRankings for any category where rank ≤ 100
 *
 * NO MOCKS — real backend, real Prisma, real auth.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
describe('INTEGRATION: GET /api/leaderboards/user-summary/:userId (21S-1)', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  let activeUser;
  let activeToken;
  let emptyUser;
  let emptyToken;
  let seededShowId;
  let seededCompetitionResultId;
  const createdHorseIds = [];

  beforeAll(async () => {
    const ts = Date.now();

    // User with level, XP, and a horse carrying earnings + competition-result score
    const active = await createTestUser({
      username: `rank_active_${ts}`,
      email: `rank_active_${ts}@test.com`,
      level: 12,
      xp: 450,
    });
    activeUser = active.user;
    activeToken = active.token;

    // Seed an XP event for the active user so xp leaderboard has data
    await prisma.xpEvent.create({
      data: {
        userId: activeUser.id,
        amount: 750,
        reason: 'integration-test-seed',
        timestamp: new Date(),
      },
    });

    // Seed a horse with earnings owned by the active user
    const horse = await createTestHorse({
      name: `RankActiveHorse_${ts}`,
      userId: activeUser.id,
      totalEarnings: 50000,
    });
    createdHorseIds.push(horse.id);

    // Seed a Show + CompetitionResult so horse-performance has data
    const show = await prisma.show.create({
      data: {
        name: `RankSummaryShow_${ts}`,
        discipline: 'Racing',
        levelMin: 1,
        levelMax: 20,
        entryFee: 100,
        prize: 1000,
        runDate: new Date(Date.now() - 86400000), // yesterday
      },
    });
    seededShowId = show.id;

    const result = await prisma.competitionResult.create({
      data: {
        score: 87.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date(Date.now() - 86400000),
        showName: show.name,
        horseId: horse.id,
        showId: show.id,
      },
    });
    seededCompetitionResultId = result.id;

    // User with no horses, no xp events — should still appear in level ranking
    // but have 0 for horse-earnings/horse-performance primary stats.
    const empty = await createTestUser({
      username: `rank_empty_${ts}`,
      email: `rank_empty_${ts}@test.com`,
      level: 1,
      xp: 0,
    });
    emptyUser = empty.user;
    emptyToken = empty.token;
  });

  afterAll(async () => {
    try {
      if (seededCompetitionResultId) {
        await prisma.competitionResult.delete({ where: { id: seededCompetitionResultId } }).catch(() => {});
      }
      if (seededShowId) {
        await prisma.show.delete({ where: { id: seededShowId } }).catch(() => {});
      }
      if (createdHorseIds.length) {
        await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
      }
      await prisma.xpEvent.deleteMany({
        where: { userId: { in: [activeUser?.id, emptyUser?.id].filter(Boolean) } },
      });
      // CodeRabbit (2026-04-20): cleanupTestData() only removes users whose
      // username starts with testuser_. Scope-delete this suite's seeded
      // rank_active_/rank_empty_ users explicitly to prevent leaks.
      const seededUserIds = [activeUser?.id, emptyUser?.id].filter(Boolean);
      if (seededUserIds.length) {
        await prisma.user.deleteMany({ where: { id: { in: seededUserIds } } });
      }
    } catch {
      /* ignore cleanup errors */
    }
    await cleanupTestData();
  });

  describe('Auth guard', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .get(`/api/leaderboards/user-summary/${activeUser.id}`)
        .set('Origin', 'http://localhost:3000');
      expect(res.status).toBe(401);
    });
  });

  describe('Ghost user', () => {
    it('returns 200 with empty arrays when the requested userId does not exist', async () => {
      const ghostId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/leaderboards/user-summary/${ghostId}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${activeToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        userId: ghostId,
        userName: expect.any(String),
        rankings: [],
        bestRankings: [],
      });
    });
  });

  describe('Real user — empty profile', () => {
    it('returns 200 with 4 category rankings and no bestRankings for a fresh account', async () => {
      const res = await request(app)
        .get(`/api/leaderboards/user-summary/${emptyUser.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${emptyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(emptyUser.id);
      expect(res.body.userName).toMatch(/Test User/);

      // Exactly 4 categories
      expect(Array.isArray(res.body.rankings)).toBe(true);
      expect(res.body.rankings).toHaveLength(4);

      const categories = res.body.rankings.map(r => r.category).sort();
      expect(categories).toEqual(['horse-earnings', 'horse-performance', 'level', 'xp']);

      // Shape check on one entry
      const levelRanking = res.body.rankings.find(r => r.category === 'level');
      expect(levelRanking).toMatchObject({
        category: 'level',
        categoryLabel: expect.any(String),
        rank: expect.any(Number),
        totalEntries: expect.any(Number),
        rankChange: 0,
        primaryStat: 1,
        statLabel: expect.any(String),
      });

      // Empty user has no earnings / no performance horses → primaryStat 0
      expect(res.body.rankings.find(r => r.category === 'horse-earnings').primaryStat).toBe(0);
      expect(res.body.rankings.find(r => r.category === 'horse-performance').primaryStat).toBe(0);

      // Regression (code review P1 BUG-1): a user with zero horses must never
      // render "#N of M<N". totalEntries must always be >= rank.
      for (const ranking of res.body.rankings) {
        expect(ranking.totalEntries).toBeGreaterThanOrEqual(ranking.rank);
      }
    });
  });

  describe('Real user — populated profile', () => {
    it('returns ranked data and bestRankings for categories where rank ≤ 100', async () => {
      const res = await request(app)
        .get(`/api/leaderboards/user-summary/${activeUser.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${activeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(activeUser.id);

      const byCategory = Object.fromEntries(res.body.rankings.map(r => [r.category, r]));

      // Level — active user is level 12
      expect(byCategory.level.primaryStat).toBe(12);
      expect(byCategory.level.rank).toBeGreaterThanOrEqual(1);

      // XP — seeded 750
      expect(byCategory.xp.primaryStat).toBeGreaterThanOrEqual(750);

      // Horse-earnings — active user has a horse with $50,000
      expect(byCategory['horse-earnings'].primaryStat).toBe(50000);

      // Horse-performance — active user's best horse scored 87.5 in a CompetitionResult
      expect(Number(byCategory['horse-performance'].primaryStat)).toBeCloseTo(87.5, 1);

      // At least one bestRanking should exist (test DB is small; user will be top 100)
      expect(Array.isArray(res.body.bestRankings)).toBe(true);
      expect(res.body.bestRankings.length).toBeGreaterThan(0);

      for (const best of res.body.bestRankings) {
        expect(['Top 10', 'Top 100']).toContain(best.achievement);
        expect(best.rank).toBeLessThanOrEqual(100);
      }
    });
  });
});
