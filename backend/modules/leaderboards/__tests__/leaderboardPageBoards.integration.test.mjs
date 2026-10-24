/**
 * Leaderboards — the page shape of the recent-winners feed (Equoria-pthuj). The
 * level, prize-money, owner and discipline page routes were replaced by
 * /boards/:board (Equoria-y3nia; see leaderboardBoards.integration.test.mjs).
 *
 * The LeaderboardsPage reads `{ entries, currentPage, totalPages }` from every
 * tab. Before this fix /level answered `{ users, pagination }`, /prize-money
 * `{ horses, pagination }`, /owner `{ rankings }`, /recent-winners `{ winners }`
 * and /discipline did not exist, so the page showed an empty board after a
 * successful request that held real rows (or a 404 error for discipline).
 *
 * Real Express app, real auth, real Prisma, real database. Fixtures are scoped
 * (TestFixture-LBPage-<run>) and removed by id, fail-loud.
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
const DISCIPLINE = 'Vaulting';
const otherDiscipline = 'Dressage';
const farFuture = new Date('2099-01-01T12:00:00Z');

const cleanup = createCleanupTracker();
let user;
let token;
let rival;
const horse = {};
let showIds = [];

const get = path => request(app).get(path).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

const pageKeys = ['currentPage', 'entries', 'totalEntries', 'totalPages'];

/** Every entry the page renders carries these. */
function expectEntryShape(entry) {
  expect(entry).toEqual(
    expect.objectContaining({
      rank: expect.any(Number),
      ownerId: expect.any(String),
      ownerName: expect.any(String),
      primaryStat: expect.any(Number),
      secondaryStats: expect.any(Object),
      isCurrentUser: expect.any(Boolean),
    }),
  );
}

const resultRow = (horseId, showIndex, { placement, discipline, score = 100, prizeWon = 0, runDate }) => ({
  horseId,
  showId: showIds[showIndex],
  showName: `TestFixture-LBPage-show-${showIndex}-${RUN}`,
  discipline,
  placement,
  prizeWon,
  score,
  runDate: runDate ?? new Date(),
});

beforeAll(async () => {
  // Level 9999 puts this user at the top of the level board.
  const created = await createTestUser({
    username: `LBPage_${RUN}`,
    email: `lbpage_${RUN}@test.com`,
    level: 9999,
    xp: 7,
  });
  user = created.user;
  token = created.token;
  rival = (await createTestUser({ username: `LBPageRival_${RUN}`, email: `lbpagerival_${RUN}@test.com`, level: 9998 }))
    .user;

  horse.A = await createTestHorse({
    name: `TestFixture-LBPage-A-${RUN}`,
    userId: user.id,
    totalEarnings: 2_000_000_002,
  });
  horse.B = await createTestHorse({
    name: `TestFixture-LBPage-B-${RUN}`,
    userId: user.id,
    totalEarnings: 2_000_000_001,
  });
  horse.C = await createTestHorse({
    name: `TestFixture-LBPage-C-${RUN}`,
    userId: rival.id,
    totalEarnings: 0,
  });
  const horseIds = Object.values(horse).map(h => h.id);

  await prisma.show.createMany({
    data: Array.from({ length: 6 }, (_, i) => ({
      name: `TestFixture-LBPage-show-${i}-${RUN}`,
      discipline: DISCIPLINE,
      runDate: new Date(),
      prize: 0,
      entryFee: 0,
      levelMin: 1,
      levelMax: 10,
    })),
  });
  const shows = await prisma.show.findMany({
    where: { name: { startsWith: 'TestFixture-LBPage-show-', endsWith: `-${RUN}` } },
    select: { id: true, name: true },
  });
  const byName = new Map(shows.map(s => [s.name, s.id]));
  showIds = Array.from({ length: 6 }, (_, i) => byName.get(`TestFixture-LBPage-show-${i}-${RUN}`));

  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } }), 'results');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [user.id, rival.id] } } }), 'users');

  await prisma.competitionResult.createMany({
    data: [
      // A: three Vaulting wins (mixed spellings) + one second; one Dressage win
      // that must not count towards the Vaulting board.
      resultRow(horse.A.id, 0, { placement: 1, discipline: DISCIPLINE }),
      resultRow(horse.A.id, 1, { placement: 1, discipline: DISCIPLINE }),
      resultRow(horse.A.id, 2, { placement: 1, discipline: DISCIPLINE }),
      resultRow(horse.A.id, 3, { placement: 2, discipline: DISCIPLINE }),
      resultRow(horse.A.id, 4, { placement: 1, discipline: otherDiscipline }),
      // B: one Vaulting win, the most recent winner anywhere (far-future runDate).
      resultRow(horse.B.id, 0, {
        placement: 1,
        discipline: DISCIPLINE,
        score: 87.5,
        prizeWon: 1234,
        runDate: farFuture,
      }),
      // C: a second place only, so it is on no win board.
      resultRow(horse.C.id, 0, { placement: 2, discipline: DISCIPLINE }),
    ],
  });

  await invalidateCachePattern('leaderboard:*');
}, 120000);

afterAll(async () => {
  await invalidateCachePattern('leaderboard:*');
  await cleanup.run();
}, 60000);

describe('GET /api/v1/leaderboards/recent-winners — page shape (Equoria-pthuj)', () => {
  it('adds the page shape and keeps the winners list its other readers use', async () => {
    const res = await get('/api/v1/leaderboards/recent-winners');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual([...pageKeys, 'winners'].sort());
    expect(Array.isArray(res.body.data.winners)).toBe(true);
    res.body.data.entries.forEach(expectEntryShape);

    const [newest] = res.body.data.entries;
    expect(newest).toEqual(
      expect.objectContaining({
        rank: 1,
        horseId: horse.B.id,
        horseName: horse.B.name,
        ownerId: user.id,
        primaryStat: 87.5,
        secondaryStats: { totalPrizeMoney: 1234 },
        isCurrentUser: true,
      }),
    );
    expect(res.body.data.totalPages).toBe(1);
    expect(res.body.data.totalEntries).toBe(res.body.data.entries.length);
  });
});
