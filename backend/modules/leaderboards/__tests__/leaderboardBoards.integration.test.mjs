/**
 * Leaderboard boards, Overall and Monthly (Equoria-y3nia).
 *
 * Owner rulings 2026-10-23 (Stacey): q10/q11 the board set, q40 discipline
 * boards rank horses by WINS in that discipline only, q42 Overall is counted
 * live and Monthly reads the monthly totals table. Win percentage needs at
 * least 100 shows entered (it replaces the xxdqh win-rate and wins routes,
 * whose rules - first places only, placeholder rows are not shows, ties on id -
 * carry over unchanged).
 *
 * Real Express app, real auth, real Prisma, real database. Fixtures are scoped
 * (TestFixture-LBBoards-<run>) and removed by id, fail-loud.
 */

import { randomBytes } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse } from '../../../tests/helpers/testAuth.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { invalidateCachePattern } from '../../../utils/cacheHelper.mjs';
import {
  addHorseMonthlyTotals,
  addPlayerMonthlyTotals,
  disciplineWinsCategory,
} from '../../../utils/monthlyTotals.mjs';
import { gameMonthKey } from '../../../utils/gameTime.mjs';

const ORIGIN = 'http://localhost:3000';
const RUN = randomBytes(6).toString('hex');
const showCount = 100;

const cleanup = createCleanupTracker();
const users = {};
const horses = {};
let token;
let showIds = [];

const get = path => request(app).get(path).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

const board = async (name, query = '') => {
  const res = await get(`/api/v1/leaderboards/boards/${name}?limit=100${query}`);
  expect(res.status).toBe(200);
  return res.body.data.entries;
};

const mineHorses = entries => {
  const ids = new Set(Object.values(horses).map(h => h.id));
  return entries.filter(e => ids.has(e.horseId));
};
const minePlayers = entries => {
  const ids = new Set(Object.values(users).map(u => u.id));
  return entries.filter(e => ids.has(e.ownerId));
};

function results(horseId, { shows, winsIn = {}, pending = 0 }) {
  // winsIn: { discipline: count } first places; every other show is a second place.
  const rows = [];
  const wins = Object.entries(winsIn).flatMap(([discipline, n]) => Array(n).fill(discipline));
  for (let i = 0; i < shows + pending; i++) {
    rows.push({
      horseId,
      showId: showIds[i],
      showName: `TestFixture-LBBoards-show-${i}-${RUN}`,
      discipline: i < wins.length ? wins[i] : 'Reining',
      placement: i >= shows ? null : i < wins.length ? 1 : 2,
      prizeWon: 0,
      score: 100,
      runDate: new Date(),
    });
  }
  return rows;
}

