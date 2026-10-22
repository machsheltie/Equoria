/**
 * Leaderboards — win-percentage board and number-of-wins board (Equoria-xxdqh).
 *
 * Owner ruling 2026-10-22 (Stacey): the win-rate leaderboard must not rank by
 * best competition score. Two categories:
 *   1. win percentage = wins / shows entered; only horses with at least 100
 *      shows entered qualify;
 *   2. number of wins.
 * A win is a first place, stored as '1' or '1st' until the placement Int
 * migration (Equoria-f46tb) lands. "Shows entered" counts settled results
 * (placement NOT NULL); a placeholder row for a show that has not run yet does
 * not count. Ties break on horseId ascending.
 *
 * Real Express app, real auth, real Prisma, real database. Fixtures are scoped
 * (TestFixture-LBWin-<run>) and removed by id, fail-loud.
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
const SHOW_COUNT = 121;

const cleanup = createCleanupTracker();
let user;
let token;
const horse = {};
let showIds = [];

const get = path => request(app).get(path).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

/**
 * Give `horseId` one result per show for the first `completed` shows: the first
 * `wins` are first places (alternating '1' / '1st' when `mixed`), the rest are
 * second places. `pending` extra shows get a NULL-placement placeholder row.
 */
function resultRows(horseId, { completed, wins, mixed = false, pending = 0 }) {
  const rows = [];
  for (let i = 0; i < completed + pending; i++) {
    let placement = null;
    if (i < wins) {
      placement = mixed && i % 2 === 1 ? '1st' : '1';
    } else if (i < completed) {
      placement = '2';
    }
    rows.push({
      horseId,
      showId: showIds[i],
      showName: `TestFixture-LBWin-show-${i}-${RUN}`,
      discipline: 'Dressage',
      placement,
      prizeWon: 0,
      score: 100,
      runDate: new Date(),
    });
  }
  return rows;
}

/** This suite's horses, in the order the board returned them. */
const mine = entries => {
  const ids = new Set(Object.values(horse).map(h => h.id));
  return entries.filter(e => ids.has(e.horseId));
};

beforeAll(async () => {
  const created = await createTestUser({
    username: `LBWin_${RUN}`,
    email: `lbwin_${RUN}@test.com`,
  });
  user = created.user;
  token = created.token;

  // Created in this order so A.id < D.id (the horseId tie-break).
  for (const key of ['A', 'B', 'C', 'D', 'E']) {
    horse[key] = await createTestHorse({ name: `TestFixture-LBWin-${key}-${RUN}`, userId: user.id });
  }
  const horseIds = Object.values(horse).map(h => h.id);

  await prisma.show.createMany({
    data: Array.from({ length: SHOW_COUNT }, (_, i) => ({
      name: `TestFixture-LBWin-show-${i}-${RUN}`,
      discipline: 'Dressage',
      runDate: new Date(),
      prize: 0,
      entryFee: 0,
      levelMin: 1,
      levelMax: 10,
    })),
  });
  const shows = await prisma.show.findMany({
    where: { name: { startsWith: 'TestFixture-LBWin-show-', endsWith: `-${RUN}` } },
    select: { id: true, name: true },
  });
  const byName = new Map(shows.map(s => [s.name, s.id]));
  showIds = Array.from({ length: SHOW_COUNT }, (_, i) => byName.get(`TestFixture-LBWin-show-${i}-${RUN}`));

  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } }), 'results');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');

  await prisma.competitionResult.createMany({
    data: [
      // A: exactly 100 settled shows (+1 not yet run), 60 wins as '1' and '1st'.
      ...resultRows(horse.A.id, { completed: 100, wins: 60, mixed: true, pending: 1 }),
      // B: 120 shows, 90 wins.
      ...resultRows(horse.B.id, { completed: 120, wins: 90 }),
      // C: 99 settled shows, all won as '1st', + 1 not yet run — 100 rows but
      // only 99 shows entered, so not qualified.
      ...resultRows(horse.C.id, { completed: 99, wins: 99, mixed: true, pending: 1 }),
      // D: same record as A (60 / 100), created later.
      ...resultRows(horse.D.id, { completed: 100, wins: 60 }),
      // E: 3 shows, no wins.
      ...resultRows(horse.E.id, { completed: 3, wins: 0 }),
    ],
  });

  await invalidateCachePattern('leaderboard:*');
}, 120000);

