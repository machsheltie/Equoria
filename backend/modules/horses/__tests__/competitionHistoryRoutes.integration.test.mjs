/**
 * competitionHistoryRoutes.integration.test.mjs
 *
 * ATDD RED PHASE — Story 21S-4: GET /api/horses/:horseId/competition-history
 *
 * Closes the missing per-horse history endpoint that `/my-stable` Hall of
 * Fame depends on. Frontend hook `useHorseCompetitionHistory` expects the
 * response shape declared in `frontend/src/lib/api/competitionResults.ts`
 * (CompetitionHistoryData).
 *
 * Real-DB integration test — no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

describe('INTEGRATION: GET /api/horses/:horseId/competition-history (21S-4)', () => {
  let owner;
  let ownerToken;
  let horseWithResults;
  let horseWithoutResults;
  const createdShowIds = [];
  const createdResultIds = [];

  beforeAll(async () => {
    const ts = Date.now();

    const ownerData = await createTestUser({
      username: `hist_owner_${ts}`,
      email: `hist_owner_${ts}@test.com`,
    });
    owner = ownerData.user;
    ownerToken = ownerData.token;

    // Horse with 2 competition results
    horseWithResults = await createTestHorse({
      name: `HistHorse_${ts}`,
      userId: owner.id,
    });

    // Horse with no results
    horseWithoutResults = await createTestHorse({
      name: `HistEmpty_${ts}`,
      userId: owner.id,
    });

    const show = await prisma.show.create({
      data: {
        name: `HistShow_${ts}`,
        discipline: 'Racing',
        levelMin: 1,
        levelMax: 20,
        entryFee: 100,
        prize: 1000,
        runDate: new Date(Date.now() - 86400000),
      },
    });
    createdShowIds.push(show.id);

    const r1 = await prisma.competitionResult.create({
      data: {
        score: 90,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date(Date.now() - 86400000),
        showName: show.name,
        horseId: horseWithResults.id,
        showId: show.id,
        prizeWon: 500,
      },
    });
    createdResultIds.push(r1.id);

    const r2 = await prisma.competitionResult.create({
      data: {
        score: 70,
        placement: '2nd',
        discipline: 'Racing',
        runDate: new Date(Date.now() - 2 * 86400000),
        showName: show.name,
        horseId: horseWithResults.id,
        showId: show.id,
        prizeWon: 200,
      },
    });
    createdResultIds.push(r2.id);
  });

  afterAll(async () => {
    try {
      if (createdResultIds.length) {
        await prisma.competitionResult.deleteMany({ where: { id: { in: createdResultIds } } });
      }
      if (horseWithResults?.id || horseWithoutResults?.id) {
        await prisma.horse.deleteMany({
          where: { id: { in: [horseWithResults?.id, horseWithoutResults?.id].filter(Boolean) } },
        });
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
      const res = await request(app).get(`/api/horses/${horseWithResults.id}/competition-history`);
      expect(res.status).toBe(401);
    });
  });

  describe('Horse with no results', () => {
    it('returns 200 with zeroed statistics and empty competitions array', async () => {
      const res = await request(app)
        .get(`/api/horses/${horseWithoutResults.id}/competition-history`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        horseId: horseWithoutResults.id,
        horseName: horseWithoutResults.name,
      });
      expect(res.body.statistics).toMatchObject({
        totalCompetitions: 0,
        wins: 0,
        top3Finishes: 0,
        winRate: 0,
        totalPrizeMoney: 0,
      });
      expect(Array.isArray(res.body.competitions)).toBe(true);
      expect(res.body.competitions.length).toBe(0);
    });
  });

  describe('Horse with 2 results', () => {
    it('returns 200 with aggregated statistics and competitions list', async () => {
      const res = await request(app)
        .get(`/api/horses/${horseWithResults.id}/competition-history`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.horseId).toBe(horseWithResults.id);
      expect(res.body.horseName).toBe(horseWithResults.name);

      expect(res.body.statistics.totalCompetitions).toBe(2);
      expect(res.body.statistics.wins).toBe(1);
      expect(res.body.statistics.top3Finishes).toBe(2);
      expect(res.body.statistics.winRate).toBeCloseTo(50, 1);
      expect(Number(res.body.statistics.totalPrizeMoney)).toBeCloseTo(700, 1);
      expect(res.body.statistics.bestPlacement).toBe(1);

      expect(Array.isArray(res.body.competitions)).toBe(true);
      expect(res.body.competitions.length).toBe(2);

      // Each competition entry shape
      const sample = res.body.competitions[0];
      expect(sample).toMatchObject({
        competitionId: expect.any(Number),
        competitionName: expect.any(String),
        discipline: expect.any(String),
        placement: expect.any(Number),
        finalScore: expect.any(Number),
        prizeMoney: expect.any(Number),
      });
    });
  });
});