beforeAll(async () => {
  const userIds = () => Object.values(users).map(u => u.id);
  const horseIds = () => Object.values(horses).map(h => h.id);
  cleanup.add(() => prisma.horseMonthlyTotal.deleteMany({ where: { horseId: { in: horseIds() } } }), 'horseTotals');
  cleanup.add(() => prisma.playerMonthlyTotal.deleteMany({ where: { playerId: { in: userIds() } } }), 'playerTotals');
  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds() } } }), 'results');
  cleanup.add(
    () =>
      prisma.show.deleteMany({ where: { name: { startsWith: 'TestFixture-LBBoards-show-', endsWith: `-${RUN}` } } }),
    'shows',
  );
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds() } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds() } } }), 'users');

  for (const key of ['u1', 'u2', 'u3']) {
    const created = await createTestUser({
      username: `LBB_${key}_${RUN}`,
      email: `lbb_${key}_${RUN}@test.com`,
    });
    users[key] = created.user;
    if (key === 'u1') {
      token = created.token;
    }
  }
  // Created in this order so h1.id < h2.id < h3.id (the id tie-break).
  const owners = { h1: 'u1', h2: 'u2', h3: 'u3', h4: 'u1' };
  for (const [key, owner] of Object.entries(owners)) {
    horses[key] = await createTestHorse({
      name: `TestFixture-LBBoards-${key}-${RUN}`,
      userId: users[owner].id,
    });
  }
  await prisma.show.createMany({
    data: Array.from({ length: showCount }, (_, i) => ({
      name: `TestFixture-LBBoards-show-${i}-${RUN}`,
      discipline: 'Reining',
      runDate: new Date(),
      prize: 0,
      entryFee: 0,
      levelMin: 1,
      levelMax: 10,
    })),
  });
  const shows = await prisma.show.findMany({
    where: { name: { startsWith: 'TestFixture-LBBoards-show-', endsWith: `-${RUN}` } },
    select: { id: true, name: true },
  });
  const byName = new Map(shows.map(s => [s.name, s.id]));
  showIds = Array.from({ length: showCount }, (_, i) => byName.get(`TestFixture-LBBoards-show-${i}-${RUN}`));

  // Player xp: u2 500 > u1 300 > u3 100.
  await prisma.user.update({ where: { id: users.u1.id }, data: { xp: 300 } });
  await prisma.user.update({ where: { id: users.u2.id }, data: { xp: 500 } });
  await prisma.user.update({ where: { id: users.u3.id }, data: { xp: 100 } });
  // Horse points h2 90 > h1 50 > h3 10; earnings h1 700 > h3 200 > h2 100; h4 none.
  await prisma.horse.update({ where: { id: horses.h1.id }, data: { horseXp: 50, totalEarnings: 700 } });
  await prisma.horse.update({ where: { id: horses.h2.id }, data: { horseXp: 90, totalEarnings: 100 } });
  await prisma.horse.update({ where: { id: horses.h3.id }, data: { horseXp: 10, totalEarnings: 200 } });

  await prisma.competitionResult.createMany({
    data: [
      // h1: 100 shows, 50 wins (30 Dressage + 20 Show Jumping), 50 seconds.
      ...results(horses.h1.id, { shows: 100, winsIn: { Dressage: 30, 'Show Jumping': 20 } }),
      // h2: 100 shows, 40 wins, all Dressage.
      ...results(horses.h2.id, { shows: 100, winsIn: { Dressage: 40 } }),
      // h3: 10 shows (+1 not yet run), 5 wins in Dressage: under the 100-show minimum.
      ...results(horses.h3.id, { shows: 10, winsIn: { Dressage: 5 }, pending: 1 }),
    ],
  });
  await invalidateCachePattern('leaderboard:*');
}, 120000);

afterAll(async () => {
  await invalidateCachePattern('leaderboard:*');
  await cleanup.run();
}, 60000);

