/**
 * Leaderboard read paths — query shape + stable paging + honoured params
 * (Equoria-cmw85.16, cmw85.18, 2y91o, 4qpqb, 9svu0).
 *
 * Real backend, real Prisma, real auth, real DB. Prisma delegates are wrapped
 * with delegating recorders (the real call still runs) so the SHAPE of each
 * read is observable: which columns a horse read selects, how many snapshot
 * rows a rank summary reads, whether a pagination total is materialised, and
 * what order keys a leaderboard query carries. Fixtures are scoped
 * (TestFixture-LBRead-<run>) and removed by id.
 */

import { randomBytes } from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse } from '../../../tests/helpers/testAuth.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { invalidateCachePattern } from '../../../utils/cacheHelper.mjs';

const ORIGIN = 'http://localhost:3000';
const RUN = randomBytes(6).toString('hex');
const disciplineA = 'Dressage';
const disciplineB = 'Show Jumping';

const cleanup = createCleanupTracker();
let user;
let token;
const horses = [];
const showIds = [];
const userIds = [];

/** Wrap prisma delegate methods with recorders; returns { calls, restore }. */
function record(targets) {
  const calls = [];
  const originals = [];
  for (const [delegateName, method] of targets) {
    const delegate = prisma[delegateName];
    const original = delegate[method].bind(delegate);
    originals.push([delegate, method, delegate[method]]);
    delegate[method] = async (...args) => {
      const result = await original(...args);
      calls.push({ delegate: delegateName, method, args: args[0], rows: result });
      return result;
    };
  }
  return {
    calls,
    restore() {
      for (const [delegate, method, fn] of originals) {
        delegate[method] = fn;
      }
    },
  };
}

const get = path => request(app).get(path).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

async function addResult(horseId, showId, { placement, score, discipline, runDate }) {
  return prisma.competitionResult.create({
    data: {
      horseId,
      showId,
      showName: `TestFixture-LBRead-show-${RUN}`,
      discipline,
      placement,
      prizeWon: 0,
      score,
      runDate: runDate ?? new Date(),
    },
  });
}