afterAll(async () => {
  await invalidateCachePattern('leaderboard:*');
  await cleanup.run();
}, 60000);

describe('GET /api/v1/leaderboards/win-rate — win percentage, 100-show minimum (Equoria-xxdqh)', () => {
  it('ranks qualified horses by wins / shows entered, horseId breaking ties', async () => {
    const res = await get('/api/v1/leaderboards/win-rate?limit=100');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ours = mine(res.body.data.entries);
    expect(ours.map(e => e.horseId)).toEqual([horse.B.id, horse.A.id, horse.D.id]);

    const [b, a, d] = ours;
    expect(b.primaryStat).toBe(75);
    expect(b.secondaryStats).toEqual({ wins: 90, totalCompetitions: 120, winRate: 75 });
    // '1' and '1st' both count; the not-yet-run placeholder does not.
    expect(a.primaryStat).toBe(60);
    expect(a.secondaryStats).toEqual({ wins: 60, totalCompetitions: 100, winRate: 60 });
    expect(d.primaryStat).toBe(60);
    expect(b.rank).toBeLessThan(a.rank);
    expect(a.rank).toBeLessThan(d.rank);
    expect(a.horseName).toBe(`TestFixture-LBWin-A-${RUN}`);
    expect(a.ownerId).toBe(user.id);
    expect(a.ownerName).toBe(user.username);
    expect(a.isCurrentUser).toBe(true);
  });

  it('excludes a horse with 99 shows entered and one with too few, includes exactly 100', async () => {
    const res = await get('/api/v1/leaderboards/win-rate?limit=100');

    const ids = res.body.data.entries.map(e => e.horseId);
    expect(ids).toContain(horse.A.id); // exactly 100 shows entered
    expect(ids).not.toContain(horse.C.id); // 99 shows entered (100 rows, one not run)
    expect(ids).not.toContain(horse.E.id);
    expect(res.body.data.totalEntries).toBeGreaterThanOrEqual(3);
    expect(res.body.data.currentPage).toBe(1);
  });

  it('pages without overlap', async () => {
    const page1 = await get('/api/v1/leaderboards/win-rate?limit=1&page=1');
    const page2 = await get('/api/v1/leaderboards/win-rate?limit=1&page=2');

    expect(page1.body.data.entries).toHaveLength(1);
    expect(page2.body.data.entries).toHaveLength(1);
    expect(page2.body.data.entries[0].rank).toBe(2);
    expect(page2.body.data.entries[0].horseId).not.toBe(page1.body.data.entries[0].horseId);
    expect(page1.body.data.totalPages).toBe(page1.body.data.totalEntries);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/v1/leaderboards/win-rate').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/leaderboards/wins — number of wins (Equoria-xxdqh)', () => {
  it('ranks horses by first places, counting "1" and "1st", horseId breaking ties', async () => {
    const res = await get('/api/v1/leaderboards/wins?limit=100');

    expect(res.status).toBe(200);
    const ours = mine(res.body.data.entries);
    expect(ours.map(e => e.horseId)).toEqual([horse.C.id, horse.B.id, horse.A.id, horse.D.id]);
    expect(ours.map(e => e.primaryStat)).toEqual([99, 90, 60, 60]);
    expect(ours[0].secondaryStats).toEqual({ wins: 99, totalCompetitions: 99 });
    expect(ours[2].rank).toBeLessThan(ours[3].rank);
  });

  it('leaves out horses that have never won', async () => {
    const res = await get('/api/v1/leaderboards/wins?limit=100');
    expect(res.body.data.entries.map(e => e.horseId)).not.toContain(horse.E.id);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/v1/leaderboards/wins').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});
