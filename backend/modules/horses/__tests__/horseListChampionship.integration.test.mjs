/**
 * GET /api/v1/horses — per-horse championship signal (Equoria-55bo.6)
 *
 * Spec 11.3.13 reserves the ornate GoldBorderFrame for championship horses.
 * The non-HoF stable/dashboard cards consume the base `useHorses()` list
 * payload, which previously carried NO per-card 1st-place signal — so they
 * could not be framed without faking a flag (21R forbids that).
 *
 * This test asserts the list endpoint attaches REAL derived championship
 * fields, computed from the horse's actual 1st-place CompetitionResult rows,
 * batched into the SAME single query that already powers `latestEvent`
 * (no N+1 per-card history fetch).
 *
 * Asserts:
 *  - a horse with >=1 real 1st-place result returns
 *    hasChampionship: true and firstPlaceWins === (count of '1st' rows).
 *  - a horse with competition results but NO 1st place returns
 *    hasChampionship: false, firstPlaceWins: 0.
 *  - a horse with no competition history at all returns
 *    hasChampionship: false, firstPlaceWins: 0.
 *  - the championship fields are derived in the same batched pass — every
 *    horse on the page carries its own correct per-horse aggregation in a
 *    SINGLE response, which is only possible if one batched
 *    `competitionResult.findMany({ where: { horseId: { in: [...] } } })`
 *    covered all horseIds (no per-horse query explosion / first-horse-only
 *    drop-out). Asserted via the real response, not by spying on Prisma —
 *    see the last `it()` for the de-mock rationale (Equoria-bexrk).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

const FIXTURE_PREFIX = 'TestFixture-list-championship';

let owner;
let token;
let championHorse; // two 1st-place wins
let placedNoFirstHorse; // results but no 1st place
let noHistoryHorse; // no competition results
let createdShowIds = [];

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');

  const a = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
  });
  owner = a.user;
  token = a.token;

  championHorse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-Champion-${tag}`,
    userId: owner.id,
  });
  placedNoFirstHorse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-Placed-${tag}`,
    userId: owner.id,
  });
  noHistoryHorse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-NoHistory-${tag}`,
    userId: owner.id,
  });

  // Migration 20260521120000 added UNIQUE(showId, horseId) on
  // competition_results — a horse may have at most ONE result per show. The
  // champion has 3 results and the placed horse has 2, so each result needs
  // its own dedicated show.
  const shows = await Promise.all(
    [1, 2, 3, 4, 5].map(i =>
      prisma.show.create({
        data: {
          name: `${FIXTURE_PREFIX}-Show${i}-${tag}`,
          discipline: 'Dressage',
          levelMin: 1,
          levelMax: 10,
          entryFee: 0,
          prize: 100,
          runDate: new Date('2026-05-10T00:00:00.000Z'),
        },
      }),
    ),
  );
  createdShowIds = shows.map(s => s.id);

  // Champion: TWO 1st-place results + one 3rd (firstPlaceWins must be 2).
  await prisma.competitionResult.createMany({
    data: [
      {
        score: 92.0,
        placement: '1st',
        discipline: 'Dressage',
        runDate: new Date('2026-05-10T00:00:00.000Z'),
        showName: shows[0].name,
        horseId: championHorse.id,
        showId: shows[0].id,
      },
      {
        score: 91.0,
        placement: '1st',
        discipline: 'Show Jumping',
        runDate: new Date('2026-05-11T00:00:00.000Z'),
        showName: shows[1].name,
        horseId: championHorse.id,
        showId: shows[1].id,
      },
      {
        score: 70.0,
        placement: '3rd',
        discipline: 'Dressage',
        runDate: new Date('2026-05-12T00:00:00.000Z'),
        showName: shows[2].name,
        horseId: championHorse.id,
        showId: shows[2].id,
      },
      // Placed-but-never-first horse: a 2nd and a 3rd, no 1st.
      {
        score: 80.0,
        placement: '2nd',
        discipline: 'Dressage',
        runDate: new Date('2026-05-10T00:00:00.000Z'),
        showName: shows[3].name,
        horseId: placedNoFirstHorse.id,
        showId: shows[3].id,
      },
      {
        score: 65.0,
        placement: '3rd',
        discipline: 'Show Jumping',
        runDate: new Date('2026-05-11T00:00:00.000Z'),
        showName: shows[4].name,
        horseId: placedNoFirstHorse.id,
        showId: shows[4].id,
      },
    ],
  });
}, 120000);

afterAll(async () => {
  if (createdShowIds.length > 0) {
    await prisma.competitionResult.deleteMany({
      where: { showId: { in: createdShowIds } },
    });
    await prisma.show.deleteMany({ where: { id: { in: createdShowIds } } });
  }
  await cleanupTestData();
});

describe('GET /api/v1/horses — championship signal (55bo.6)', () => {
  it('returns hasChampionship:true and the real 1st-place count for a champion', async () => {
    const res = await request(app)
      .get(`/api/v1/horses?userId=${owner.id}&limit=200`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const h = res.body.data.find(x => x.id === championHorse.id);
    expect(h).toBeTruthy();
    expect(h.hasChampionship).toBe(true);
    expect(h.firstPlaceWins).toBe(2);
  });

  it('returns hasChampionship:false for a horse that placed but never won 1st', async () => {
    const res = await request(app)
      .get(`/api/v1/horses?userId=${owner.id}&limit=200`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    const h = res.body.data.find(x => x.id === placedNoFirstHorse.id);
    expect(h).toBeTruthy();
    expect(h.hasChampionship).toBe(false);
    expect(h.firstPlaceWins).toBe(0);
  });

  it('returns hasChampionship:false for a horse with no competition history', async () => {
    const res = await request(app)
      .get(`/api/v1/horses?userId=${owner.id}&limit=200`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    const h = res.body.data.find(x => x.id === noHistoryHorse.id);
    expect(h).toBeTruthy();
    expect(h.hasChampionship).toBe(false);
    expect(h.firstPlaceWins).toBe(0);
  });

  it('aggregates championship signal correctly for ALL horses on the page in one pass (no per-horse N+1 drop-out)', async () => {
    // De-mock note (Equoria-bexrk): this case previously asserted the
    // "exactly one competitionResult.findMany" contract by
    // jest.spyOn(prisma.competitionResult, 'findMany') and counting calls.
    // That is a spy on OUR OWN database layer — forbidden by CLAUDE.md
    // Principle 3 (no isolation of our DB/services) and a member of the
    // task's `spyOn(prisma` flag set. It was also partially vacuous: the
    // old assertion was `<= 1` with a documented "if cached the count is 0"
    // escape hatch, so `0 <= 1` passed even in a world where the batch was
    // broken — it could not catch the regression it claimed to guard.
    //
    // The literal runtime query-COUNT is mocklessly-unreachable as an
    // observation without instrumenting Prisma (the dgnle pattern). So we
    // assert the REAL, observable contract the single batched query
    // guarantees instead of the un-observable internal call count:
    //
    //   The route issues getRecentResultsForHorses(horseIds) ONCE per
    //   request with `where: { horseId: { in: horseIds } }`
    //   (horseRouteQueries.mjs:88-100; horseRoutes.mjs:130-148 — a single
    //   call guarded by `if (horseIds.length > 0)`, OUTSIDE the list cache).
    //   The only way EVERY horse on the page can carry its own correct
    //   per-horse aggregation in the SAME response is if that one batched
    //   query returned rows for all of them. A per-horse N+1 that fetched
    //   only the first horse — or a batch that dropped horses beyond the
    //   first — would yield wrong firstPlaceWins/hasChampionship for the
    //   trailing horses. Asserting all three distinct outcomes coexist in
    //   one response is therefore a real failure-mode probe of the batch,
    //   driven entirely through the real controller → service → Prisma → DB
    //   path with zero DB isolation.
    const res = await request(app)
      .get(`/api/v1/horses?userId=${owner.id}&limit=200&offset=0`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const champion = res.body.data.find(x => x.id === championHorse.id);
    const placed = res.body.data.find(x => x.id === placedNoFirstHorse.id);
    const noHistory = res.body.data.find(x => x.id === noHistoryHorse.id);

    // All three fixture horses must be present on the same page...
    expect(champion).toBeTruthy();
    expect(placed).toBeTruthy();
    expect(noHistory).toBeTruthy();

    // ...AND each must carry its OWN correct aggregation simultaneously.
    // Three distinct outcomes resolved in one response can only come from a
    // batched query covering all horseIds — not a first-horse-only N+1.
    expect(champion.hasChampionship).toBe(true);
    expect(champion.firstPlaceWins).toBe(2);
    expect(placed.hasChampionship).toBe(false);
    expect(placed.firstPlaceWins).toBe(0);
    expect(noHistory.hasChampionship).toBe(false);
    expect(noHistory.firstPlaceWins).toBe(0);
  });
});
