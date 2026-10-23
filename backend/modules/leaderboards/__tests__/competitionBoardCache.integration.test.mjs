/**
 * GET /api/v1/leaderboards/competition is served from the server query cache
 * (Equoria-cmw85.6).
 *
 * Every other leaderboard read wraps its query in getCachedQuery(..., 300); the
 * competition board re-ran its ranking groupBy, its horse-detail read and its
 * distinct-horse count on every request, on the largest table in the game.
 *
 * Real backend, real Prisma, real auth, real DB; the counting wrappers delegate
 * to the real client. Proven here:
 *   - a second identical request inside the TTL issues no ranking query and no
 *     count query, and answers the same body;
 *   - a request that differs in any parameter is its own cache entry and is
 *     computed fresh;
 *   - the HTTP response stays no-store (Equoria-cmw85.28): only the server
 *     query is cached.
 */

import { randomBytes } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse } from '../../../tests/helpers/testAuth.mjs';

describe('INTEGRATION: competition leaderboard query cache (Equoria-cmw85.6)', () => {
  const suffix = randomBytes(6).toString('hex');
  const DISCIPLINE = 'Dressage';

  let token;
  let userId;
  let horse;
  const showIds = [];

  /** One more first place for the fixture horse, at a show of its own. */
  async function addWin() {
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-cmw856-${suffix}-${showIds.length}`,
        discipline: DISCIPLINE,
        runDate: new Date(),
        prize: 1000,
        entryFee: 100,
        levelMin: 1,
        levelMax: 10,
      },
    });
    showIds.push(show.id);
    await prisma.competitionResult.create({
      data: {
        horseId: horse.id,
        showId: show.id,
        showName: show.name,
        discipline: DISCIPLINE,
        placement: 1,
        prizeWon: 5,
        score: 80.0,
        runDate: new Date(),
      },
    });
  }

  /** GET the board and report how many ranking and count queries it issued. */
  async function board(query) {
    const ops = { groupBy: 0, raw: 0 };
    const realGroupBy = prisma.competitionResult.groupBy.bind(prisma.competitionResult);
    const realQueryRaw = prisma.$queryRaw.bind(prisma);
    prisma.competitionResult.groupBy = (...args) => {
      ops.groupBy += 1;
      return realGroupBy(...args);
    };
    prisma.$queryRaw = (...args) => {
      ops.raw += 1;
      return realQueryRaw(...args);
    };
    let res;
    try {
      res = await request(app)
        .get('/api/v1/leaderboards/competition')
        .query(query)
        .set('Authorization', `Bearer ${token}`);
    } finally {
      prisma.competitionResult.groupBy = realGroupBy;
      prisma.$queryRaw = realQueryRaw;
    }
    expect(res.status).toBe(200);
    return { res, ops };
  }

  beforeAll(async () => {
    const u = await createTestUser({
      username: `TFcmw856_${suffix}`,
      email: `tfcmw856_${suffix}@test.com`,
    });
    token = u.token;
    userId = u.user.id;
    horse = await createTestHorse({ name: `TestFixture-cmw856-${suffix}`, userId });
    await addWin();
  }, 120000);

  afterAll(async () => {
    await prisma.competitionResult.deleteMany({ where: { horseId: horse?.id } });
    await prisma.show.deleteMany({ where: { id: { in: showIds } } });
    await prisma.horse.deleteMany({ where: { id: horse?.id } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }, 60000);

  it('serves a repeated identical request from the cache, without querying', async () => {
    const query = { metric: 'wins', discipline: DISCIPLINE, period: 'all', limit: 100 };

    const first = await board(query);
    expect(first.ops.groupBy).toBeGreaterThan(0);
    expect(first.ops.raw).toBeGreaterThan(0);

    // The data changes, but the identical request inside the TTL answers the
    // cached page without touching the results table.
    await addWin();
    const second = await board(query);
    expect(second.ops.groupBy).toBe(0);
    expect(second.ops.raw).toBe(0);
    expect(second.res.body).toEqual(first.res.body);

    // The HTTP response is never cached by the browser or a proxy (cmw85.28).
    expect(second.res.headers['cache-control']).toMatch(/no-store/);
  }, 60000);

  it('gives every distinct parameter combination its own cache entry', async () => {
    const base = { metric: 'wins', discipline: DISCIPLINE, period: 'all', limit: 99 };
    const a = await board(base);
    expect(a.ops.groupBy).toBeGreaterThan(0);

    // Same discipline, a different limit / offset / metric / period: each is computed fresh.
    for (const changed of [{ limit: 42 }, { offset: 1 }, { metric: 'earnings' }, { period: 'year' }]) {
      const other = await board({ ...base, ...changed });
      expect(other.ops.groupBy).toBeGreaterThan(0);
    }

    // The original key is still its own cached answer.
    const again = await board(base);
    expect(again.ops.groupBy).toBe(0);
    expect(again.res.body).toEqual(a.res.body);
  }, 60000);
});