beforeAll(async () => {
  const created = await createTestUser({
    username: `LBRead_${RUN}`,
    email: `lbread_${RUN}@test.com`,
  });
  user = created.user;
  token = created.token;
  userIds.push(user.id);

  // Six horses, each with exactly one first place in disciplineA at the SAME score
  // (a full tie on wins, earnings and score), plus one in disciplineB for horse 0
  // with a higher score.
  for (let i = 0; i < 6; i++) {
    horses.push(await createTestHorse({ name: `TestFixture-LBRead-H${i}-${RUN}`, userId: user.id }));
  }
  for (let i = 0; i < 7; i++) {
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-LBRead-show-${i}-${RUN}`,
        discipline: disciplineA,
        runDate: new Date(),
        prize: 1000,
        entryFee: 100,
        levelMin: 1,
        levelMax: 10,
      },
    });
    showIds.push(show.id);
  }
  for (let i = 0; i < 6; i++) {
    await addResult(horses[i].id, showIds[i], {
      placement: 1,
      score: 4_000_000,
      discipline: disciplineA,
    });
  }
  await addResult(horses[0].id, showIds[6], {
    placement: 1,
    score: 4_500_000,
    discipline: disciplineB,
  });

  // A snapshot history far deeper than the four rows a summary needs.
  const day = 24 * 60 * 60 * 1000;
  const categories = ['level', 'xp', 'horse-earnings', 'horse-performance'];
  const rows = [];
  for (let d = 0; d < 12; d++) {
    for (const category of categories) {
      rows.push({
        userId: user.id,
        category,
        rank: 1000 + d, // d=0 is the newest and therefore the one that counts
        capturedAt: new Date(Date.now() - d * day),
      });
    }
  }
  await prisma.userRankSnapshot.createMany({ data: rows });

  cleanup.add(() => prisma.userRankSnapshot.deleteMany({ where: { userId: user.id } }), 'snapshots');
  cleanup.add(
    () => prisma.competitionResult.deleteMany({ where: { horseId: { in: horses.map(h => h.id) } } }),
    'results',
  );
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horses.map(h => h.id) } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
}, 120_000);

afterAll(() => cleanup.run(), 120_000);

// Leaderboards are cached for 5 minutes; every test needs to see the real query.
beforeEach(() => invalidateCachePattern('leaderboard:*'));

describe('competition leaderboard horse details (Equoria-cmw85.16)', () => {
  it('reads only the columns the response uses, and responds unchanged', async () => {
    const rec = record([['horse', 'findMany']]);
    let res;
    try {
      res = await get(
        `/api/v1/leaderboards/competition?metric=wins&discipline=${encodeURIComponent(disciplineA)}&limit=100`,
      );
    } finally {
      rec.restore();
    }
    expect(res.status).toBe(200);

    const detailReads = rec.calls.filter(c => c.args?.where?.id?.in);
    expect(detailReads.length).toBeGreaterThanOrEqual(1);
    for (const read of detailReads) {
      expect(read.args.include).toBeUndefined();
      expect(read.args.select).toBeDefined();
      expect(Object.keys(read.args.select).sort()).toEqual(['id', 'name', 'user', 'userId']);
    }

    const mine = res.body.data.leaderboard.filter(entry => horses.some(h => h.id === entry.horseId));
    expect(mine).toHaveLength(6);
    for (const entry of mine) {
      const horse = horses.find(h => h.id === entry.horseId);
      expect(entry).toMatchObject({
        horseName: horse.name,
        userId: user.id,
        userName: user.username,
        wins: 1,
        value: 1,
        metric: 'wins',
      });
    }
  }, 60_000);
});

describe('stable ordering and real counts (Equoria-2y91o, Equoria-4qpqb)', () => {
  it('pages a fully tied competition leaderboard without skipping or repeating a horse', async () => {
    const path = metric =>
      `/api/v1/leaderboards/competition?metric=${metric}&discipline=${encodeURIComponent(disciplineA)}`;
    for (const metric of ['wins', 'placements', 'earnings']) {
      const seen = [];
      let offset = 0;
      for (;;) {
        const res = await get(`${path(metric)}&limit=2&offset=${offset}`);
        expect(res.status).toBe(200);
        const page = res.body.data.leaderboard;
        seen.push(...page.map(entry => entry.horseId));
        if (!res.body.data.pagination.hasMore) {
          break;
        }
        offset += 2;
      }
      expect(new Set(seen).size).toBe(seen.length); // nothing repeated
      const mine = seen.filter(id => horses.some(h => h.id === id));
      expect(mine).toHaveLength(6); // nothing skipped
      // Ties break by horseId ascending, so the tied fixtures arrive in id order.
      expect(mine).toEqual([...mine].sort((a, b) => a - b));
    }
  }, 120_000);

  it('carries a trailing unique tiebreaker on every competition groupBy', async () => {
    const rec = record([['competitionResult', 'groupBy']]);
    try {
      for (const metric of ['wins', 'placements', 'earnings']) {
        const res = await get(
          `/api/v1/leaderboards/competition?metric=${metric}&discipline=${encodeURIComponent(disciplineA)}&limit=3&offset=${3 + Math.floor(Math.random() * 1000)}`,
        );
        expect(res.status).toBe(200);
      }
    } finally {
      rec.restore();
    }
    const ordered = rec.calls.filter(c => c.args?.orderBy);
    expect(ordered.length).toBeGreaterThanOrEqual(3);
    for (const call of ordered) {
      expect(Array.isArray(call.args.orderBy)).toBe(true);
      expect(call.args.orderBy[call.args.orderBy.length - 1]).toEqual({ horseId: 'asc' });
    }
  }, 60_000);

  it('never materialises every group to count a competition page', async () => {
    const where = { placement: { not: null }, discipline: disciplineA };
    const expectedTotal = (await prisma.competitionResult.groupBy({ by: ['horseId'], where })).length;

    const rec = record([['competitionResult', 'groupBy']]);
    let res;
    try {
      res = await get(
        `/api/v1/leaderboards/competition?metric=wins&discipline=${encodeURIComponent(disciplineA)}&limit=2&offset=0`,
      );
    } finally {
      rec.restore();
    }
    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBe(expectedTotal);
    expect(res.body.data.pagination.hasMore).toBe(expectedTotal > 2);
    // Every remaining groupBy is a bounded page (take), none is the full count.
    for (const call of rec.calls) {
      expect(call.args.take).toBeDefined();
    }
  }, 60_000);

  it('counts XP leaderboard totals in SQL, not by materialising every user group', async () => {
    await prisma.xpEvent.create({ data: { userId: user.id, amount: 7, reason: `TestFixture-LBRead-${RUN}` } });
    cleanup.add(() => prisma.xpEvent.deleteMany({ where: { userId: user.id } }), 'xpEvents');

    const expectedTotal = (await prisma.xpEvent.groupBy({ by: ['userId'] })).length;
    const rec = record([['xpEvent', 'groupBy']]);
    let res;
    try {
      // limit+page chosen unique to this run so no cached copy answers it.
      res = await get(`/api/v1/leaderboards/players/xp?limit=${2 + (Date.now() % 90)}&page=1`);
    } finally {
      rec.restore();
    }
    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBe(expectedTotal);
    for (const call of rec.calls) {
      expect(call.args.take).toBeDefined();
      expect(Array.isArray(call.args.orderBy)).toBe(true);
      expect(call.args.orderBy[call.args.orderBy.length - 1]).toEqual({ userId: 'asc' });
    }
  }, 60_000);

  it('orders the player and horse leaderboards by a trailing unique key', async () => {
    const rec = record([
      ['user', 'findMany'],
      ['horse', 'findMany'],
      ['horse', 'groupBy'],
      ['competitionResult', 'groupBy'],
      ['competitionResult', 'findMany'],
    ]);
    const unique = 3 + Math.floor(Math.random() * 1_000_000);
    try {
      for (const path of [
        `/api/v1/leaderboards/players/xp?limit=3&page=${unique}`,
        `/api/v1/leaderboards/horses/earnings?limit=3&page=${unique}`,
        `/api/v1/leaderboards/horses/performance?limit=3&offset=${unique}`,
        `/api/v1/leaderboards/players/horse-earnings?limit=3&offset=${unique}`,
        '/api/v1/leaderboards/recent-winners?limit=3',
      ]) {
        const res = await get(path);
        expect(res.status).toBe(200);
      }
    } finally {
      rec.restore();
    }
    const ordered = rec.calls.filter(c => c.args?.orderBy && c.args.take !== undefined);
    const lastKeys = ordered.map(c => {
      const orderBy = Array.isArray(c.args.orderBy) ? c.args.orderBy : [c.args.orderBy];
      return Object.keys(orderBy[orderBy.length - 1])[0];
    });
    // horse earnings, performance groupBy, owner-earnings groupBy, recent winners —
    // each ends in an id-like unique key. (Five until the owner removed the player
    // level board, Equoria-y3nia; the players/xp read is raw SQL, not a Prisma
    // orderBy, so it is not in this count.)
    expect(ordered.length).toBeGreaterThanOrEqual(4);
    for (const key of lastKeys) {
      expect(['id', 'horseId', 'userId']).toContain(key);
    }
  }, 60_000);
});

describe('documented leaderboard parameters are honoured (Equoria-9svu0)', () => {
  it('applies limit, offset and discipline to horses/performance', async () => {
    const all = await get(
      `/api/v1/leaderboards/horses/performance?discipline=${encodeURIComponent(disciplineA)}&limit=100`,
    );
    expect(all.status).toBe(200);
    const full = all.body.data.rankings;
    const mineFull = full.filter(r => horses.some(h => h.id === r.horseId));
    expect(mineFull).toHaveLength(6);
    // horse 0's better disciplineB score must not leak into the disciplineA ranking
    expect(mineFull.every(r => r.maxScore === 4_000_000)).toBe(true);

    const window = await get(
      `/api/v1/leaderboards/horses/performance?discipline=${encodeURIComponent(disciplineA)}&limit=2&offset=1`,
    );
    expect(window.status).toBe(200);
    expect(window.body.data.rankings).toHaveLength(2);
    expect(window.body.data.rankings.map(r => r.horseId)).toEqual(full.slice(1, 3).map(r => r.horseId));
    expect(window.body.data.rankings.map(r => r.rank)).toEqual([2, 3]);

    const other = await get(
      `/api/v1/leaderboards/horses/performance?discipline=${encodeURIComponent(disciplineB)}&limit=100`,
    );
    const mineB = other.body.data.rankings.filter(r => horses.some(h => h.id === r.horseId));
    expect(mineB.map(r => r.horseId)).toEqual([horses[0].id]);
  }, 60_000);

  it('applies limit (default 20, max 50) to recent-winners', async () => {
    const two = await get('/api/v1/leaderboards/recent-winners?limit=2');
    expect(two.status).toBe(200);
    expect(two.body.data.winners).toHaveLength(2);

    const rec = record([['competitionResult', 'findMany']]);
    try {
      await get(`/api/v1/leaderboards/recent-winners?limit=500&discipline=${encodeURIComponent(disciplineA)}`);
      await get(`/api/v1/leaderboards/recent-winners?discipline=${encodeURIComponent(disciplineB)}`);
    } finally {
      rec.restore();
    }
    const takes = rec.calls.map(c => c.args.take);
    expect(takes).toEqual([50, 20]);
  }, 60_000);
});

describe('user rank summary (Equoria-cmw85.18)', () => {
  it('reads at most one snapshot per category however deep the history is', async () => {
    const rec = record([
      ['userRankSnapshot', 'findMany'],
      ['userRankSnapshot', 'findFirst'],
    ]);
    let res;
    try {
      res = await get(`/api/v1/leaderboards/user-summary/${user.id}`);
    } finally {
      rec.restore();
    }
    expect(res.status).toBe(200);

    const rowsRead = rec.calls.reduce(
      (sum, call) => sum + (Array.isArray(call.rows) ? call.rows.length : call.rows ? 1 : 0),
      0,
    );
    expect(rowsRead).toBeLessThanOrEqual(4);

    // The newest snapshot (rank 1000) is the one rankChange is measured from.
    expect(res.body.rankings).toHaveLength(4);
    for (const ranking of res.body.rankings) {
      expect(ranking.rankChange).toBe(1000 - ranking.rank);
    }
  }, 60_000);
});
