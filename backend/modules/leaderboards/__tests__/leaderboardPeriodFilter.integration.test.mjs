/**
 * GET /api/v1/leaderboards/competition — the `period` filter on every metric
 * branch (Equoria-zhvt4).
 *
 * leaderboardRoutes builds one `runDate: { gte }` filter from `period` and hands
 * it to the wins, earnings, placements and average-placement queries, which turn
 * it into SQL. Equoria-6lobd passed that filter as a bare string in one review
 * pass; this suite proves against the real database that a result dated outside
 * the period is left out of EVERY branch, not just the one 6lobd touched.
 *
 * Fixture: horse R has three results (1st) dated now, 20 days ago and 400 days
 * ago, worth 1 / 10 / 100. Horse O has only the 400-days-ago result. Assertions
 * locate fixture rows by horseId and never assume the fixtures dominate the board.
 *
 * NO MOCKS: real backend, real Prisma, real auth, real DB; id-scoped cleanup.
 */

import { randomBytes } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse } from '../../../tests/helpers/testAuth.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('INTEGRATION: competition leaderboard period filter (Equoria-zhvt4)', () => {
  const suffix = randomBytes(6).toString('hex');
  const DISCIPLINE = 'Dressage';

  let token;
  let userId;
  let horseR;
  let horseO;
  const horseIds = [];
  const showIds = [];

  async function createShow(label, runDate) {
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-zhvt4-${label}-${suffix}`,
        discipline: DISCIPLINE,
        runDate,
        prize: 1000,
        entryFee: 100,
        levelMin: 1,
        levelMax: 10,
      },
    });
    showIds.push(show.id);
    return show;
  }

  async function createResult(horseId, show, { placement, prizeWon, runDate }) {
    await prisma.competitionResult.create({
      data: {
        horseId,
        showId: show.id,
        showName: show.name,
        discipline: DISCIPLINE,
        placement,
        prizeWon,
        score: 80.0,
        runDate,
      },
    });
  }

  async function board(metric, period) {
    const res = await request(app)
      .get('/api/v1/leaderboards/competition')
      .query({ metric, period, discipline: DISCIPLINE, limit: 100 })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body.data.leaderboard;
  }

  beforeAll(async () => {
    const u = await createTestUser({
      username: `TFzhvt4_${suffix}`,
      email: `tfzhvt4_${suffix}@test.com`,
    });
    token = u.token;
    userId = u.user.id;

    horseR = await createTestHorse({ name: `TestFixture-zhvt4-R-${suffix}`, userId });
    horseO = await createTestHorse({ name: `TestFixture-zhvt4-O-${suffix}`, userId });
    horseIds.push(horseR.id, horseO.id);

    const now = new Date();
    const mid = new Date(now.getTime() - 20 * DAY_MS);
    const old = new Date(now.getTime() - 400 * DAY_MS);
    const showNow = await createShow('now', now);
    const showMid = await createShow('mid', mid);
    const showOld = await createShow('old', old);

    // R places 1, 2, 3 (average 2.0 over three) so every result is a top-3 and
    // only the first is a win; prizes 1 / 10 / 100.
    await createResult(horseR.id, showNow, { placement: 1, prizeWon: 1, runDate: now });
    await createResult(horseR.id, showMid, { placement: 2, prizeWon: 10, runDate: mid });
    await createResult(horseR.id, showOld, { placement: 3, prizeWon: 100, runDate: old });
    // O has only the old result.
    await createResult(horseO.id, showOld, { placement: 1, prizeWon: 1000, runDate: old });
  }, 120000);

  afterAll(async () => {
    if (horseIds.length > 0) {
      await prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } });
    }
    if (showIds.length > 0) {
      await prisma.show.deleteMany({ where: { id: { in: showIds } } });
    }
    if (horseIds.length > 0) {
      await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  }, 120000);

  it('wins: week keeps only the recent win; a horse whose only win is old is absent', async () => {
    const week = await board('wins', 'week');
    expect(week.find(r => r.horseId === horseR.id)?.wins).toBe(1);
    expect(week.find(r => r.horseId === horseO.id)).toBeUndefined();

    const all = await board('wins', 'all');
    expect(all.find(r => r.horseId === horseO.id)?.wins).toBe(1);
    expect(all.find(r => r.horseId === horseR.id)?.wins).toBe(1);
  }, 60000);

  it('earnings: week / month / year / all sum only the results inside the period', async () => {
    const sum = async period => (await board('earnings', period)).find(r => r.horseId === horseR.id)?.totalEarnings;
    expect(await sum('week')).toBe(1);
    expect(await sum('month')).toBe(11);
    expect(await sum('year')).toBe(11);
    expect(await sum('all')).toBe(111);
  }, 60000);

  it('placements: top-3 counts follow the period', async () => {
    const count = async period => (await board('placements', period)).find(r => r.horseId === horseR.id)?.topPlacements;
    expect(await count('week')).toBe(1);
    expect(await count('month')).toBe(2);
    expect(await count('year')).toBe(2);
    expect(await count('all')).toBe(3);
  }, 60000);

  it('average_placement: the three-result minimum is judged inside the period', async () => {
    const all = (await board('average_placement', 'all')).find(r => r.horseId === horseR.id);
    expect(all?.competitionCount).toBe(3);
    expect(all?.averagePlacement).toBeCloseTo(2.0, 5);

    // Inside a week or a year R has fewer than three results: out of the board.
    expect((await board('average_placement', 'week')).find(r => r.horseId === horseR.id)).toBeUndefined();
    expect((await board('average_placement', 'year')).find(r => r.horseId === horseR.id)).toBeUndefined();
  }, 60000);
});