describe('Overall boards are counted live', () => {
  it('playerXp ranks players by xp', async () => {
    const ours = minePlayers(await board('playerXp'));
    expect(ours.map(e => [e.ownerId, e.primaryStat])).toEqual([
      [users.u2.id, 500],
      [users.u1.id, 300],
      [users.u3.id, 100],
    ]);
    expect(ours[0].ownerName).toBe(users.u2.username);
    expect(ours.find(e => e.ownerId === users.u1.id).isCurrentUser).toBe(true);
  });

  it("playerEarnings sums a player's horses", async () => {
    const ours = minePlayers(await board('playerEarnings'));
    expect(ours.map(e => [e.ownerId, e.primaryStat])).toEqual([
      [users.u1.id, 700],
      [users.u3.id, 200],
      [users.u2.id, 100],
    ]);
  });

  it('playerWins counts first places of the whole stable', async () => {
    const ours = minePlayers(await board('playerWins'));
    expect(ours.map(e => [e.ownerId, e.primaryStat])).toEqual([
      [users.u1.id, 50],
      [users.u2.id, 40],
      [users.u3.id, 5],
    ]);
  });

  it('playerWinPercentage needs 100 shows across the stable', async () => {
    const ours = minePlayers(await board('playerWinPercentage'));
    expect(ours.map(e => [e.ownerId, e.primaryStat])).toEqual([
      [users.u1.id, 50],
      [users.u2.id, 40],
    ]);
    expect(ours[0].secondaryStats).toEqual({ wins: 50, totalCompetitions: 100, winRate: 50 });
  });

  it('horsePoints and horseEarnings rank horses', async () => {
    expect(mineHorses(await board('horsePoints')).map(e => [e.horseId, e.primaryStat])).toEqual([
      [horses.h2.id, 90],
      [horses.h1.id, 50],
      [horses.h3.id, 10],
    ]);
    expect(mineHorses(await board('horseEarnings')).map(e => [e.horseId, e.primaryStat])).toEqual([
      [horses.h1.id, 700],
      [horses.h3.id, 200],
      [horses.h2.id, 100],
    ]);
  });

  it('horseWins counts first places; the placeholder row is not a show', async () => {
    const ours = mineHorses(await board('horseWins'));
    expect(ours.map(e => [e.horseId, e.primaryStat])).toEqual([
      [horses.h1.id, 50],
      [horses.h2.id, 40],
      [horses.h3.id, 5],
    ]);
    expect(ours[2].secondaryStats).toEqual({ wins: 5, totalCompetitions: 10 });
    expect(ours[0].horseName).toBe(`TestFixture-LBBoards-h1-${RUN}`);
    expect(ours[0].ownerName).toBe(users.u1.username);
  });

  it('horseWinPercentage includes exactly 100 shows and excludes fewer', async () => {
    const ours = mineHorses(await board('horseWinPercentage'));
    expect(ours.map(e => [e.horseId, e.primaryStat])).toEqual([
      [horses.h1.id, 50],
      [horses.h2.id, 40],
    ]);
  });

  it('the discipline board ranks by wins in that discipline only', async () => {
    const dressage = mineHorses(await board('discipline', '&discipline=Dressage'));
    // h1 has 50 wins overall but 30 in Dressage; h2 40; h3 5. Seconds never count.
    expect(dressage.map(e => [e.horseId, e.primaryStat])).toEqual([
      [horses.h2.id, 40],
      [horses.h1.id, 30],
      [horses.h3.id, 5],
    ]);
    const jumping = mineHorses(await board('discipline', '&discipline=Show%20Jumping'));
    expect(jumping.map(e => [e.horseId, e.primaryStat])).toEqual([[horses.h1.id, 20]]);
    const reining = mineHorses(await board('discipline', '&discipline=Reining'));
    expect(reining).toEqual([]); // only second places there
  });

  it('refuses an unknown board, period or discipline', async () => {
    expect((await get('/api/v1/leaderboards/boards/playerLevel')).status).toBe(404);
    expect((await get('/api/v1/leaderboards/boards/playerXp?period=weekly')).status).toBe(400);
    expect((await get('/api/v1/leaderboards/boards/discipline')).status).toBe(400);
    expect((await get('/api/v1/leaderboards/boards/discipline?discipline=Nope')).status).toBe(400);
  });

  it('pages without overlap and requires auth', async () => {
    const page1 = await get('/api/v1/leaderboards/boards/horseWins?limit=1&page=1');
    const page2 = await get('/api/v1/leaderboards/boards/horseWins?limit=1&page=2');
    expect(page2.body.data.entries[0].rank).toBe(2);
    expect(page2.body.data.entries[0].horseId).not.toBe(page1.body.data.entries[0].horseId);
    const anon = await request(app).get('/api/v1/leaderboards/boards/horseWins').set('Origin', ORIGIN);
    expect(anon.status).toBe(401);
  });
});

