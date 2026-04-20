/**
 * competitionStatsRoutes.integration.test.mjs
 *
 * ATDD RED PHASE — Story 21S-4: GET /api/users/:userId/competition-stats
 *
 * Closes the missing endpoint that `/my-stable` depends on for real
 * stable-level competition totals. Frontend hook `useUserCompetitionStats`
 * expects the response shape declared in
 * `frontend/src/lib/api/competitionResults.ts` (UserCompetitionStats).
 *
 * Real-DB integration test — no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

describe('INTEGRATION: GET /api/users/:userId/competition-stats (21S-4)', () => {
  let activeUser;
  let activeToken;
  let emptyUser;
  let emptyToken;
  let horseId;
  const createdShowIds = [];
  const createdResultIds = [];

  beforeAll(async () => {
    const ts = Date.now();

    // Active user — has horses + competition results
    const active = await createTestUser({
      username: `stats_active_${ts}`,
      email: `stats_active_${ts}@test.com`,
    });
    activeUser = active.user;
    activeToken = active.token;

    // Empty user — account only, no horses
    const empty = await createTestUser({
      username: `stats_empty_${ts}`,
      email: `stats_empty_${ts}@test.com`,
    });
    emptyUser = empty.user;
    emptyToken = empty.token;

    // Seed a horse for the active user
    const horse = await createTestHorse({
      name: `StatsActiveHorse_${ts}`,
      userId: activeUser.id,
    });
    horseId = horse.id;

    // Seed 3 competition results across 2 disciplines with different placements
    const show = await prisma.show.create({
      data: {
        name: `StatsShow_${ts}`,
        discipline: 'Racing',
        levelMin: 1,
        levelMax: 20,
        entryFee: 100,
        prize: 1000,
        runDate: new Date(Date.now() - 86400000),
      },
    });
    createdShowIds.push(show.id);

    const result1 = await prisma.competitionResult.create({
      data: {
        score: 95.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date(Date.now() - 86400000),
        showName: show.name,
        horseId: horse.id,
        showId: show.id,
        prizeWon: 500,
      },
    });
    createdResultIds.push(result1.id);

    const result2 = await prisma.competitionResult.create({
      data: {
        score: 82,
        placement: '3rd',
        discipline: 'Racing',
        runDate: new Date(Date.now() - 2 * 86400000),
        showName: show.name,
        horseId: horse.id,
        showId: show.id,
        prizeWon: 100,
      },
    });
    createdResultIds.push(result2.id);

    const result3 = await prisma.competitionResult.create({
      data: {
        score: 60,
        placement: '5th',
        discipline: 'Dressage',
        runDate: new Date(Date.now() - 3 * 86400000),
        showName: show.name,
        horseId: horse.id,
        showId: show.id,
        prizeWon: 0,
      },
    });
    createdResultIds.push(result3.id);
  });

  afterAll(async () => {
    try {
      if (createdResultIds.length) {
        await prisma.competitionResult.deleteMany({ where: { id: { in: createdResultIds } } });
      }
      if (horseId) {
        await prisma.horse.deleteMany({ where: { id: horseId } });
      }
      if (createdShowIds.length) {
        await prisma.show.deleteMany({ where: { id: { in: createdShowIds } } });
      }
    } catch {
      /* ignore cleanup errors */
    }
    await cleanupTestData();
  });

  describe('Auth guard', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get(`/api/users/${activeUser.id}/competition-stats`);
      expect(res.status).toBe(401);
    });
  });

  describe('Empty user (no horses, no results)', () => {
    it('returns 200 with zeroed stats and empty recent list', async () => {
      const res = await request(app)
        .get(`/api/users/${emptyUser.id}/competition-stats`)
        .set('Authorization', `Bearer ${emptyToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        userId: emptyUser.id,
        totalCompetitions: 0,
        totalWins: 0,
        totalTop3: 0,
        winRate: 0,
        totalPrizeMoney: 0,
      });
      expect(Array.isArray(res.body.recentCompetitions)).toBe(true);
      expect(res.body.recentCompetitions.length).toBe(0);
    });
  });

  describe('Active user with 3 results across 2 disciplines', () => {
    it('returns 200 with aggregated totals and most-successful discipline', async () => {
      const res = await request(app)
        .get(`/api/users/${activeUser.id}/competition-stats`)
        .set('Authorization', `Bearer ${activeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(activeUser.id);
      expect(res.body.totalCompetitions).toBe(3);
      expect(res.body.totalWins).toBe(1);
      expect(res.body.totalTop3).toBe(2); // 1st + 3rd
      expect(res.body.winRate).toBeCloseTo(33.33, 1); // 1 of 3
      expect(Number(res.body.totalPrizeMoney)).toBeCloseTo(600, 1);

      // bestPlacement is numeric 1 (1st)
      expect(res.body.bestPlacement).toBe(1);

      // Racing had 2 entries, Dressage 1 — Racing wins
      expect(res.body.mostSuccessfulDiscipline).toBe('Racing');

      // recentCompetitions ordered most-recent first, capped at 5
      expect(Array.isArray(res.body.recentCompetitions)).toBe(true);
      expect(res.body.recentCompetitions.length).toBeGreaterThanOrEqual(1);
      expect(res.body.recentCompetitions.length).toBeLessThanOrEqual(5);
    });
  });
});
