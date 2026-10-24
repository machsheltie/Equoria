/**
 * Leaderboards — the page boards that have a date honour the period (Equoria-5uptv).
 *
 * The LeaderboardsPage sent ?period=all-time|monthly|weekly|daily to every board
 * and the handlers ignored it, so pressing Weekly changed nothing: a false
 * control. A board whose rows are dated results (discipline wins, recent
 * winners) now narrows to results run inside the period; boards that are
 * lifetime counters (level, prize money, owner totals) have no period.
 *
 * Periods match GET /competition: weekly = the last 7 days, monthly = the last
 * 30 days, both from 00:00 Eastern of their first game day; daily = today's game
 * day.
 *
 * Real Express app, real auth, real Prisma, real database; scoped fixtures.
 */

import { randomBytes } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse } from '../../../tests/helpers/testAuth.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { invalidateCachePattern } from '../../../utils/cacheHelper.mjs';

const ORIGIN = 'http://localhost:3000';
const RUN = randomBytes(6).toString('hex');
const DISCIPLINE = 'Gymkhana';
const dayMs = 24 * 60 * 60 * 1000;
const daysAgo = days => new Date(Date.now() - days * dayMs);

const cleanup = createCleanupTracker();
let token;
let user;
const horse = {};
let showIds = [];

const get = path => request(app).get(path).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);
const recentWinners = period =>
  get(`/api/v1/leaderboards/recent-winners?discipline=${DISCIPLINE}&limit=50&period=${period}`);

const resultRow = (horseId, showIndex, runDate) => ({
  horseId,
  showId: showIds[showIndex],
  showName: `TestFixture-LBPeriod-show-${showIndex}-${RUN}`,
  discipline: DISCIPLINE,
  placement: 1,
  prizeWon: 0,
  score: 100,
  runDate,
});

beforeAll(async () => {
  const created = await createTestUser({
    username: `LBPeriod_${RUN}`,
    email: `lbperiod_${RUN}@test.com`,
  });
  user = created.user;
  token = created.token;
  horse.X = await createTestHorse({ name: `TestFixture-LBPeriod-X-${RUN}`, userId: user.id });
  horse.Y = await createTestHorse({ name: `TestFixture-LBPeriod-Y-${RUN}`, userId: user.id });
  const horseIds = Object.values(horse).map(h => h.id);

  await prisma.show.createMany({
    data: Array.from({ length: 3 }, (_, i) => ({
      name: `TestFixture-LBPeriod-show-${i}-${RUN}`,
      discipline: DISCIPLINE,
      runDate: new Date(),
      prize: 0,
      entryFee: 0,
      levelMin: 1,
      levelMax: 10,
    })),
  });
  const shows = await prisma.show.findMany({
    where: { name: { startsWith: 'TestFixture-LBPeriod-show-', endsWith: `-${RUN}` } },
    select: { id: true, name: true },
  });
  const byName = new Map(shows.map(s => [s.name, s.id]));
  showIds = Array.from({ length: 3 }, (_, i) => byName.get(`TestFixture-LBPeriod-show-${i}-${RUN}`));

  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } }), 'results');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');

  await prisma.competitionResult.createMany({
    data: [
      // X: a win run just now and a win run 40 days ago.
      resultRow(horse.X.id, 0, new Date()),
      resultRow(horse.X.id, 1, daysAgo(40)),
      // Y: one win run 10 days ago.
      resultRow(horse.Y.id, 2, daysAgo(10)),
    ],
  });
  await invalidateCachePattern('leaderboard:*');
}, 120000);

afterAll(async () => {
  await invalidateCachePattern('leaderboard:*');
  await cleanup.run();
}, 60000);

describe('GET /api/v1/leaderboards/recent-winners — period (Equoria-5uptv)', () => {
  const horseIdsIn = res => res.body.data.entries.map(entry => entry.horseId);

  it('all-time lists every recent win in the discipline', async () => {
    const res = await recentWinners('all-time');

    expect(res.status).toBe(200);
    expect(horseIdsIn(res).filter(id => id === horse.X.id)).toHaveLength(2);
    expect(horseIdsIn(res)).toContain(horse.Y.id);
  });

  it('weekly lists only wins run in the last 7 days', async () => {
    const res = await recentWinners('weekly');

    expect(horseIdsIn(res).filter(id => id === horse.X.id)).toHaveLength(1);
    expect(horseIdsIn(res)).not.toContain(horse.Y.id);
    // The winners list its other readers use narrows with the page shape.
    expect(res.body.data.winners).toHaveLength(res.body.data.entries.length);
  });

  it('refuses a period it does not know', async () => {
    const res = await recentWinners('fortnightly');

    expect(res.status).toBe(400);
  });
});
