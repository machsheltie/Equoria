/**
 * competitionStatsRoutes.integration.test.mjs
 *
 * ATDD RED PHASE — Story 21S-4: GET /api/v1/users/:userId/competition-stats
 *
 * Closes the missing endpoint that `/my-stable` depends on for real
 * stable-level competition totals. Frontend hook `useUserCompetitionStats`
 * expects the response shape declared in
 * `frontend/src/lib/api/competitionResults.ts` (UserCompetitionStats).
 *
 * Real-DB integration test — no mocks.
 *
 * Equoria-462kg (sibling of Equoria-hrzwh): this suite formerly created the
 * active + empty users (and the active user's seeded horse / shows / results)
 * ONCE in beforeAll and READ them across four `it` blocks (auth-guard 401,
 * IDOR 403, empty-user zeroed-stats, active-user aggregation). Every reserved
 * test-email pattern is inside the broad-cleanup blast radius, so a concurrent
 * broad delete firing mid-suite could strand the later `it` blocks (their
 * users vanished after the earlier ones passed). The robust fix is structural:
 * each test creates and owns its OWN users + fixtures via a beforeEach helper,
 * tracked for id-scoped cleanup in afterEach, so no test depends on a user
 * surviving across `it` boundaries. Every original assertion is preserved
 * verbatim.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse } from '../../../tests/helpers/testAuth.mjs';

import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
describe('INTEGRATION: GET /api/v1/users/:userId/competition-stats (21S-4)', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  // Equoria-462kg: per-test fixtures, tracked for id-scoped cleanup in
  // afterEach. No user/horse/show/result outlives the test that made it.
  let activeUser;
  let activeToken;
  let emptyUser;
  let emptyToken;
  let horseId;
  let createdUserIds;
  let createdShowIds;
  let createdResultIds;

  beforeEach(async () => {
    createdUserIds = [];
    createdShowIds = [];
    createdResultIds = [];
    const ts = `${Date.now()}_${process.pid}`;

    // Active user — has horses + competition results
    const active = await createTestUser({
      username: `stats_active_${ts}`,
      email: `stats_active_${ts}@test.com`,
    });
    activeUser = active.user;
    activeToken = active.token;
    createdUserIds.push(activeUser.id);

    // Empty user — account only, no horses
    const empty = await createTestUser({
      username: `stats_empty_${ts}`,
      email: `stats_empty_${ts}@test.com`,
    });
    emptyUser = empty.user;
    emptyToken = empty.token;
    createdUserIds.push(emptyUser.id);

    // Seed a horse for the active user
    const horse = await createTestHorse({
      name: `StatsActiveHorse_${ts}`,
      userId: activeUser.id,
    });
    horseId = horse.id;

    // Seed 3 competition results across 2 disciplines with different
    // placements. Migration 20260521120000 added UNIQUE(showId, horseId) on
    // competition_results — the same horse may not have two results in one
    // show, so each result gets its own dedicated show. (Stats aggregate on
    // result.discipline, not the show's discipline, so the spread is inert
    // to the assertions.)
    const shows = await Promise.all(
      [1, 2, 3].map(i =>
        prisma.show.create({
          data: {
            name: `StatsShow${i}_${ts}`,
            discipline: 'Racing',
            levelMin: 1,
            levelMax: 20,
            entryFee: 100,
            prize: 1000,
            runDate: new Date(Date.now() - 86400000),
          },
        }),
      ),
    );
    shows.forEach(s => createdShowIds.push(s.id));

    const result1 = await prisma.competitionResult.create({
      data: {
        score: 95.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: new Date(Date.now() - 86400000),
        showName: shows[0].name,
        horseId: horse.id,
        showId: shows[0].id,
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
        showName: shows[1].name,
        horseId: horse.id,
        showId: shows[1].id,
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
        showName: shows[2].name,
        horseId: horse.id,
        showId: shows[2].id,
        prizeWon: 0,
      },
    });
    createdResultIds.push(result3.id);
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  afterEach(async () => {
    try {
      // Delete results before horse (FK order).
      if (createdResultIds.length) {
        await prisma.competitionResult.deleteMany({ where: { id: { in: createdResultIds } } });
      }
      if (horseId) {
        await prisma.horse.deleteMany({ where: { id: horseId } });
      }
      if (createdShowIds.length) {
        await prisma.show.deleteMany({ where: { id: { in: createdShowIds } } });
      }
      // id-scoped user deletion of exactly the users this test created.
      if (createdUserIds.length) {
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
    } catch (err) {
      console.error('[competition-stats cleanup] afterEach error — fixture may have leaked:', err.message);
    }
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  describe('Auth guard', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${activeUser.id}/competition-stats`)
        .set('Origin', 'http://localhost:3000');
      expect(res.status).toBe(401);
    });

    // CodeRabbit (2026-04-20): IDOR coverage — an authenticated user must
    // not be able to read another user's aggregated competition stats.
    it("returns 403 when requesting another user's stats", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${activeUser.id}/competition-stats`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${emptyToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Empty user (no horses, no results)', () => {
    it('returns 200 with zeroed stats and empty recent list', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${emptyUser.id}/competition-stats`)
        .set('Origin', 'http://localhost:3000')
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
        .get(`/api/v1/users/${activeUser.id}/competition-stats`)
        .set('Origin', 'http://localhost:3000')
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
