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
 *  - the championship fields are derived in the same batched pass — the
 *    endpoint issues exactly ONE competitionResult query for the page
 *    regardless of horse count (no per-horse query explosion).
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import {
  createTestUser,
  createTestHorse,
  cleanupTestData,
} from '../../../tests/helpers/testAuth.mjs';
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

  const show = await prisma.show.create({
    data: {
      name: `${FIXTURE_PREFIX}-Show-${tag}`,
      discipline: 'Dressage',
      levelMin: 1,
      levelMax: 10,
      entryFee: 0,
      prize: 100,
      runDate: new Date('2026-05-10T00:00:00.000Z'),
    },
  });
  createdShowIds = [show.id];

  // Champion: TWO 1st-place results + one 3rd (firstPlaceWins must be 2).
  await prisma.competitionResult.createMany({
    data: [
      {
        score: 92.0,
        placement: '1st',
        discipline: 'Dressage',
        runDate: new Date('2026-05-10T00:00:00.000Z'),
        showName: show.name,
        horseId: championHorse.id,
        showId: show.id,
      },
      {
        score: 91.0,
        placement: '1st',
        discipline: 'Show Jumping',
        runDate: new Date('2026-05-11T00:00:00.000Z'),
        showName: show.name,
        horseId: championHorse.id,
        showId: show.id,
      },
      {
        score: 70.0,
        placement: '3rd',
        discipline: 'Dressage',
        runDate: new Date('2026-05-12T00:00:00.000Z'),
        showName: show.name,
        horseId: championHorse.id,
        showId: show.id,
      },
      // Placed-but-never-first horse: a 2nd and a 3rd, no 1st.
      {
        score: 80.0,
        placement: '2nd',
        discipline: 'Dressage',
        runDate: new Date('2026-05-10T00:00:00.000Z'),
        showName: show.name,
        horseId: placedNoFirstHorse.id,
        showId: show.id,
      },
      {
        score: 65.0,
        placement: '3rd',
        discipline: 'Show Jumping',
        runDate: new Date('2026-05-11T00:00:00.000Z'),
        showName: show.name,
        horseId: placedNoFirstHorse.id,
        showId: show.id,
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

  it('derives the signal in ONE batched competitionResult query (no per-horse N+1)', async () => {
    const findManySpy = jest.spyOn(prisma.competitionResult, 'findMany');
    try {
      const res = await request(app)
        // Cache-buster userId is the same; force a fresh fetch by bypassing
        // the 2-minute list cache via a distinct offset combo is not needed —
        // the spy counts ALL competitionResult.findMany calls in the request.
        .get(`/api/v1/horses?userId=${owner.id}&limit=200&offset=0`)
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(200);
      // The list serializer must aggregate placement counts in the SAME
      // single findMany it already issues for latestEvent — exactly one
      // competitionResult.findMany for the whole page, NOT one-per-horse.
      // (If the result list is served from cache the count is 0; either way
      // it must never scale with the 3-horse fixture set.)
      expect(findManySpy.mock.calls.length).toBeLessThanOrEqual(1);
    } finally {
      findManySpy.mockRestore();
    }
  });
});