describe('Monthly boards read the monthly totals of the current game month', () => {
  beforeAll(async () => {
    const now = new Date();
    const lastMonth = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
    // Players: xp / earnings / wins / shows.
    await addPlayerMonthlyTotals(prisma, users.u1.id, { xp: 30, earnings: 400, wins: 3, shows: 100 }, now);
    await addPlayerMonthlyTotals(prisma, users.u2.id, { xp: 80, earnings: 900, wins: 7, shows: 100 }, now);
    await addPlayerMonthlyTotals(prisma, users.u3.id, { xp: 55, earnings: 100, wins: 1, shows: 99 }, now);
    // A previous month never shows on the current month's boards.
    await addPlayerMonthlyTotals(prisma, users.u3.id, { xp: 9999, wins: 999, shows: 999 }, lastMonth);
    // Horses.
    await addHorseMonthlyTotals(
      prisma,
      horses.h1.id,
      {
        points: 5,
        earnings: 50,
        wins: 2,
        shows: 100,
        [disciplineWinsCategory('Dressage')]: 2,
      },
      now,
    );
    await addHorseMonthlyTotals(
      prisma,
      horses.h2.id,
      {
        points: 9,
        earnings: 20,
        wins: 4,
        shows: 99,
        [disciplineWinsCategory('Dressage')]: 1,
        [disciplineWinsCategory('Show Jumping')]: 3,
      },
      now,
    );
    await addHorseMonthlyTotals(prisma, horses.h3.id, { points: 7, wins: 9, shows: 120 }, lastMonth);
    await invalidateCachePattern('leaderboard:*');
  });

  it('ranks each board from the totals', async () => {
    const pairs = (entries, key = 'ownerId') => entries.map(e => [e[key], e.primaryStat]);
    expect(pairs(minePlayers(await board('playerXp', '&period=monthly')))).toEqual([
      [users.u2.id, 80],
      [users.u3.id, 55],
      [users.u1.id, 30],
    ]);
    expect(pairs(minePlayers(await board('playerEarnings', '&period=monthly')))).toEqual([
      [users.u2.id, 900],
      [users.u1.id, 400],
      [users.u3.id, 100],
    ]);
    expect(pairs(minePlayers(await board('playerWins', '&period=monthly')))).toEqual([
      [users.u2.id, 7],
      [users.u1.id, 3],
      [users.u3.id, 1],
    ]);
    expect(pairs(mineHorses(await board('horsePoints', '&period=monthly')), 'horseId')).toEqual([
      [horses.h2.id, 9],
      [horses.h1.id, 5],
    ]);
    expect(pairs(mineHorses(await board('horseEarnings', '&period=monthly')), 'horseId')).toEqual([
      [horses.h1.id, 50],
      [horses.h2.id, 20],
    ]);
    expect(pairs(mineHorses(await board('horseWins', '&period=monthly')), 'horseId')).toEqual([
      [horses.h2.id, 4],
      [horses.h1.id, 2],
    ]);
  });

  it('applies the 100-show minimum within the month', async () => {
    const players = minePlayers(await board('playerWinPercentage', '&period=monthly'));
    expect(players.map(e => [e.ownerId, e.primaryStat])).toEqual([
      [users.u2.id, 7],
      [users.u1.id, 3],
    ]); // u3 entered 99 this month (999 last month does not count)
    const horsesBoard = mineHorses(await board('horseWinPercentage', '&period=monthly'));
    expect(horsesBoard.map(e => [e.horseId, e.primaryStat])).toEqual([[horses.h1.id, 2]]);
  });

  it("the monthly discipline board counts that discipline's wins only", async () => {
    const dressage = mineHorses(await board('discipline', '&period=monthly&discipline=Dressage'));
    expect(dressage.map(e => [e.horseId, e.primaryStat])).toEqual([
      [horses.h1.id, 2],
      [horses.h2.id, 1],
    ]);
    const jumping = mineHorses(await board('discipline', '&period=monthly&discipline=Show%20Jumping'));
    expect(jumping.map(e => [e.horseId, e.primaryStat])).toEqual([[horses.h2.id, 3]]);
  });

  it('reads the month of "now": the roll-over boundary is midnight Eastern on the 1st (EST here)', async () => {
    const { loadBoard } = await import('../services/boardService.mjs');
    // 2027-01-01 00:00 EST is 05:00Z; the second before still belongs to December.
    const lastSecond = new Date('2027-01-01T04:59:59Z');
    const firstSecond = new Date('2027-01-01T05:00:00Z');
    expect(gameMonthKey(lastSecond)).toBe('2026-12');
    expect(gameMonthKey(firstSecond)).toBe('2027-01');
    await addPlayerMonthlyTotals(prisma, users.u1.id, { xp: 11 }, lastSecond);
    await addPlayerMonthlyTotals(prisma, users.u1.id, { xp: 22 }, firstSecond);
    const page = { take: 100, skip: 0 };
    const december = await loadBoard('playerXp', 'monthly', page, { now: lastSecond });
    const january = await loadBoard('playerXp', 'monthly', page, { now: firstSecond });
    const xpOf = (board, id) => board.entries.find(e => e.ownerId === id)?.primaryStat;
    expect(xpOf(december, users.u1.id)).toBe(11);
    expect(xpOf(january, users.u1.id)).toBe(22);
  });
});
