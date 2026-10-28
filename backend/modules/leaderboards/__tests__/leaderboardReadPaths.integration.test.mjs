/**
 * Leaderboard read paths — the player's rank summary (Equoria-cmw85.18, Equoria-3kfne).
 *
 * Equoria-a7f1p (owner ruling 2026-10-28, q151): the query-shape, stable-paging and
 * honoured-parameter cases (Equoria-cmw85.16, 2y91o, 4qpqb, 9svu0) read the duplicate
 * lists (/competition, /players/xp, /players/horse-earnings, /horses/earnings,
 * /horses/performance, /recent-winners) and went with them; the page boards'
 * paging is covered by leaderboardBoards.integration.test.mjs.
 *
 * Real backend, real Prisma, real auth, real DB. Fixtures are scoped
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
    xp: 5, // on the playerXp board
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

describe('user rank summary (Equoria-cmw85.18, Equoria-3kfne)', () => {
  it('reports the place on each board the player is on', async () => {
    const res = await get(`/api/v1/leaderboards/user-summary/${user.id}`);
    expect(res.status).toBe(200);

    // The fixture is on the XP board (xp 5) and the wins board (seven first
    // places); it has no earnings and fewer than 100 shows.
    expect(res.body.rankings.map(r => r.category)).toEqual(['playerXp', 'playerWins']);
  }, 60_000);
});
